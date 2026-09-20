const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const {
    root, runtime, copy, localRequire, prettier, eslint, commitProject,
} = require("./_runtime.cjs")

// 发布前防呆脚本（package.json 的 release / release:push 第一步）
const guardScript = path.join(root, "scripts/release-guard.cjs")

test("所有支持的文件只匹配一个任务组，组件工具严格按序执行", (t) => {
    const micromatch = localRequire("micromatch")
    for (const style of ["scss", "less", "both"]) {
        const p = commitProject(t, style)
        const tasks = JSON.parse(p.read("package.json"))["lint-staged"]
        const exts =
            style === "both"
                ? [
                      "vue",
                      "nvue",
                      "js",
                      "ts",
                      "jsx",
                      "tsx",
                      "cjs",
                      "mjs",
                      "mts",
                      "cts",
                      "html",
                      "css",
                      "scss",
                      "less",
                      "json",
                      "json5",
                      "md",
                      "yml",
                      "yaml",
                  ]
                : [
                      "vue",
                      "nvue",
                      "js",
                      "ts",
                      "jsx",
                      "tsx",
                      "cjs",
                      "mjs",
                      "mts",
                      "cts",
                      "html",
                      "css",
                      style,
                      "json",
                      "json5",
                      "md",
                      "yml",
                      "yaml",
                  ]
        for (const ext of exts) {
            const matches = Object.keys(tasks).filter((pattern) =>
                micromatch.isMatch(`src/中文 空格/file.${ext}`, pattern),
            )
            assert.equal(matches.length, 1, `${style}/${ext}: ${matches}`)
        }
        assert.deepEqual(tasks["**/*.{vue,nvue}"], [
            "prettier --write",
            "eslint --fix",
            "stylelint --fix",
        ])
    }
})

test("standard-version 在 ESM (type: module) 项目中读取 .versionrc.cjs 成功生成版本与 CHANGELOG", (t) => {
    const dir = fs.mkdtempSync(path.join(runtime, "standard-version-esm-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: "utf8", timeout: 60000 })

    run("git", ["init", "-q", "-b", "main"])
    run("git", ["config", "user.name", "Demo Test"])
    run("git", ["config", "user.email", "demo@example.invalid"])
    run("git", ["config", "commit.gpgsign", "false"])

    // ESM package.json
    fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify(
            {
                name: "esm-release-consumer",
                version: "1.0.0",
                type: "module",
            },
            null,
            2,
        ),
    )

    // Use .versionrc.cjs referencing our local copy
    fs.writeFileSync(
        path.join(dir, ".versionrc.cjs"),
        `module.exports = require(${JSON.stringify(path.join(copy, "src/versionrc/index.cjs"))})\n`,
    )

    run("git", ["add", "."])
    const initCommit = run("git", ["commit", "-m", "feat: initial feature"])
    assert.equal(initCommit.status, 0)

    // Run standard-version binary from runtime
    const svBin = path.join(runtime, "node_modules/.bin/standard-version")
    const svRes = run(svBin, ["--skip.commit", "--skip.tag"])
    assert.equal(svRes.status, 0, svRes.stdout + svRes.stderr)

    // Verify bumped package.json and created CHANGELOG.md
    const updatedPkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    assert.equal(updatedPkg.version, "1.1.0")
    assert.ok(fs.existsSync(path.join(dir, "CHANGELOG.md")))
    const changelog = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8")
    assert.match(changelog, /1\.1\.0/)
    assert.match(changelog, /initial feature/)

    // Also verify that a .versionrc.js in an ESM project fails: standard-version
    // loads the config with require(), but the file is treated as an ES module.
    // The error text depends on the Node version, so assert on the cause:
    //   Node 18        → ERR_REQUIRE_ESM (require() of ESM is not supported)
    //   Node ≥20.19/22 → require(esm) is allowed, evaluation fails with
    //                    "module is not defined in ES module scope"
    fs.unlinkSync(path.join(dir, ".versionrc.cjs"))
    fs.writeFileSync(
        path.join(dir, ".versionrc.js"),
        `module.exports = require(${JSON.stringify(path.join(copy, "src/versionrc/index.cjs"))})\n`,
    )
    const svFailRes = run(svBin, ["--dry-run"])
    assert.notEqual(svFailRes.status, 0)
    assert.match(svFailRes.stderr, /\.versionrc\.js/, svFailRes.stderr)
    assert.match(
        svFailRes.stderr,
        /ERR_REQUIRE_ESM|module is not defined in ES module scope/,
        `ESM 项目中的 .versionrc.js 应加载失败，实际输出：${svFailRes.stderr}`,
    )
})

/** 建一个干净的临时发布仓库（已提交一次 feat），用于发布防呆脚本的黑盒验证。 */
function releaseFixture(t) {
    const dir = fs.mkdtempSync(path.join(runtime, "release-guard-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: "utf8", timeout: 60000 })

    run("git", ["init", "-q", "-b", "main"])
    run("git", ["config", "user.name", "Demo Test"])
    run("git", ["config", "user.email", "demo@example.invalid"])
    run("git", ["config", "commit.gpgsign", "false"])
    fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "release-fixture", version: "1.0.0" }, null, 2),
    )
    run("git", ["add", "."])
    const commit = run("git", ["commit", "-q", "-m", "feat: initial feature"])
    assert.equal(commit.status, 0, commit.stdout + commit.stderr)
    return { dir, run }
}

