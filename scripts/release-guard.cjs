#!/usr/bin/env node
"use strict"

/**
 * 发布前防呆：`npm run release` / `npm run release:push` 的第一步。
 *
 * 为什么需要它：
 * standard-version 在「HEAD 已经打过 v* tag、之后没有任何新提交」时不会报错，而是把
 * 版本号再抬一级、写出一段没有条目的空 CHANGELOG，然后照常提交 + 打 tag。实测
 * （standard-version 9.5.0，tag 打在 HEAD 上）：1.0.0 → 1.0.1，CHANGELOG 只有标题行，
 * 退出码 0，只是多了一句 "Run git push --follow-tags"。所以「先 `npm run release`、
 * 再 `npm run release:push`」这种顺序会额外产出一个空版本；已经发到 npm 的版本不可撤销。
 *
 * 三项只读检查（任一失败即中止，不修改任何文件）：
 *   1. 当前目录在 git 工作区内（版本提交与 tag 都依赖 git）；
 *   2. 已跟踪文件没有未提交改动（standard-version 会把它们卷进版本提交）；
 *   3. HEAD 没有被 v* tag 命中（命中说明这一版的 tag 已经生成，只差推送）。
 *
 * 未跟踪文件不拦截：它们不会进入版本提交，阻止发布只会碍事。
 */

const { spawnSync } = require("node:child_process")

function git(args) {
    const result = spawnSync("git", args, { encoding: "utf8" })
    if (result.error) {
        abort([`- 无法执行 git：${result.error.message}`])
    }
    return result
}

function abort(lines) {
    process.stderr.write(`\n✖ 发布中止\n\n${lines.join("\n")}\n\n`)
    process.exit(1)
}

const inside = git(["rev-parse", "--is-inside-work-tree"])
if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    abort(["- 当前目录不在 git 工作区内：发布要用 git 生成版本提交与 tag。"])
}

const dirty = git(["status", "--porcelain", "--untracked-files=no"])
    .stdout.split("\n")
    .filter((line) => line.trim() !== "")

if (dirty.length > 0) {
    // porcelain 前两列是状态码（首行可能带前导空格），统一重排成 "XY 路径" 保证对齐
    const shown = dirty
        .slice(0, 10)
        .map((line) => `      ${line.slice(0, 2).trim().padEnd(2)} ${line.slice(3)}`)
    if (dirty.length > shown.length) {
        shown.push(`      …另有 ${dirty.length - shown.length} 个`)
    }
    abort([
        `- 有 ${dirty.length} 个已跟踪文件还没提交：`,
        ...shown,
        "  standard-version 会把它们一起卷进版本提交里，请先 `git commit` 或 `git stash`。",
    ])
}

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim()
const head = git(["rev-parse", "--short", "HEAD"]).stdout.trim()
const tagsAtHead = git(["tag", "--points-at", "HEAD"])
    .stdout.split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+/.test(tag))

if (tagsAtHead.length > 0) {
    abort([
        `- HEAD（${head}）已经打过版本 tag：${tagsAtHead.join("、")}`,
        "  此时再跑 standard-version 不会报错，而是把版本号再抬一级、写出一个没有条目的空 CHANGELOG，",
        "  并打出第二个 tag —— 等于多发一个空版本（npm 上不可撤销）。",
        "  如果只是刚跑完 `npm run release`、还没推送，直接推 tag 即可：",
        `      git push --follow-tags origin ${branch}`,
        "  如果确实要再发一版，请先提交新的改动（feat / fix 等）再执行发布命令。",
    ])
}

process.stdout.write(
    `✔ 发布前检查通过：分支 ${branch} · HEAD ${head} · 无未提交改动 · HEAD 无版本 tag\n`,
)
