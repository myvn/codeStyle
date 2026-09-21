const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const pkg = require("../package.json")
const runtime = path.join(__dirname, ".runtime-legacy")
const dependencies = Object.fromEntries(
    [
        "@typescript-eslint/parser",
        "@typescript-eslint/eslint-plugin",
        "eslint-plugin-import",
        "eslint-import-resolver-typescript",
        "eslint-plugin-prettier",
        "eslint-config-prettier",
        "prettier",
        "eslint-plugin-vue",
        "vue-eslint-parser",
    ].map((name) => [name, pkg.peerDependencies[name]]),
)
// Exact supported ESLint 8 floor; the modern environment tests ESLint 9.
Object.assign(dependencies, { eslint: "8.57.0", typescript: "^5.0.0" })
fs.mkdirSync(runtime, { recursive: true })
fs.writeFileSync(
    path.join(runtime, "package.json"),
    JSON.stringify(
        {
            name: "code-style-legacy-integration",
            private: true,
            dependencies,
        },
        null,
        2,
    ),
)
const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    {
        cwd: runtime,
        stdio: "inherit",
        shell: process.platform === "win32",
    },
)
if (result.error) {
    throw result.error
}
process.exitCode = result.status ?? 1