test("发布防呆：干净的发布点放行，未跟踪文件不阻断（它们不会进版本提交）", (t) => {
    const { dir, run } = releaseFixture(t)
    fs.writeFileSync(path.join(dir, "notes.tmp"), "未跟踪的临时文件\n")

    const res = run("node", [guardScript])
    assert.equal(res.status, 0, res.stdout + res.stderr)
    assert.match(res.stdout, /发布前检查通过/)
})

test("发布防呆：已跟踪文件未提交时拦截，避免被卷进版本提交", (t) => {
    const { dir, run } = releaseFixture(t)
    fs.appendFileSync(path.join(dir, "package.json"), "\n")

    const res = run("node", [guardScript])
    assert.notEqual(res.status, 0)
    assert.match(res.stderr, /已跟踪文件还没提交/)
    assert.match(res.stderr, /package\.json/)
    assert.match(res.stderr, /git commit/)
})

test("发布防呆：HEAD 已有 v* tag 时拦截（此时 standard-version 会静默抬版并写出空 CHANGELOG）", (t) => {
    const { dir, run } = releaseFixture(t)
    run("git", ["tag", "-a", "v1.0.0", "-m", "chore(release): 1.0.0"])

    const res = run("node", [guardScript])
    assert.notEqual(res.status, 0)
    assert.match(res.stderr, /已经打过版本 tag/)
    assert.match(res.stderr, /v1\.0\.0/)
    assert.match(res.stderr, /git push --follow-tags origin main/)

    // 反证：没有防呆时 standard-version 退出码为 0，却把版本抬到 1.0.1 并生成空 CHANGELOG 段
    const svBin = path.join(runtime, "node_modules/.bin/standard-version")
    const dry = run(svBin, ["--dry-run"])
    assert.equal(dry.status, 0, dry.stdout + dry.stderr)
    assert.match(dry.stdout, /bumping version in package\.json from 1\.0\.0 to 1\.0\.1/)
    assert.match(dry.stdout, /### \[1\.0\.1\]/)
    assert.doesNotMatch(dry.stdout, /^\* /m, `CHANGELOG 段应为空：\n${dry.stdout}`)
})

test("发布防呆：tag 打在历史提交上（其后有新提交）时放行，不误拦正常发布", (t) => {
    const { dir, run } = releaseFixture(t)
    run("git", ["tag", "-a", "v1.0.0", "-m", "chore(release): 1.0.0"])
    fs.writeFileSync(path.join(dir, "feature.js"), "export const answer = 42\n")
    run("git", ["add", "."])
    const commit = run("git", ["commit", "-q", "-m", "feat: second feature"])
    assert.equal(commit.status, 0, commit.stdout + commit.stderr)

    const res = run("node", [guardScript])
    assert.equal(res.status, 0, res.stdout + res.stderr)
    assert.match(res.stdout, /发布前检查通过/)
})
