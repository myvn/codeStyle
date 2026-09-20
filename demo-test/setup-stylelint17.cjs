const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const runtime = path.join(__dirname, ".runtime-sl17")
const [major, minor] = process.versions.node.split(".").map(Number)
const supported = major > 22 || (major === 22 && minor >= 12)

/**
 * Stylelint 17 生态（stylelint 17 本身要 Node >= 20.19，配置包要 ^22.12 || >=24）。
 * 这个运行时用来验证"我们声明的 peer 范围真的能跑"，与 ESLint 8 的 .runtime-legacy
 * 是同一套思路：声明支持 ≠ 测过。
 */
const dependencies = {
    stylelint: "^17.0.0",
    "stylelint-config-recommended": "^18.0.0",
    "stylelint-config-recommended-scss": "^17.0.0",
    "stylelint-config-recommended-vue": "^2.0.0",
    "stylelint-config-html": "^2.0.0",
    "stylelint-config-recess-order": "^7.0.0",
    "stylelint-order": "^8.0.0",
    "stylelint-prettier": "^5.0.0",
    "postcss-html": "^2.0.0",
    "postcss-scss": "^4.0.0",
    "postcss-less": "^6.0.0",
    prettier: "^3.0.0",
}

fs.mkdirSync(runtime, { recursive: true })
fs.writeFileSync(
    path.join(runtime, "package.json"),
    JSON.stringify({ name: "code-style-stylelint17", private: true, dependencies }, null, 2),
)

if (!supported) {
    // 低版本 Node 上装不了这套生态；留一个标记，让 test-all 知道套件是"跳过"而不是"缺环境"
    fs.writeFileSync(
        path.join(runtime, "SKIPPED"),
        `stylelint 17 生态需要 Node >= 22.12，当前 ${process.versions.node}\n`,
    )
    console.log(`跳过安装：stylelint 17 生态需要 Node >= 22.12（当前 ${process.versions.node}）`)
    process.exit(0)
}

fs.rmSync(path.join(runtime, "SKIPPED"), { force: true })
const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: runtime, stdio: "inherit", shell: process.platform === "win32" },
)
if (result.error) {
    throw result.error
}
process.exitCode = result.status ?? 1
