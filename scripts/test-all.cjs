#!/usr/bin/env node
"use strict"

/**
 * 统一测试入口：分套件运行、用例明细、实时进度、分类统计。
 *
 *   npm run test:all                     # 默认输出：套件 + 每个用例 + 汇总表
 *   npm run test:all -- --quiet          # 只显示套件与汇总（隐藏用例明细）
 *   npm run test:all -- --parallel       # 强制套件级并行（核数 ≥ 8 时默认已开启）
 *   npm run test:all -- --serial         # 强制串行（CI 形态，输出最稳定）
 *   npm run test:all -- --jobs=2         # 并行时限制同时运行 2 个套件
 *   npm run test:all -- --concurrency=4  # 覆盖套件内文件级并发（默认按 CPU 核数）
 *   npm run test:all -- --verbose        # 透传原始 TAP 输出（排查单条用例时用）
 *   npm run test:all -- --no-count       # 跳过预统计（省几秒，进度条不显示总数）
 *   npm run test:all -- --progress       # 非 TTY 环境也强制刷新进度
 *
 * 退出码：任一用例失败、套件异常退出或套件未运行时为 1。
 */

const os = require("node:os")
const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")

const ROOT = path.resolve(__dirname, "..")
const argv = new Set(process.argv.slice(2))
const VERBOSE = argv.has("--verbose")
const QUIET = argv.has("--quiet") || argv.has("-q")
const SKIP_COUNT = argv.has("--no-count")
const PROGRESS = process.stdout.isTTY || argv.has("--progress")

const CORES = os.cpus().length
const FORCE_PARALLEL = argv.has("--parallel") || argv.has("-p")
const FORCE_SERIAL = argv.has("--serial")
// 核多的机器上并行几乎总是更快（套件之间不共享目录），因此默认自动开启；
// CI/低核机器保持串行，输出与历史行为一致。
const PARALLEL = FORCE_SERIAL ? false : FORCE_PARALLEL || CORES >= 8
const PARALLEL_AUTO = PARALLEL && !FORCE_PARALLEL

const jobsArg = process.argv.slice(2).find((arg) => arg.startsWith("--jobs="))
const JOBS = jobsArg ? Math.max(1, Number.parseInt(jobsArg.split("=")[1], 10) || 1) : Infinity

// 套件内部的文件级并发（node --test 默认 = CPU 核数 - 1）
const concurrencyArg = process.argv.slice(2).find((arg) => arg.startsWith("--concurrency="))
const CONCURRENCY = concurrencyArg
    ? Math.max(1, Number.parseInt(concurrencyArg.split("=")[1], 10) || 1)
    : null

const SUITES = [
    {
        id: "base",
        title: "基础 CLI 与配置矩阵",
        patterns: ["tests/*.test.cjs", "demo-test/*.test.cjs"],
    },
    {
        id: "integration",
        title: "现代工具链与提交链",
        patterns: ["demo-test/integration/*.test.cjs"],
        requires: "demo-test/.runtime",
        hint: "npm run test:integration:setup",
    },
    {
        id: "legacy",
        title: "ESLint 8 兼容性",
        patterns: ["demo-test/legacy/*.test.cjs"],
        requires: "demo-test/.runtime-legacy",
        hint: "npm run test:legacy:setup",
    },
]

// --- 工具 ---

function expand(pattern) {
    const dir = path.resolve(ROOT, path.dirname(pattern))
    const base = path.basename(pattern)
    const suffix = base.slice(base.indexOf("."))
    if (!fs.existsSync(dir)) return []
    return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(suffix))
        .sort()
        .map((name) => path.join(path.dirname(pattern), name))
}

/** 终端显示宽度：CJK 字符占两列，否则表格会错位 */
function displayWidth(text) {
    let width = 0
    for (const char of String(text)) {
        const code = char.codePointAt(0)
        const wide =
            (code >= 0x1100 && code <= 0x115f) ||
            (code >= 0x2e80 && code <= 0xa4cf) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xfe30 && code <= 0xfe6f) ||
            (code >= 0xff00 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6) ||
            (code >= 0x1f300 && code <= 0x1f64f)
        width += wide ? 2 : 1
    }
    return width
}

