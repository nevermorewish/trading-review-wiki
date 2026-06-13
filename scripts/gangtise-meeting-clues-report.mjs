import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"
import { stringify as stringifyYaml } from "yaml"

const require = createRequire(import.meta.url)
const gangtiseAutomationRequire = createRequire("/Users/jiegege/.codex/automations/gangtise-schema/package.json")

const OUTPUT_DIR = "/Users/jiegege/Desktop/杰杰杰/raw/研报新闻/投研线索"
const TEMP_PG_NODE_MODULES = "/private/tmp/codex-gangtise-meeting-clues/node_modules"
const FALLBACK_DB_CONFIG_PATH = "/Users/jiegege/.codex/automations/gangtise-schema/db-config.json"
const DEFAULT_CONFIG = {
  host: "222.240.196.158",
  port: 51943,
  user: "shihao",
  database: "cn_alternative_db",
  schema: "public",
  table: "gangtise_meeting_clues",
  timeZone: "Asia/Shanghai",
}

function pad(value) {
  return String(value).padStart(2, "0")
}

function getShanghaiParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: DEFAULT_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]))
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

function getRunTimestamps(pubDateOverride) {
  const now = new Date()
  const sh = getShanghaiParts(now)
  const runDate = `${sh.year}-${sh.month}-${sh.day}`
  const pubDate = pubDateOverride ?? runDate
  const runClock = `${sh.hour}${sh.minute}${sh.second}`
  return {
    pubDate,
    runClock,
    generatedAt: `${runDate}T${sh.hour}:${sh.minute}:${sh.second}+08:00`,
    startAt: `${pubDate} 00:00:00+08`,
    endAt: nextShanghaiDay(pubDate),
  }
}

function readPubDateOverride() {
  const argDate = process.argv.find((arg) => arg.startsWith("--date="))?.slice("--date=".length)
  const pubDate = argDate || process.env.GANGTISE_MEETING_CLUES_DATE
  if (!pubDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pubDate)) {
    throw new Error(`Invalid date override: ${pubDate}. Expected YYYY-MM-DD.`)
  }
  return pubDate
}

function nextShanghaiDay(pubDate) {
  const [year, month, day] = pubDate.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())} 00:00:00+08`
}

function escapeInline(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim()
}

function coerceTopicNames(value) {
  if (Array.isArray(value)) return value.map((item) => escapeInline(item)).filter(Boolean)
  if (value == null) return []
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map((item) => escapeInline(item)).filter(Boolean)
    } catch {}
    return trimmed
      .split(/[、,，;；\n]/)
      .map((item) => escapeInline(item))
      .filter(Boolean)
  }
  return [escapeInline(value)].filter(Boolean)
}

function collectTopicIndex(rows) {
  const seen = new Set()
  const ordered = []
  for (const row of rows) {
    const topicNames = coerceTopicNames(row.topic_target_names)
    const topics = topicNames.length ? topicNames : [escapeInline(row.detail_topic)].filter(Boolean)
    for (const topic of topics) {
      if (seen.has(topic)) continue
      seen.add(topic)
      ordered.push(topic)
    }
  }
  return ordered
}

function formatBeijingTimestamp(value) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  const parts = getShanghaiParts(date)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

function renderSection(title, body) {
  const clean = String(body ?? "").trim()
  if (!clean) return ""
  return `#### ${title}\n\n${clean}\n`
}

