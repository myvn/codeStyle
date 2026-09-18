#!/usr/bin/env node
"use strict"

/**
 * 速度诊断：把"一次提交到底花在哪"逐项测出来，用于定位慢机器上的测试瓶颈。
 *
 *   npm run diagnose               # 全量诊断（需要 demo-test/.runtime，会跑一次真实提交链）
 *   npm run diagnose -- --quick    # 跳过真实提交链，只测进程 / git / 文件系统
 *
 * 关注三条线：
 *   ① npx 比 node_modules/.bin 慢多少 —— 每个 git hook 都是一次 npx（npm CLI）启动；
 *   ② 仓库目录里的 git 提交比系统临时目录慢多少 —— 说明仓库盘/同步盘有问题；
 *   ③ 一次真实提交里，hooks（lint-staged → prettier/eslint/stylelint）占了多少。
 */

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")

const ROOT = path.resolve(__dirname, "..")
const RUNTIME = path.join(ROOT, "demo-test/.runtime")
const BIN = path.join(RUNTIME, "node_modules/.bin")
const QUICK = process.argv.includes("--quick")
const ms = (ns) => Number(ns) / 1e6

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        cwd: options.cwd || ROOT,
        encoding: "utf8",
        timeout: 120000,
        env: {
            ...process.env,
            GIT_CONFIG_NOSYSTEM: "1",
            // 集成测试只挡了 /etc/gitconfig，~/.gitconfig 依旧生效；这里做对照用
            ...(options.isolateGlobalGitConfig
                ? { GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" }
                : {}),
        },
    })
}

/** 跑 runs 次，取最快的一次（排除偶发抖动） */
function best(fn, runs = 3) {
    let fastest = Infinity
    for (let i = 0; i < runs; i += 1) {
        const started = process.hrtime.bigint()
        fn()
        fastest = Math.min(fastest, ms(process.hrtime.bigint() - started))
    }
    return fastest
}

function line(label, value, note = "") {
    console.log(`  ${label.padEnd(38)}${value.padStart(9)}  ${note}`)
}

function tempRepo(baseDir, options = {}) {
    const dir = fs.mkdtempSync(path.join(baseDir, ".diag-git-"))
    run("git", ["init", "-q"], { cwd: dir, ...options })
    for (const config of [
        ["user.name", "diag"],
        ["user.email", "diag@example.invalid"],
        ["commit.gpgsign", "false"],
    ]) {
        run("git", ["config", ...config, "--local"], { cwd: dir, ...options })
    }
    return dir
}

console.log("")
console.log("  速度诊断")
console.log(
    `  环境：${os.platform()} ${os.arch()} · Node ${process.version} · ${os.cpus().length} 核 / ${(
        os.totalmem() / 1024 ** 3
    ).toFixed(0)}G`,
)
console.log(`  仓库：${ROOT}`)
console.log("")

// --- ① 进程启动成本 ---
console.log("  ① 进程启动成本（各测 3 次取最快）")
line("node -e ''", `${best(() => run(process.execPath, ["-e", ""])).toFixed(0)}ms`)
if (fs.existsSync(BIN)) {
    for (const tool of ["prettier", "eslint", "lint-staged", "commitlint"]) {
        if (!fs.existsSync(path.join(BIN, tool))) continue
        const direct = best(() => run(path.join(BIN, tool), ["--version"]))
        const viaNpx = best(() => run("npx", ["--no-install", tool, "--version"]))
        line(`.bin/${tool} --version`, `${direct.toFixed(0)}ms`)
        line(
            `npx --no-install ${tool} --version`,
            `${viaNpx.toFixed(0)}ms`,
            `← 每个 hook 多花 ${(viaNpx - direct).toFixed(0)}ms`,
        )
    }
} else {
    line("npx 对比", "（跳过）", "缺 demo-test/.runtime：npm run test:integration:setup")
}
console.log("")

