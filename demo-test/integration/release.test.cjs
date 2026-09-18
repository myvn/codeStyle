const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const {
    runtime, copy, localRequire, prettier, eslint, commitProject,
} = require("./_runtime.cjs")

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
