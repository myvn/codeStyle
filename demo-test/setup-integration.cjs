const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const root = path.resolve(__dirname, "..")
const runtime = path.join(__dirname, ".runtime")
const pkg = require("../package.json")
fs.mkdirSync(runtime, { recursive: true })
fs.writeFileSync(path.join(runtime, "package.json"), JSON.stringify({
    name: "code-style-integration", private: true, type: "commonjs",
    dependencies: { ...pkg.peerDependencies, eslint: "^9.0.0", typescript: "^5.0.0" },
}, null, 2))
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: runtime, stdio: "inherit", shell: process.platform === "win32",
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
