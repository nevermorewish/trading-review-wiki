import path from "path"
import { execSync } from "child_process"
import { readFileSync } from "fs"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const host = process.env.TAURI_DEV_HOST

function readDesktopVersion() {
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version?: unknown }
  if (typeof pkg.version !== "string" || !pkg.version.trim()) {
    throw new Error("package.json must define a desktop version")
  }
  return pkg.version.trim()
}

function readGitCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execSync("git rev-parse --short=12 HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return "unknown"
  }
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  define: {
    "import.meta.env.VITE_DESKTOP_VERSION": JSON.stringify(readDesktopVersion()),
    "import.meta.env.VITE_BUILD_COMMIT": JSON.stringify(readGitCommit()),
    "import.meta.env.VITE_BUILD_DATE": JSON.stringify(new Date().toISOString()),
    "import.meta.env.VITE_DESKTOP_UPDATE_MANIFEST_URL": JSON.stringify(process.env.TRADING_REVIEW_UPDATE_MANIFEST_URL || ""),
    "import.meta.env.VITE_DESKTOP_UPDATE_DOWNLOAD_URL": JSON.stringify(process.env.TRADING_REVIEW_UPDATE_DOWNLOAD_URL || ""),
  },

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    environment: "node",
  },
}))
