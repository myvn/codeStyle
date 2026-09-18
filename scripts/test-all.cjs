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
 *   npm run test:all -- --concurrency=8  # 套件内同时跑几个测试文件（默认按核数与内存自动算）
 *   npm run test:all -- --suite=integration  # 只跑指定套件（base / integration / legacy）
 *   npm run test:all -- --profile        # 额外列出每个测试文件的耗时
 *   npm run test:all -- --verbose        # 透传原始 TAP 输出（排查单条用例时用）
 *   npm run test:all -- --no-count       # 跳过预统计（省几秒，进度条不显示总数）
 *   npm run test:all -- --progress       # 非 TTY 环境也强制刷新进度
 *
 * 并发由本运行器自己调度，不依赖 Node 的默认值：
 * - 文件级（套件内）：每个测试文件一个进程，并发上限 = 核数 × 1.5 与内存上限取小值，
 *   单用例文件（一条真实提交链）优先开跑；
 * - 套件级：三个套件互不共享目录，核数 ≥ 8 时自动并行。
 * 套件内的重活（真实 git commit + lint-staged 全链路）都在同一个文件里串行，所以让
 * 文件尽量"一件事一个文件"，墙钟时间就等于最慢的那个文件。
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
const PROFILE = argv.has("--profile")
const SKIP_COUNT = argv.has("--no-count")
const PROGRESS = process.stdout.isTTY || argv.has("--progress")

const CORES = os.cpus().length
const FORCE_PARALLEL = argv.has("--parallel") || argv.has("-p")
const FORCE_SERIAL = argv.has("--serial")
// 核多的机器上并行几乎总是更快（套件之间不共享目录），因此默认自动开启；
// CI/低核机器保持串行，输出与历史行为一致。
const PARALLEL = FORCE_SERIAL ? false : FORCE_PARALLEL || CORES >= 8
const PARALLEL_AUTO = PARALLEL && !FORCE_PARALLEL

// --suite=integration（可逗号分隔）：只跑指定套件，便于单独计时/调并发
const suiteArg = process.argv.slice(2).find((arg) => arg.startsWith("--suite="))
const SUITE_FILTER = suiteArg
    ? suiteArg
          .split("=")[1]
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
    : null

const jobsArg = process.argv.slice(2).find((arg) => arg.startsWith("--jobs="))
const JOBS = jobsArg ? Math.max(1, Number.parseInt(jobsArg.split("=")[1], 10) || 1) : Infinity

// 套件内的文件级并发。默认不让 Node 决定（Node 的 --test 文件级并发默认是 CPU-1，
// 在文件数多于核数时会把"最慢文件"挤到第二波，墙钟直接翻倍），而是由本运行器算：
// 核数 × 1.5（至少 核数 - 1），再乘内存上限——实测一条真实提交链（git + npx +
// eslint/prettier）峰值 RSS 约 0.8GB，留 30% 给系统，避免小内存机器被并发的
// git/npx 撑到 OOM（进程被 SIGKILL）。
const MEM_PER_CHAIN_GB = 0.8
const MEM_RESERVE = 0.3
const TOTAL_MEM_GB = os.totalmem() / 1024 ** 3
/** 默认文件级并发：核数 × 1.5（至少 核数 - 1）与内存上限取小值 */
function computeFileJobs(cpus, totalMemGB) {
    const coreSlots = Math.max(1, cpus - 1, Math.round(cpus * 1.5))
    const memSlots = Math.max(1, Math.floor((totalMemGB * (1 - MEM_RESERVE)) / MEM_PER_CHAIN_GB))
    return Math.min(coreSlots, memSlots)
}

const concurrencyArg = process.argv.slice(2).find((arg) => arg.startsWith("--concurrency="))
const FILE_JOBS = concurrencyArg
    ? Math.max(1, Number.parseInt(concurrencyArg.split("=")[1], 10) || 1)
    : computeFileJobs(CORES, TOTAL_MEM_GB)