// --- ② git 成本：系统临时目录 vs 仓库内目录 ---
console.log("  ② 两次空提交的纯 git 成本（无 hooks）")
function gitBaseline(baseDir, label, options = {}) {
    const dir = tempRepo(baseDir, options)
    const elapsed = best(() => {
        run("git", ["commit", "-q", "--allow-empty", "-m", "chore: baseline"], { cwd: dir, ...options })
        run("git", ["commit", "-q", "--allow-empty", "-m", "chore: second"], { cwd: dir, ...options })
    })
    fs.rmSync(dir, { recursive: true, force: true })
    line(label, `${elapsed.toFixed(0)}ms`)
}
const isolate = { isolateGlobalGitConfig: true }
gitBaseline(os.tmpdir(), "TMPDIR · 继承 ~/.gitconfig", {})
gitBaseline(os.tmpdir(), "TMPDIR · 隔离 ~/.gitconfig", isolate)
if (fs.existsSync(RUNTIME)) gitBaseline(RUNTIME, "仓库内 · 隔离 ~/.gitconfig", isolate)

// 集成/基础套件里大量用例只做 add/status/diff（scope 检测、暂存检查），单独量一下
function gitIndexOps(baseDir, label, options = {}) {
    const dir = tempRepo(baseDir, options)
    for (let i = 0; i < 50; i += 1) {
        fs.writeFileSync(path.join(dir, `f${i}.js`), `export const v${i} = ${i}\n`)
    }
    run("git", ["add", "-A"], { cwd: dir, ...options })
    const elapsed = best(
        () => {
            for (let i = 0; i < 10; i += 1) {
                run("git", ["status", "--porcelain"], { cwd: dir, ...options })
                run("git", ["diff", "--cached", "--name-only"], { cwd: dir, ...options })
            }
        },
        2,
    )
    fs.rmSync(dir, { recursive: true, force: true })
    line(label, `${elapsed.toFixed(0)}ms`, "10× status + 10× diff（50 文件）")
}
gitIndexOps(os.tmpdir(), "TMPDIR · 继承 ~/.gitconfig", {})
gitIndexOps(os.tmpdir(), "TMPDIR · 隔离 ~/.gitconfig", isolate)
if (fs.existsSync(RUNTIME)) gitIndexOps(RUNTIME, "仓库内 · 隔离 ~/.gitconfig", isolate)
console.log("")

// --- ③ 文件系统：小文件写入 ---
console.log("  ③ 写 200 个小文件 + 读目录")
function writeFiles(baseDir, label) {
    const dir = fs.mkdtempSync(path.join(baseDir, ".diag-write-"))
    const elapsed = best(() => {
        for (let i = 0; i < 200; i += 1) fs.writeFileSync(path.join(dir, `f${i}.txt`), `file ${i}\n`)
        fs.readdirSync(dir)
    }, 2)
    fs.rmSync(dir, { recursive: true, force: true })
    line(label, `${elapsed.toFixed(0)}ms`)
}
writeFiles(os.tmpdir(), "系统临时目录（TMPDIR）")
if (fs.existsSync(RUNTIME)) writeFiles(RUNTIME, "仓库内（demo-test/.runtime）")
console.log("")

// --- ④ 一次真实提交链 ---
const STRESS = Number.parseInt(
    (process.argv.find((arg) => arg.startsWith("--stress=")) || "--stress=8").split("=")[1],
    10,
)
const SKIP_CHAIN = QUICK || !fs.existsSync(RUNTIME)

