import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const protocExe = process.platform === "win32" ? "protoc.exe" : "protoc";
const protocPath = join(rootDir, ".protoc", "bin", protocExe);
const protocInclude = join(rootDir, ".protoc", "include");

const env = { ...process.env };

if (existsSync(protocPath)) {
  env.PROTOC = protocPath;
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = `${join(rootDir, ".protoc", "bin")}${delimiter}${env[pathKey] ?? ""}`;
}

if (existsSync(protocInclude)) {
  env.PROTOC_INCLUDE = protocInclude;
}

const tauriBin = join(rootDir, "node_modules", "@tauri-apps", "cli", "tauri.js");

const child = spawn(process.execPath, [tauriBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