const FILE_JOBS_AUTO = !concurrencyArg

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
        state.failed ? `失败 ${failed0(state)}` : "",
        elapsed,
    ].filter(Boolean)
    return pad(bits.join("   "), width)
}

const failed0 = (state) => state.failed

/** 用例明细行：✓/✗/○ + 名称 + 耗时 */
function caseLine(item) {
    const mark = item.status === "pass" ? "✓" : item.status === "fail" ? "✗" : "○"
    const note = item.status === "skip" ? "（跳过）" : ""
    return `      ${mark} ${item.name}${note}${formatDuration(item.duration)}`
}

function runFile(file, onLine) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, ["--test", "--test-reporter=tap", file], {
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

/**
 * TAP 解析（单个测试文件）：把用例写进 target，必要时实时打印
 * @param {{passed:number,failed:number,skipped:number,cases:Array,failures:Array}} target
 * @param {{live:boolean,fileTag?:string}} options
 */
function makeParser(target, options = {}) {
    let capture = false
    let current = null
    let openLine = false
    const verbose = options.verbose === undefined ? VERBOSE : Boolean(options.verbose)
    const live = Boolean(options.live) && !verbose && !QUIET

    const closeOpenLine = () => {
        if (openLine) {
            process.stdout.write("\n")
            openLine = false
        }
    }

    const onLine = (line) => {
        // --verbose 只是额外回显原始 TAP，统计照常做（否则汇总会变成 0/0）
        if (verbose) {
            console.log(options.fileTag ? `    [${options.fileTag}] ${line}` : `    ${line}`)
        }
        if (line.startsWith("    ")) line = line.slice(4)

        const match = /^(ok|not ok) \d+ - (.*)$/.exec(line)
        if (match) {
            closeOpenLine()
            const status =
                match[1] === "not ok" ? "fail" : /# (SKIP|TODO)/.test(match[2]) ? "skip" : "pass"
            const name = match[2].replace(/\s+#\s*(SKIP|TODO)\b.*$/, "").trim()
            const item = { name, status, duration: null, lines: [] }
            target.cases.push(item)
            current = item
            if (status === "fail") {
                target.failed += 1
                target.failures.push(item)
                capture = true
            } else if (status === "skip") {
                target.skipped += 1
            } else {
                target.passed += 1
            }
            if (live) {
                process.stdout.write(caseLine(item))
                openLine = true
            }
            return
        }

        const duration = /^\s*duration_ms:\s*([\d.]+)\s*$/.exec(line)
        if (duration && current && current.duration === null) {
            current.duration = Number.parseFloat(duration[1])
            if (live && openLine) {
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

    return { onLine, finish: closeOpenLine }
}

/** 跑一个测试文件，把结果并入套件状态 */
async function runOneFile(suiteState, file, liveCases) {
    const short = path.basename(file)
    const fileState = { passed: 0, failed: 0, skipped: 0, cases: [], failures: [] }
    const parser = makeParser(fileState, { live: liveCases, fileTag: short })
    const startedAt = Date.now()
    const { code } = await runFile(file, parser.onLine)
    parser.finish()
    const duration = Date.now() - startedAt
    const crashed = code !== 0 && fileState.failed === 0
    const record = { name: short, duration, crashed, code, ...fileState }
    suiteState.files.push(record)

    suiteState.passed += fileState.passed
    suiteState.failed += fileState.failed
    suiteState.skipped += fileState.skipped
    suiteState.cases.push(...fileState.cases)
    suiteState.failures.push(...fileState.failures)
    if (crashed) {
        suiteState.crashed = true
        suiteState.exitCodes.push(`${short} (exit ${code})`)
    }

    // 文件级并行时用例是缓存的，跑完一个文件就成块输出（串行模式已实时打印）
    if (!liveCases && !QUIET && !VERBOSE) {
        console.log(`      ▸ ${short} · ${fileState.passed + fileState.failed + fileState.skipped} 项 · ${seconds(duration)}`)
        for (const item of fileState.cases) console.log(caseLine(item))
    }
    if (VERBOSE) {
        console.log(`         · ${short} 完成（${seconds(duration)}，退出码 ${code}）`)
    }
    return record
}

/**
 * 以 FILE_JOBS 为并发上限，跑完套件里的所有文件。
 * 开跑顺序按「每文件用例数」升序：单用例文件几乎都是"一条完整提交链"（最耗时），
 * 先开跑可避免它们被排进最后一波，否则墙钟又要多乘一倍。
 */
async function runSuiteFiles(suiteState, liveCases) {
    const weight = (file) => {
        try {
            return (fs.readFileSync(file, "utf8").match(/^test\(/gm) || []).length || 1
        } catch {
            return 1
        }
    }
    const queue = [...suiteState.suite.files].sort(
        (a, b) => weight(a) - weight(b) || a.localeCompare(b),
    )
    const limit = Math.min(FILE_JOBS, queue.length)
    const workers = Array.from({ length: limit }, async () => {
        while (queue.length) {
            const file = queue.shift()
            await runOneFile(suiteState, file, liveCases)
        }
    })
    await Promise.all(workers)
}

// --- 渲染 ---

/** 套件结论行（串行/并行共用） */
function verdictLine(state) {
    const slowest =
        state.files.length > 1
            ? `   · 最慢文件 ${state.files.reduce((a, b) => (a.duration >= b.duration ? a : b)).name}` +
              ` ${seconds(state.files.reduce((a, b) => (a.duration >= b.duration ? a : b)).duration)}`
            : ""
    return `     ${state.failed || state.crashed ? "✖" : "✓"} 通过 ${state.passed}${
        state.failed ? ` / 失败 ${state.failed}` : ""
    }${state.crashed ? ` / 异常退出` : ""}${
        state.skipped ? ` / 跳过 ${state.skipped}` : ""
    }  ·  ${seconds(state.duration)}${slowest}`
}

/** --profile：列出每个测试文件的耗时（降序） */
function printProfile(state) {
    if (!PROFILE || state.files.length < 2) return
    const sorted = [...state.files].sort((a, b) => b.duration - a.duration)
    console.log(`      ── ${state.suite.title} 各文件耗时 ──`)
    for (const file of sorted) {
        const count = file.passed + file.failed + file.skipped
        console.log(
            `      ${pad(seconds(file.duration), 8, "right")}  ${pad(String(count), 3, "right")} 项  ${
                file.name
            }${file.crashed ? `  ✖ exit ${file.code}` : ""}`,
        )
    }
}

/** 并行模式下每个套件跑完后成块输出：结论 + 用例明细 */
function printSuiteBlock(state) {
    console.log(verdictLine(state))
    if (!QUIET && !VERBOSE && FILE_JOBS === 1) {
        // 串行模式：用例已在运行时实时打印，这里不再重复
    }
    printProfile(state)
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

function newSuiteState(suite, label) {
    return {
        suite,
        label,
        passed: 0,
        failed: 0,
        skipped: 0,
        cases: [],
        failures: [],
        files: [],
        exitCodes: [],
        startedAt: Date.now(),
        duration: 0,
        started: false,
        done: false,
        crashed: false,
    }
}

/** 串行模式下的单行进度（--quiet 时用） */
function quietProgress(state) {
    if (!PROGRESS || !QUIET) return
    process.stdout.write(`\r${pad(`      ${progressLine(state, 60)}`, 78)}`)
}

// --- 主流程 ---

async function main() {
    if (SUITE_FILTER) {
        const known = SUITES.map((suite) => suite.id)
        const unknown = SUITE_FILTER.filter((id) => !known.includes(id))
        if (unknown.length || SUITE_FILTER.length === 0) {
            console.error(`未知的套件：${unknown.join(", ") || "--suite= 为空"}`)
            console.error(`可用：${known.join(" / ")}`)
            process.exitCode = 1
            return
        }
    }
    const active = SUITE_FILTER ? SUITES.filter((suite) => SUITE_FILTER.includes(suite.id)) : SUITES
    const plan = active.map((suite) => {
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

    if (!SKIP_COUNT) {
        process.stdout.write("  正在统计用例总数 …\r")
        for (const suite of runnable) {
            suite.expected = await countTests(suite.files)
        }
        process.stdout.write(" ".repeat(40) + "\r")
    }

    const results = []
    const startedAt = Date.now()
    const fileInfo = `${FILE_JOBS} 文件并发${
        FILE_JOBS_AUTO
            ? `（自动：${CORES} 核 / 内存 ${TOTAL_MEM_GB.toFixed(0)}G）`
            : ""
    }`

    if (PARALLEL) {
        const limit = Math.min(JOBS, runnable.length)
        console.log(
            `  ▶ 并行运行 ${runnable.length} 个套件（同时 ${limit} 个，每个套件内 ${fileInfo}${
                PARALLEL_AUTO ? `；${CORES} 核自动启用，--serial 可关闭` : ""
            }）`,
        )
        const states = runnable.map((suite, index) =>
            newSuiteState(suite, `[${index + 1}/${runnable.length}] ${suite.title}`),
        )
        const queue = states.map((_, index) => index)
        const timer =
            PROGRESS && !VERBOSE
                ? setInterval(() => renderBoard(states), 1000)
                : null
        if (timer?.unref) timer.unref()
        renderBoard(states)

        const worker = async () => {
            while (queue.length) {
                const index = queue.shift()
                const state = states[index]
                state.started = true
                state.startedAt = Date.now()
                await runSuiteFiles(state, false)
                state.done = true
                state.duration = Date.now() - state.startedAt
                results[index] = state
                clearBoard()
                printSuiteBlock(state)
                renderBoard(states)
            }
        }
        await Promise.all(Array.from({ length: limit }, worker))
        if (timer) clearInterval(timer)
        clearBoard()
    } else {
        for (let index = 0; index < runnable.length; index += 1) {
            const suite = runnable[index]
            const state = newSuiteState(suite, `[${index + 1}/${runnable.length}] ${suite.title}`)
            state.started = true
            console.log(
                `  ▶ ${state.label}${suite.expected ? `  （共 ${suite.expected} 项，${suite.files.length} 文件 · ${fileInfo}）` : ""}`,
            )
            await runSuiteFiles(state, true)
            state.done = true
            state.duration = Date.now() - state.startedAt
            if (PROGRESS && QUIET) process.stdout.write("\r" + " ".repeat(78) + "\r")
            results[index] = state
            console.log(verdictLine(state))
            printProfile(state)
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
    const crashedSuites = results.filter((r) => r.crashed)
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
    for (const s of skippedSuites) {
        console.log(`  ${col(s.title, widthTitle)}${col("未运行", 8, "right")}`)
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

    // 最慢文件：多文件套件里，墙钟时间就等于最慢的那个文件，直接亮出来便于定位
    const slowest = results
        .flatMap((r) => r.files.map((f) => ({ suite: r.suite.title, ...f })))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
    if (slowest.length > 1) {
        console.log(
            `  ⏱ 最慢文件：${slowest
                .map((f) => `${f.name} ${seconds(f.duration)}`)
                .join(" · ")}`,
        )
        console.log("")
    }

    if (totals.failed > 0 || crashedSuites.length) {
        console.log(
            `  ❌ ${totals.failed} 项失败（共 ${total} 项），用时 ${seconds(shownDuration)}${
                crashedSuites.length
                    ? `；套件异常退出：${crashedSuites
                          .map((r) => `${r.suite.title}(${r.exitCodes.join("、")})`)
                          .join("；")}`
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

    process.exitCode = totals.failed > 0 || skippedSuites.length > 0 || crashedSuites.length > 0 ? 1 : 0
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`运行器异常：${error.stack}`)
        process.exitCode = 1
    })
}

module.exports = { makeParser, computeFileJobs, displayWidth, pad, formatDuration }