if (SKIP_CHAIN) {
    console.log("  ④ 真实提交链：已跳过（--quick 或缺少 demo-test/.runtime）")
    console.log("")
} else {

console.log("  ④ 一次真实提交链（与集成测试内的做法一致，含真实 hooks）")
const { commitProject } = require(path.join(ROOT, "demo-test/integration/_runtime.cjs"))
const staged = { after: () => {} }
let fixture = null
const chainStart = process.hrtime.bigint()
try {
    const started = process.hrtime.bigint()
    fixture = commitProject(staged)
    line("建仓 + bin/init + husky 安装", `${ms(process.hrtime.bigint() - started).toFixed(0)}ms`)

    const source = 'const count:number=1;console.log(count);\n'
    const name = "src/demo.ts"
    let mark = process.hrtime.bigint()
    fixture.write(name, source)
    fixture.git("add", "--", "src")
    line("写文件 + git add", `${ms(process.hrtime.bigint() - mark).toFixed(0)}ms`)

    mark = process.hrtime.bigint()
    const first = fixture.commit()
    const firstMs = ms(process.hrtime.bigint() - mark)
    line("第 1 次提交（hooks：修复并提交）", `${firstMs.toFixed(0)}ms`, `退出码 ${first.status}`)

    mark = process.hrtime.bigint()
    fixture.write(name, source)
    fixture.git("add", "--", "src")
    const again = fixture.commit()
    const againMs = ms(process.hrtime.bigint() - mark)
    line("第 2 次提交（hooks：应被拦下）", `${againMs.toFixed(0)}ms`, `退出码 ${again.status}`)

    mark = process.hrtime.bigint()
    fixture.git("commit", "--no-verify", "--allow-empty", "-m", "chore: no hooks")
    const noHookMs = ms(process.hrtime.bigint() - mark)
    line("第 3 次提交（--no-verify，无 hooks）", `${noHookMs.toFixed(0)}ms`, "对照：纯 git 成本")

    line("一条链合计", `${ms(process.hrtime.bigint() - chainStart).toFixed(0)}ms`)
    console.log("")
    console.log(
        `  提示：hooks 成本 ≈ ${(firstMs - noHookMs).toFixed(0)}ms/次提交（第 1 次 − 对照）。`,
    )
    console.log("        它由 npx（npm CLI）启动 + lint-staged + prettier/eslint/stylelint 组成；")
    console.log("        对照 ① 里的 npx 差值，就能判断是 npm CLI 慢还是工具本身慢。")
} finally {
    if (fixture?.dir) fs.rmSync(fixture.dir, { recursive: true, force: true })
}
console.log("")
}

// --- ⑤ 并发压力 ---
async function runMany(command, args, count, options = {}) {
    const started = process.hrtime.bigint()
    const times = await Promise.all(
        Array.from({ length: count }, () => {
            const childStart = process.hrtime.bigint()
            return new Promise((resolve) => {
                const child = spawn(command, args, {
                    cwd: options.cwd || ROOT,
                    stdio: "ignore",
                    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", ...(options.env || {}) },
                })
                child.on("close", () => resolve(ms(process.hrtime.bigint() - childStart)))
            })
        }),
    )
    return { wall: ms(process.hrtime.bigint() - started), times }
}

async function stress() {
    if (!fs.existsSync(BIN)) return
    console.log(`  ⑤ 并发压力：同时跑 ${STRESS} 个同样的东西（看单个耗时膨胀多少）`)
    const sample = path.join(ROOT, "demo-test/integration/commit-chain-scss.test.cjs")
    const cases = [
        ["node -e ''", process.execPath, ["-e", ""]],
        [".bin/lint-staged --version", path.join(BIN, "lint-staged"), ["--version"]],
        ["npx --no-install lint-staged --version", "npx", ["--no-install", "lint-staged", "--version"]],
    ]
    for (const [label, command, args] of cases) {
        const { wall, times } = await runMany(command, args, STRESS)
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        line(
            `${STRESS}× ${label}`,
            `单 ${avg.toFixed(0)}ms`,
            `总 ${(wall / 1000).toFixed(1)}s · 最慢 ${Math.max(...times).toFixed(0)}ms`,
        )
    }
    if (fs.existsSync(sample)) {
        for (const [label, extraEnv] of [
            ["同一个测试文件（fixture 在仓库内）", {}],
            ["同一个测试文件（fixture 在 TMPDIR）", { MY_CODE_STYLE_FIXTURE_DIR: os.tmpdir() }],
        ]) {
            const { wall, times } = await runMany(process.execPath, ["--test", sample], STRESS, {
                env: extraEnv,
            })
            const avg = times.reduce((a, b) => a + b, 0) / times.length
            line(
                `${STRESS}× ${label}`,
                `单 ${(avg / 1000).toFixed(1)}s`,
                `总 ${(wall / 1000).toFixed(1)}s · 最慢 ${(Math.max(...times) / 1000).toFixed(1)}s`,
            )
        }
        console.log("")
        console.log("  读法：单个耗时相对「④ 的单独基线」涨了多少倍，就是排队有多严重。")
        console.log("        两行差很多 → 仓库目录（备份/同步/杀毒）是并发时的隐形串行点；")
        console.log("        两行都涨 → 是系统级的进程启动吞吐上限，只能靠减少进程数。")
    }
}

stress().then(() => {
    console.log("")
})
