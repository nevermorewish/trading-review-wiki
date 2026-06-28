use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

/// Result of a successful brand login (frogclaw / sub2api — both New API forks).
///
/// `access_token` is a relay key in the form `sk-...` minted via
/// `/api/token/ensure-group`. It is used directly as a Bearer token against the
/// OpenAI-compatible `/v1/chat/completions` endpoint, so the rest of the app can
/// treat the brand exactly like a custom OpenAI-compatible provider.
#[derive(Debug, Serialize)]
pub struct FrogclawLogin {
    pub user_id: i64,
    pub username: String,
    pub display_name: String,
    pub access_token: String,
    pub models: Vec<String>,
}

fn base_url(raw: &str) -> String {
    raw.trim().trim_end_matches('/').to_string()
}

fn api_message(body: &Value) -> String {
    body.get("message")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or("未知错误")
        .to_string()
}

/// Log in to a New API-compatible relay (frogclaw / sub2api) with
/// username + password, then fetch the usable model list and ensure a relay
/// token. The whole flow runs server-side with a cookie jar because the login
/// returns a session cookie that the WebView's fetch cannot reliably reuse
/// across the follow-up management calls.
#[tauri::command]
pub async fn frogclaw_login(
    base_url: String,
    username: String,
    password: String,
    group: Option<String>,
) -> Result<FrogclawLogin, String> {
    let base = self::base_url(&base_url);
    if base.is_empty() {
        return Err("服务器地址不能为空".to_string());
    }

    let client = reqwest::Client::builder()
        .cookie_store(true)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // 1) Login — sets the session cookie in the jar and returns the user id.
    let login_body = serde_json::json!({
        "username": username,
        "password": password,
    });
    let login_resp = client
        .post(format!("{}/api/user/login", base))
        .json(&login_body)
        .send()
        .await
        .map_err(|e| format!("登录请求失败: {}", e))?;

    let login_status = login_resp.status();
    let login_text = login_resp
        .text()
        .await
        .map_err(|e| format!("读取登录响应失败: {}", e))?;
    if !login_status.is_success() {
        return Err(format!("登录失败 (HTTP {}): {}", login_status.as_u16(), login_text));
    }
    let login_json: Value = serde_json::from_str(&login_text)
        .map_err(|_| format!("登录响应不是合法 JSON: {}", login_text))?;
    if !login_json.get("success").and_then(Value::as_bool).unwrap_or(false) {
        return Err(format!("登录失败: {}", api_message(&login_json)));
    }
    let data = login_json.get("data").cloned().unwrap_or(Value::Null);
    if data.get("require_2fa").and_then(Value::as_bool).unwrap_or(false) {
        return Err("该账号开启了两步验证 (2FA)，暂不支持在桌面端登录".to_string());
    }
    let user_id = data
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| "登录响应缺少用户 id".to_string())?;
    let username = data
        .get("username")
        .and_then(Value::as_str)
        .unwrap_or(&username)
        .to_string();
    let display_name = data
        .get("display_name")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or(&username)
        .to_string();

    let user_header = user_id.to_string();

    // 2) Fetch the models this user's group can call.
    let models_resp = client
        .get(format!("{}/api/user/models", base))
        .header("New-Api-User", &user_header)
        .send()
        .await
        .map_err(|e| format!("获取模型列表失败: {}", e))?;
    let models_text = models_resp
        .text()
        .await
        .map_err(|e| format!("读取模型列表响应失败: {}", e))?;
    let models_json: Value = serde_json::from_str(&models_text)
        .map_err(|_| format!("模型列表响应不是合法 JSON: {}", models_text))?;
    if !models_json.get("success").and_then(Value::as_bool).unwrap_or(false) {
        return Err(format!("获取模型列表失败: {}", api_message(&models_json)));
    }
    let models: Vec<String> = models_json
        .get("data")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    // 3) Ensure a relay token (find-or-create) so the app can call /v1 directly.
    let group = group.unwrap_or_else(|| "default".to_string());
    let token_body = serde_json::json!({ "group": group });
    let token_resp = client
        .post(format!("{}/api/token/ensure-group", base))
        .header("New-Api-User", &user_header)
        .json(&token_body)
        .send()
        .await
        .map_err(|e| format!("获取令牌失败: {}", e))?;
    let token_text = token_resp
        .text()
        .await
        .map_err(|e| format!("读取令牌响应失败: {}", e))?;
    let token_json: Value = serde_json::from_str(&token_text)
        .map_err(|_| format!("令牌响应不是合法 JSON: {}", token_text))?;
    if !token_json.get("success").and_then(Value::as_bool).unwrap_or(false) {
        return Err(format!("获取令牌失败: {}", api_message(&token_json)));
    }
    let access_token = token_json
        .get("data")
        .and_then(|d| d.get("key"))
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "令牌响应缺少 key".to_string())?
        .to_string();

    Ok(FrogclawLogin {
        user_id,
        username,
        display_name,
        access_token,
        models,
    })
}
