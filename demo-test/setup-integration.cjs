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
                // peer 里的联合范围（本轮 BUG-027 校准放宽后出现）会被 npm 解析到最新大版本
                // （@eslint/js 10 要 eslint 10；lint-staged 17 改过报错措辞），与本运行时
                // 「最低支持版本」的哲学冲突——集成套件要守住的是下限。这里把联合范围的
                // 包全部钉回下限大版本；最新大版本由每轮校准的独立 fixture 验证。
                "@eslint/js": "^9.0.0",
                "@commitlint/cli": "^19.0.0",
                "@commitlint/config-conventional": "^19.0.0",
                "eslint-import-resolver-typescript": "^3.0.0",
                globals: "^16.0.0",
                "lint-staged": "^16.0.0",
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

// npm install 会把 node_modules 里非依赖的 my-code-style 源码副本当作多余包剪掉，
// 而 _runtime.cjs 的同步戳（.my-code-style-sync.json）在 node_modules 之外、指纹未变
// 时会跳过重拷——于是「同一指纹下重装 runtime」后副本缺失、fixture 里
// require("my-code-style/*") 全部失败。装完即清戳，强制下一次同步重拷。
for (const stale of [".my-code-style-sync.json", ".my-code-style-sync.lock"]) {
    fs.rmSync(path.join(runtime, stale), { force: true, recursive: true })
}