function pad(text, width, align = "left") {
    const fill = " ".repeat(Math.max(0, width - displayWidth(text)))
    return align === "right" ? fill + text : text + fill
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`

function formatDuration(ms) {
    if (ms === null || ms === undefined) return ""
    return ms < 1000 ? ` · ${Math.round(ms)}ms` : ` · ${(ms / 1000).toFixed(1)}s`
}

/** 进度条：已完成/总数、失败数、用时 */
function progressLine(state, width = 78) {
    const done = state.passed + state.failed + state.skipped
    const total = state.suite.expected || 0
    const ratio = total ? Math.min(1, done / total) : 0
    const barWidth = 20
    const filled = Math.round(ratio * barWidth)
    const bar = `${"█".repeat(filled)}${"░".repeat(barWidth - filled)}`
    const elapsed = seconds((state.done ? state.duration : Date.now() - state.startedAt) || 0)
    const bits = [
        bar,
        total ? `${done}/${total}` : `${done} 项`,
        state.failed ? `失败 ${state.failed}` : "",
        elapsed,
    ].filter(Boolean)
    return pad(bits.join("   "), width)
}

/** 用例明细行：✓/✗/○ + 名称 + 耗时 */
function caseLine(item) {
    const mark = item.status === "pass" ? "✓" : item.status === "fail" ? "✗" : "○"
    const note = item.status === "skip" ? "（跳过）" : ""
    return `      ${mark} ${item.name}${note}${formatDuration(item.duration)}`
}

function runSuite(files, extraArgs, onLine) {
    return new Promise((resolve) => {
        const args = ["--test", "--test-reporter=tap"]
        if (CONCURRENCY) args.push(`--test-concurrency=${CONCURRENCY}`)
        const child = spawn(process.execPath, [...args, ...extraArgs, ...files], {
            cwd: ROOT,
            stdio: ["ignore", "pipe", "pipe"],
        })
        let pending = ""
        child.stdout.setEncoding("utf8")
        child.stdout.on("data", (chunk) => {
            pending += chunk
            const lines = pending.split("\n")
            pending = lines.pop()
            for (const line of lines) onLine(line)
        })
        let stderr = ""
        child.stderr.setEncoding("utf8")
        child.stderr.on("data", (chunk) => {
            stderr += chunk
        })
        child.on("close", (code) => {
            if (pending) onLine(pending)
            resolve({ code: code ?? 1, stderr })
        })
    })
}

/** 预统计：加载期打桩数用例（见 scripts/count-tests.cjs），不执行用例体 */
function countTests(files) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join("scripts", "count-tests.cjs"), ...files], {
            cwd: ROOT,
            stdio: ["ignore", "pipe", "pipe"],
        })
        let out = ""
        child.stdout.setEncoding("utf8")
        child.stdout.on("data", (chunk) => {
            out += chunk
        })
        let stderr = ""
        child.stderr.setEncoding("utf8")
        child.stderr.on("data", (chunk) => {
            stderr += chunk
        })
        child.on("close", () => {
            // 统计失败或为 0 时返回 null：进度条退回"已完成 N 项"模式
            if (stderr) process.stderr.write(stderr)
            const total = Number.parseInt(out.trim(), 10)
            resolve(Number.isInteger(total) && total > 0 ? total : null)
        })
    })
}

/** 单个套件的运行状态 + TAP 解析（串行/并行共用） */
function makeRunner(suite, label) {
    const state = {
        suite,
        label,
        passed: 0,
        failed: 0,
        skipped: 0,
        cases: [],
        failures: [],
        rawLines: [],
        startedAt: Date.now(),
        duration: 0,
        started: false,
        done: false,
        code: 0,
    }
    let capture = false
    let current = null
    let writing = false
    // 串行模式的用例行先落名字，等 TAP 的 duration_ms 到达再补耗时
    let openLine = false
    const liveCases = !PARALLEL && !QUIET && !VERBOSE

    const renderProgress = () => {
        // 用例明细就是串行模式的进度；只有 --quiet 才退回单行进度条
        if (!PROGRESS || VERBOSE || PARALLEL || !QUIET || writing) return
        writing = true
        process.stdout.write(`\r${pad(`      ${progressLine(state, 60)}`, 78)}`, () => {
            writing = false
        })
    }

    const closeOpenLine = () => {
        if (openLine) {
            process.stdout.write("\n")
            openLine = false
        }
    }

    const onLine = (line) => {
        state.rawLines.push(line)
        if (VERBOSE) {
            console.log(PARALLEL ? `    [${suite.id}] ${line}` : `    ${line}`)
            return
        }
        if (line.startsWith("    ")) line = line.slice(4)

        const match = /^(ok|not ok) \d+ - (.*)$/.exec(line)
        if (match) {
            closeOpenLine()
            const status = match[1] === "not ok" ? "fail" : /# (SKIP|TODO)/.test(match[2]) ? "skip" : "pass"
            const name = match[2].replace(/\s+#\s*(SKIP|TODO)\b.*$/, "").trim()
            const item = { name, status, duration: null, lines: [] }
            state.cases.push(item)
            current = item
            if (status === "fail") {
                state.failed += 1
                state.failures.push(item)
                capture = true
            } else if (status === "skip") {
                state.skipped += 1
            } else {
                state.passed += 1
            }
            if (liveCases) {
                process.stdout.write(caseLine(item))
                openLine = true
            }
            renderProgress()
            return
        }

        const duration = /^\s*duration_ms:\s*([\d.]+)\s*$/.exec(line)
        if (duration && current && current.duration === null) {
            current.duration = Number.parseFloat(duration[1])
            if (liveCases && openLine) {
                process.stdout.write(formatDuration(current.duration))
                process.stdout.write("\n")
                openLine = false
            }
            return
        }

        if (capture && current) {
            if (line.trim() === "...") {
                capture = false
            } else {
                current.lines.push(line)
            }
        }
    }

    return {
        state,
        liveCases,
        onLine,
        finish: (code) => {
            closeOpenLine()
            state.done = true
            state.code = code
            state.duration = Date.now() - state.startedAt
            // 进程非零退出但没报告任何失败用例（崩溃/加载失败）时单独标记
            state.crashed = code !== 0 && state.failed === 0
        },
    }
}

// --- 渲染 ---

/** 套件结论行（串行/并行共用） */
function verdictLine(state) {
    return `     ${state.failed || state.crashed ? "✖" : "✓"} 通过 ${state.passed}${
        state.failed ? ` / 失败 ${state.failed}` : ""
    }${state.crashed ? ` / 异常退出 (exit ${state.code})` : ""}${
        state.skipped ? ` / 跳过 ${state.skipped}` : ""
    }  ·  ${seconds(state.duration)}`
}

/** 并行模式下每个套件跑完后成块输出：结论 + 用例明细 */
function printSuiteBlock(state) {
    console.log(verdictLine(state))
    if (!QUIET && !VERBOSE) {
        for (const item of state.cases) console.log(caseLine(item))
    }
    console.log("")
}

const board = { printed: 0 }

function boardLine(state) {
    if (!state.started) {
        return `  ⋯ ${pad(state.suite.title, 20)} 等待中`
    }
    const mark = state.done ? (state.failed ? "✖" : "✓") : "▶"
    return `  ${mark} ${pad(state.suite.title, 20)} ${progressLine(state, 46)}`
}

/** 多行实时面板：只画还在跑的套件，跑完的立刻让位给用例明细 */
function renderBoard(states) {
    if (!PROGRESS || VERBOSE) return
    const pending = states.filter((s) => !s.done)
    let out = board.printed ? `\x1b[${board.printed}F` : ""
    for (const state of pending) out += `\x1b[2K${boardLine(state)}\n`
    board.printed = pending.length
    process.stdout.write(out)
}

function clearBoard() {
    if (!PROGRESS || VERBOSE || !board.printed) return
    process.stdout.write(`\x1b[${board.printed}F`)
    for (let i = 0; i < board.printed; i += 1) process.stdout.write("\x1b[2K\n")
    process.stdout.write(`\x1b[${board.printed}F`)
    board.printed = 0
}

// --- 主流程 ---

async function main() {
    const plan = SUITES.map((suite) => {
        const files = suite.patterns.flatMap(expand)
        const missing = suite.requires ? !fs.existsSync(path.resolve(ROOT, suite.requires)) : false
        return { ...suite, files, missing }
    })

    const runnable = plan.filter((suite) => suite.files.length && !suite.missing)
    const skippedSuites = plan.filter((suite) => suite.files.length && suite.missing)

    console.log("")
    console.log("  my-code-style 测试套件")
    console.log("")

    for (const suite of plan) {
        if (suite.missing) {
            console.log(`  ⚠ 跳过「${suite.title}」：缺少 ${suite.requires}`)
            console.log(`    先运行：${suite.hint}`)
        }
    }
    if (skippedSuites.length) console.log("")

    // 预统计：加载期打桩枚举用例数（跳过用例体）
    if (!SKIP_COUNT) {
        process.stdout.write("  正在统计用例总数 …\r")
        for (const suite of runnable) {
            suite.expected = await countTests(suite.files)
        }
        process.stdout.write(" ".repeat(40) + "\r")
    }

    const results = []
    const startedAt = Date.now()

    if (PARALLEL) {
        // 三套件互不共享目录（.runtime / .runtime-legacy / 临时目录各自独立），可安全并行
        const limit = Math.min(JOBS, runnable.length)
        console.log(
            `  ▶ 并行运行 ${runnable.length} 个套件（同时 ${limit} 个${
                CONCURRENCY ? `，套件内并发 ${CONCURRENCY}` : ""
            }）${PARALLEL_AUTO ? `　·　${CORES} 核自动启用，--serial 可关闭` : ""}`,
        )
        if (VERBOSE) console.log("")
        const runners = runnable.map((suite, index) =>
            makeRunner(suite, `[${index + 1}/${runnable.length}] ${suite.title}`),
        )
        const queue = runners.map((_, index) => index)
        const timer =
            PROGRESS && !VERBOSE
                ? setInterval(() => renderBoard(runners.map((r) => r.state)), 1000)
                : null
        if (timer?.unref) timer.unref()
        renderBoard(runners.map((r) => r.state))

        const worker = async () => {
            while (queue.length) {
                const index = queue.shift()
                const runner = runners[index]
                runner.state.started = true
                runner.state.startedAt = Date.now()
                const { code } = await runSuite(runner.state.suite.files, [], runner.onLine)
                runner.finish(code)
                results[index] = runner.state
                if (PROGRESS && !VERBOSE) {
                    clearBoard()
                    printSuiteBlock(runner.state)
                    renderBoard(runners.map((r) => r.state))
                } else {
                    printSuiteBlock(runner.state)
                }
            }
        }
        await Promise.all(Array.from({ length: limit }, worker))
        if (timer) clearInterval(timer)
        clearBoard()
    } else {
        for (let index = 0; index < runnable.length; index += 1) {
            const suite = runnable[index]
            const runner = makeRunner(suite, `[${index + 1}/${runnable.length}] ${suite.title}`)
            const state = runner.state
            console.log(`  ▶ ${runner.state.label}${suite.expected ? `  （共 ${suite.expected} 项）` : ""}`)

            const { code } = await runSuite(suite.files, [], runner.onLine)
            runner.finish(code)
            if (PROGRESS && QUIET) process.stdout.write("\r" + " ".repeat(78) + "\r")
            results[index] = state
            console.log(verdictLine(state))
            console.log("")
        }
    }

    // --- 失败详情 ---
    const allFailures = results.flatMap((r) => r.failures.map((f) => ({ suite: r.suite.title, ...f })))
    if (allFailures.length) {
        console.log("  失败用例：")
        for (const failure of allFailures) {
            console.log("")
            console.log(`  ✖ [${failure.suite}] ${failure.name}`)
            for (const line of failure.lines.slice(0, 30)) console.log(`    ${line}`)
            if (failure.lines.length > 30) console.log(`    …（其余 ${failure.lines.length - 30} 行省略）`)
        }
        console.log("")
    }

    // --- 分类汇总 ---
    const crashed = results.filter((r) => r.crashed)
    const totals = results.reduce(
        (acc, r) => ({
            passed: acc.passed + r.passed,
            failed: acc.failed + r.failed,
            skipped: acc.skipped + r.skipped,
            duration: acc.duration + r.duration,
        }),
        { passed: 0, failed: 0, skipped: 0, duration: 0 },
    )
    const wallClock = Date.now() - startedAt
    // 并行模式下各套件叠加的用时没有意义，合计改用墙钟时间
    const shownDuration = PARALLEL ? wallClock : totals.duration
    const totalLabel = PARALLEL ? "合计（并行墙钟）" : "合计"

    const col = (text, width, align) => pad(text, width, align)
    const widthTitle = 22
    const rule = "  " + "─".repeat(widthTitle + 32)
    console.log(rule)
    console.log(
        `  ${col("套件", widthTitle)}${col("通过", 8, "right")}${col("失败", 8, "right")}${col(
            "跳过",
            8,
            "right",
        )}${col("用时", 8, "right")}`,
    )
    console.log(rule)
    for (const r of results) {
        console.log(
            `  ${col(r.suite.title, widthTitle)}${col(String(r.passed), 8, "right")}${col(
                String(r.failed),
                8,
                "right",
            )}${col(r.skipped ? String(r.skipped) : "-", 8, "right")}${col(
                seconds(r.duration),
                8,
                "right",
            )}`,
        )
    }
    if (skippedSuites.length) {
        for (const s of skippedSuites) {
            console.log(`  ${col(s.title, widthTitle)}${col("未运行", 8, "right")}`)
        }
    }
    console.log(rule)
    console.log(
        `  ${col(totalLabel, widthTitle)}${col(String(totals.passed), 8, "right")}${col(
            String(totals.failed),
            8,
            "right",
        )}${col(totals.skipped ? String(totals.skipped) : "-", 8, "right")}${col(
            seconds(shownDuration),
            8,
            "right",
        )}`,
    )
    console.log(rule)

    const total = totals.passed + totals.failed + totals.skipped
    console.log("")
    if (totals.failed > 0 || crashed.length) {
        console.log(
            `  ❌ ${totals.failed} 项失败（共 ${total} 项），用时 ${seconds(shownDuration)}${
                crashed.length
                    ? `；套件异常退出：${crashed.map((r) => `${r.suite.title}(exit ${r.code})`).join("、")}`
                    : ""
            }`,
        )
    } else if (skippedSuites.length) {
        console.log(
            `  ⚠ 已运行部分全部通过：${totals.passed}/${total} 项，用时 ${seconds(
                shownDuration,
            )}；还有 ${skippedSuites.length} 个套件未运行`,
        )
        console.log(`     未运行：${skippedSuites.map((s) => s.title).join("、")}`)
    } else {
        console.log(
            `  ✅ 全部通过：${totals.passed}/${total} 项${
                totals.skipped ? `（跳过 ${totals.skipped} 项）` : ""
            }，用时 ${seconds(shownDuration)}`,
        )
    }
    console.log("")

    process.exitCode = totals.failed > 0 || skippedSuites.length > 0 || crashed.length > 0 ? 1 : 0
}

main().catch((error) => {
    console.error(`运行器异常：${error.stack}`)
    process.exitCode = 1
})