function renderMarkdown(rows, meta) {
  const topicIndex = collectTopicIndex(rows)
  const frontmatter = {
    source: `${DEFAULT_CONFIG.database}.${DEFAULT_CONFIG.schema}.${DEFAULT_CONFIG.table}`,
    pub_date: meta.pubDate,
    time_zone: DEFAULT_CONFIG.timeZone,
    record_count: rows.length,
    fields: ["pub_time", "content", "detail_topic", "ai_summary", "topic_target_names"],
    generated_at: meta.generatedAt,
  }

  const minPubTime = rows.length ? formatBeijingTimestamp(rows[0].pub_time) : ""
  const maxPubTime = rows.length ? formatBeijingTimestamp(rows[rows.length - 1].pub_time) : ""
  const lines = [
    "---",
    stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd(),
    "---",
    "",
    `# ${meta.pubDate} 投研线索汇总`,
    "",
    "## 今日概览",
    "",
    `- 记录数: ${rows.length}`,
    `- 发布时间范围: ${rows.length ? `${minPubTime} 至 ${maxPubTime}` : "无记录"}（北京时间）`,
    `- 涉及主题/标的数: ${topicIndex.length}`,
    "",
    "## 主题索引",
    "",
  ]

  if (topicIndex.length) {
    for (const topic of topicIndex) lines.push(`- ${topic}`)
  } else {
    lines.push("- 无")
  }

  lines.push("", "## 逐条明细", "")

  if (!rows.length) {
    lines.push("当天没有命中记录。")
    return lines.join("\n").trimEnd() + "\n"
  }

  rows.forEach((row, index) => {
    const topicNames = coerceTopicNames(row.topic_target_names)
    lines.push(`### ${index + 1}. ${escapeInline(row.detail_topic) || `记录 ${row.id}`}`, "")
    lines.push(`- 发布时间: ${formatBeijingTimestamp(row.pub_time)}（北京时间）`)
    lines.push(`- 记录 ID: ${row.id}`)
    lines.push(`- 主题/标的: ${topicNames.length ? topicNames.join("、") : "无"}`)
    lines.push(`- detail_topic: ${escapeInline(row.detail_topic) || "无"}`, "")
    const contentSection = renderSection("content", row.content)
    if (contentSection) lines.push(contentSection.trimEnd(), "")
    const aiSummarySection = renderSection("ai_summary", row.ai_summary)
    if (aiSummarySection) lines.push(aiSummarySection.trimEnd(), "")
  })

  return lines.join("\n").trimEnd() + "\n"
}

async function loadPgClient() {
  const attempts = [
    () => require("pg"),
    () => gangtiseAutomationRequire("pg"),
    async () => import(pathToFileURL(path.join(TEMP_PG_NODE_MODULES, "pg", "lib", "index.js")).href),
  ]
  for (const attempt of attempts) {
    try {
      const mod = await attempt()
      return mod.Client ?? mod.default?.Client ?? mod.default ?? mod
    } catch {}
  }
  throw new Error(`Missing PostgreSQL client. Install it temporarily with: npm install --prefix /private/tmp/codex-gangtise-meeting-clues pg`)
}

async function loadPassword() {
  if (process.env.PG_SHIHAO_PASSWORD) return process.env.PG_SHIHAO_PASSWORD

  try {
    const rawConfig = await fs.readFile(FALLBACK_DB_CONFIG_PATH, "utf8")
    const config = JSON.parse(rawConfig)
    const sameConnection =
      config.host === DEFAULT_CONFIG.host &&
      Number(config.port) === DEFAULT_CONFIG.port &&
      config.user === DEFAULT_CONFIG.user &&
      config.database === DEFAULT_CONFIG.database

    if (sameConnection && config.password) return config.password
  } catch {}

  throw new Error("PG_SHIHAO_PASSWORD is not set, and no matching local Gangtise DB config was found.")
}

async function fetchRows({ password, startAt, endAt }) {
  const Client = await loadPgClient()
  const client = new Client({
    host: DEFAULT_CONFIG.host,
    port: DEFAULT_CONFIG.port,
    user: DEFAULT_CONFIG.user,
    password,
    database: DEFAULT_CONFIG.database,
    ssl: false,
  })

  await client.connect()
  try {
    const result = await client.query(
      `
        select id, pub_time, content, detail_topic, ai_summary, topic_target_names
        from ${DEFAULT_CONFIG.schema}.${DEFAULT_CONFIG.table}
        where pub_time >= $1::timestamptz
          and pub_time < $2::timestamptz
        order by pub_time asc, id asc
      `,
      [startAt, endAt],
    )
    return result.rows
  } finally {
    await client.end().catch(() => {})
  }
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

async function writeMarkdown(content, meta) {
  const fileName = `${meta.pubDate}-${meta.runClock}-gangtise-meeting-clues.md`
  const filePath = path.join(OUTPUT_DIR, fileName)
  await fs.writeFile(filePath, content, "utf8")
  return { fileName, filePath }
}

async function main() {
  const password = await loadPassword()

  const meta = getRunTimestamps(readPubDateOverride())
  const rows = await fetchRows({ password, startAt: meta.startAt, endAt: meta.endAt })
  await ensureOutputDir()
  const markdown = renderMarkdown(rows, meta)
  const written = await writeMarkdown(markdown, meta)
  const minPubTime = rows.length ? formatBeijingTimestamp(rows[0].pub_time) : null
  const maxPubTime = rows.length ? formatBeijingTimestamp(rows[rows.length - 1].pub_time) : null
  const report = {
    filePath: written.filePath,
    fileName: written.fileName,
    recordCount: rows.length,
    publishedRange: rows.length ? `${minPubTime} 至 ${maxPubTime}（北京时间）` : "无记录",
    passwordWrittenToMarkdown: false,
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
