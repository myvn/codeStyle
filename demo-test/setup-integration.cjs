const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const root = path.resolve(__dirname, "..")
const runtime = path.join(__dirname, ".runtime")
const pkg = require("../package.json")
// 声明范围的两端都要有真实运行回归，而不是只测一端：
//   · 集成套件（本文件）固定在「最低支持版本」——stylelint 16 线，也是存量项目最可能的组合
//   · stylelint 17 那套由 demo-test/setup-stylelint17.cjs 的独立运行时覆盖
const stylelintFloor = {
    stylelint: "16.26.1",
    "stylelint-config-recommended": "^17.0.0",
    "stylelint-config-recommended-scss": "^16.0.0",
    "stylelint-config-recess-order": "^5.0.0",
}

fs.mkdirSync(runtime, { recursive: true })
fs.writeFileSync(
    path.join(runtime, "package.json"),
    JSON.stringify(
        {
            name: "code-style-integration",
            private: true,
            type: "commonjs",
            dependencies: {
                ...pkg.peerDependencies,
                ...stylelintFloor,
                eslint: "^9.0.0",
                typescript: "^5.0.0",
            },
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
