#!/usr/bin/env node
"use strict"

/**
 * 并发扫描：给"本机"找最佳的文件级并发数，并顺带验证并行到底有没有收益。
 *
 *   npm run sweep                              # 扫 integration 套件：auto,1,2,4,6,8,12,16,24
 *   npm run sweep -- --suite=base              # 换套件
 *   npm run sweep -- --levels=1,4,8,auto       # 自定义档位（auto = 让运行器自动算）
 *
 * 每个档位单独跑一次（串行套件，避免套件级并行干扰），打印墙钟时间与套件自身用时。
 * 如果"并发越高越慢"，说明瓶颈是进程启动/IO 而不是 CPU，应该把 `--concurrency` 调低。
 */

const path = require("node:path")
const { spawnSync } = require("node:child_process")

const ROOT = path.resolve(__dirname, "..")
const argv = process.argv.slice(2)
const pick = (name, fallback) => {
    const found = argv.find((arg) => arg.startsWith(`--${name}=`))
    return found ? found.split("=")[1] : fallback
}

const suite = pick("suite", "integration")
const levels = pick("levels", "auto,1,2,4,6,8,12,16,24")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

console.log("")
console.log(`  并发扫描：套件 ${suite}（每个档位单独跑一次）`)
console.log("")

const rows = []
for (const level of levels) {
    const args = ["scripts/test-all.cjs", `--suite=${suite}`, "--serial", "--quiet", "--no-count"]
    if (level !== "auto") args.push(`--concurrency=${level}`)
    const started = Date.now()
    const result = spawnSync(process.execPath, args, {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 60 * 60 * 1000,
    })
    const wall = (Date.now() - started) / 1000
    const suiteTime = Number.parseFloat(
        /✓ 通过 \d+\s+·\s+([\d.]+)s/.exec(result.stdout || "")?.[1] ?? "",
    )
    const failed = /❌/.test(result.stdout || "")
    rows.push({ level, wall, suiteTime, ok: result.status === 0, failed })
    console.log(
        `  ${level.padStart(4)} 并发  墙钟 ${wall.toFixed(1)}s   ·   套件内用时 ${
            Number.isFinite(suiteTime) ? `${suiteTime.toFixed(1)}s` : "?"
        }${result.status === 0 ? "" : "   ← 失败/异常退出"}`,
    )
    if (failed) {
        console.log("         （有失败用例，这一档的数据不可作准）")
    }
}

console.log("")
console.log("  ────────────────────────────────────────")
const usable = rows.filter((row) => row.ok && !row.failed)
if (!usable.length) {
    console.log("  全部档位都有失败，先修失败再看并发。")
} else {
    const best = usable.reduce((a, b) => (a.wall <= b.wall ? a : b))
    console.log(`  最快：${best.level} 并发 → ${best.wall.toFixed(1)}s`)
    const slowest = usable.reduce((a, b) => (a.wall >= b.wall ? a : b))
    if (slowest.level !== best.level) {
        console.log(`  最慢：${slowest.level} 并发 → ${slowest.wall.toFixed(1)}s`)
        console.log("")
        console.log(
            `  建议：把 npm run test:all 的默认并发设为 --concurrency=${best.level}（或写进 CI/别名）。`,
        )
    }
}
console.log("")
