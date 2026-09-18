#!/usr/bin/env node
"use strict"

/**
 * 统一测试入口：分套件运行、实时进度、分类统计。
 *
 *   npm run test:all              # 默认：预统计总条数 + 进度 + 分类汇总
 *   npm run test:all -- --verbose # 透传原始 TAP 输出（排查单条用例时用）
 *   npm run test:all -- --no-count# 跳过预统计（省几秒，进度条不显示总数）
 *   npm run test:all -- --progress# 非 TTY 环境也强制刷新进度行
 *
 * 退出码：任一用例失败或套件异常退出即为 1。
 */

const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")

const ROOT = path.resolve(__dirname, "..")
const argv = new Set(process.argv.slice(2))
const VERBOSE = argv.has("--verbose")
const SKIP_COUNT = argv.has("--no-count")
const PROGRESS = process.stdout.isTTY || argv.has("--progress")

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

function runSuite(files, extraArgs, onLine) {
    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            ["--test", "--test-reporter=tap", ...extraArgs, ...files],
            { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
        )
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

    // 预统计：用 --test-name-pattern 快速枚举用例数（跳过测试体，只加载测试文件）
    let planned = 0
    if (!SKIP_COUNT) {
        process.stdout.write("  正在统计用例总数 …\r")
        for (const suite of runnable) {
            suite.expected = await countTests(suite.files)
            planned += suite.expected
        }
        process.stdout.write(" ".repeat(40) + "\r")
    }

    const results = []
    for (let index = 0; index < runnable.length; index += 1) {
        const suite = runnable[index]
        const label = `[${index + 1}/${runnable.length}] ${suite.title}`
        const startedAt = Date.now()
        let passed = 0
        let failed = 0
        let skipped = 0
        let capture = false
        let current = null
        let writing = false
        const failures = []
        const rawLines = []

        console.log(
            `  ▶ ${label}${suite.expected ? `  （共 ${suite.expected} 项）` : ""}`,
        )

        const renderProgress = () => {
            if (!PROGRESS || VERBOSE || writing) return
            const done = passed + failed + skipped
            const total = suite.expected || 0
            const ratio = total ? Math.min(1, done / total) : 0
            const barWidth = 20
            const filled = Math.round(ratio * barWidth)
            const bar = `${"█".repeat(filled)}${"░".repeat(barWidth - filled)}`
            const bits = [
                `      ${bar}`,
                total ? `${done}/${total}` : `${done} 项`,
                failed ? `失败 ${failed}` : "",
                seconds(Date.now() - startedAt),
            ].filter(Boolean)
            writing = true
            process.stdout.write(`\r${pad(bits.join("   "), 78)}`, () => {
                writing = false
            })
        }

        await runSuite(suite.files, [], (line) => {
            rawLines.push(line)
            if (VERBOSE) console.log(`    ${line}`)
            if (/^(ok|not ok) \d+ - /.test(line)) {
                if (line.startsWith("not ok")) {
                    failed += 1
                    current = { name: line.replace(/^not ok \d+ - /, ""), lines: [] }
                    failures.push(current)
                    capture = true
                } else if (/# (SKIP|TODO)/.test(line)) {
                    skipped += 1
                } else {
                    passed += 1
                }
                renderProgress()
                return
            }
            if (capture && current) {
                if (line.trim() === "...") {
                    capture = false
                } else {
                    current.lines.push(line)
                }
            }
        })

        if (PROGRESS && !VERBOSE) process.stdout.write("\r" + " ".repeat(78) + "\r")
        const duration = Date.now() - startedAt
        results.push({ ...suite, passed, failed, skipped, duration, failures, rawLines })
        console.log(
            `     ${failed ? "✖" : "✓"} 通过 ${passed}${failed ? ` / 失败 ${failed}` : ""}${
                skipped ? ` / 跳过 ${skipped}` : ""
            }  ·  ${seconds(duration)}`,
        )
        console.log("")
    }

    // --- 失败详情 ---
    const allFailures = results.flatMap((r) => r.failures.map((f) => ({ suite: r.title, ...f })))
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
    const totals = results.reduce(
        (acc, r) => ({
            passed: acc.passed + r.passed,
            failed: acc.failed + r.failed,
            skipped: acc.skipped + r.skipped,
            duration: acc.duration + r.duration,
        }),
        { passed: 0, failed: 0, skipped: 0, duration: 0 },
    )

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
            `  ${col(r.title, widthTitle)}${col(String(r.passed), 8, "right")}${col(
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
        `  ${col("合计", widthTitle)}${col(String(totals.passed), 8, "right")}${col(
            String(totals.failed),
            8,
            "right",
        )}${col(totals.skipped ? String(totals.skipped) : "-", 8, "right")}${col(
            seconds(totals.duration),
            8,
            "right",
        )}`,
    )
    console.log(rule)

    const total = totals.passed + totals.failed + totals.skipped
    console.log("")
    if (totals.failed > 0) {
        console.log(`  ❌ ${totals.failed} 项失败（共 ${total} 项），用时 ${seconds(totals.duration)}`)
    } else if (skippedSuites.length) {
        console.log(
            `  ⚠ 已运行部分全部通过：${totals.passed}/${total} 项，用时 ${seconds(
                totals.duration,
            )}；还有 ${skippedSuites.length} 个套件未运行`,
        )
        console.log(`     未运行：${skippedSuites.map((s) => s.title).join("、")}`)
    } else {
        console.log(
            `  ✅ 全部通过：${totals.passed}/${total} 项${
                totals.skipped ? `（跳过 ${totals.skipped} 项）` : ""
            }，用时 ${seconds(totals.duration)}`,
        )
    }
    console.log("")

    process.exitCode = totals.failed > 0 || skippedSuites.length > 0 ? 1 : 0
}

main().catch((error) => {
    console.error(`运行器异常：${error.stack}`)
    process.exitCode = 1
})
