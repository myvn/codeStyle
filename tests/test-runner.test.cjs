const { test } = require("node:test")
const assert = require("node:assert/strict")

const { makeParser, computeFileJobs, displayWidth, pad, formatDuration } = require(
    "../scripts/test-all.cjs",
)

/** 一段真实形态的 TAP 片段：通过与失败用例、SKIP、duration_ms、失败详情块 */
const TAP = [
    "TAP version 13",
    "# Subtest: 完整提交链：示例",
    "ok 1 - 完整提交链：示例",
    "  ---",
    "  duration_ms: 1234.5",
    "  ...",
    "ok 2 - ESLint 正常文件：base (demo.ts) # SKIP 依赖缺失",
    "  ---",
    "  duration_ms: 12",
    "  ...",
    "not ok 3 - 临时失败用例 A",
    "  ---",
    "  duration_ms: 7",
    "  failureType: 'testCodeFailure'",
    "  error: 'expected 1 to equal 2'",
    "  code: 'ERR_TEST_FAILURE'",
    "  ...",
    "1..3",
]

function parse(lines, options) {
    const target = { passed: 0, failed: 0, skipped: 0, cases: [], failures: [] }
    const parser = makeParser(target, options)
    for (const line of lines) parser.onLine(line)
    parser.finish()
    return target
}

test("运行器 TAP 解析：统计通过与失败、SKIP 与每用例耗时", () => {
    const target = parse(TAP, { verbose: false })
    assert.equal(target.passed, 1)
    assert.equal(target.skipped, 1)
    assert.equal(target.failed, 1)
    assert.deepEqual(
        target.cases.map((c) => [c.name, c.status, c.duration]),
        [
            ["完整提交链：示例", "pass", 1234.5],
            ["ESLint 正常文件：base (demo.ts)", "skip", 12],
            ["临时失败用例 A", "fail", 7],
        ],
    )
    // 失败详情要留到汇总区展示
    assert.equal(target.failures.length, 1)
    assert.ok(target.failures[0].lines.join("\n").includes("expected 1 to equal 2"))
})

test("运行器 TAP 解析：--verbose 回显原始输出时统计不能归零", () => {
    const target = parse(TAP, { verbose: true })
    assert.equal(target.passed, 1)
    assert.equal(target.skipped, 1)
    assert.equal(target.failed, 1)
    assert.equal(target.cases.length, 3)
})

test("运行器默认文件级并发：受核数与内存双重约束", () => {
    assert.equal(computeFileJobs(2, 3.8), 3, "2 核 4G：内存与核数都只能开 3")
    assert.equal(computeFileJobs(16, 48), 24, "16 核 48G：放开到核数 × 1.5")
    assert.equal(computeFileJobs(4, 16), 6, "4 核 CI：放开到核数 × 1.5")
    assert.equal(computeFileJobs(8, 4), 3, "8 核但只有 4G：被内存上限压回 3，避免 OOM")
})

test("运行器表格：CJK 宽度按两列计算，耗时格式化区分秒与毫秒", () => {
    assert.equal(displayWidth("套件"), 4)
    assert.equal(displayWidth("ESLint 8"), 8)
    assert.equal(pad("套件", 6), "套件  ")
    assert.equal(pad("66", 4, "right"), "  66")
    assert.equal(formatDuration(950), " · 950ms")
    assert.equal(formatDuration(1234), " · 1.2s")
})
