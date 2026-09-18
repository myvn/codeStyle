const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const {
    root, runtime, copy, localRequire, prettier, eslint, commitProject,
} = require("./_runtime.cjs")

test("部分暂存：仅提交暂存内容，保留工作区修改和未跟踪文件", (t) => {
    const p = commitProject(t)
    const name = "src/partial.js"
    const staged =
        'export const first="staged";\n' +
        "// unchanged context\n".repeat(12) +
        'export const last = "base"\n'
    p.write(name, staged)
    p.git("add", "--", name)
    p.write(name, staged.replace('last = "base"', 'last = "UNSTAGED_ONLY"'))
    p.write("src/untracked.js", "const = UNTRACKED_ONLY\n")
    const result = p.commit()
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const committed = p.git("show", `HEAD:${name}`)
    assert.ok(committed.includes('first = "staged"'))
    assert.ok(!committed.includes("UNSTAGED_ONLY"))
    assert.ok(p.read(name).includes("UNSTAGED_ONLY"))
    assert.ok(p.git("diff", "--", name).includes("UNSTAGED_ONLY"))
    assert.equal(p.git("ls-files", "src/untracked.js"), "")
    assert.equal(p.read("src/untracked.js"), "const = UNTRACKED_ONLY\n")
    assert.equal(p.git("diff", "--cached"), "")
    assert.equal(p.git("stash", "list"), "")
})

test("部分暂存检查失败：暂存区与未暂存内容均保持原样", (t) => {
    const p = commitProject(t)
    p.write("src/bad.ts", "const count: = ;\n")
    p.git("add", "--", "src/bad.ts")
    p.write("src/bad.ts", "const count: = ;\n// UNSTAGED_ONLY\n")
    const staged = p.git("diff", "--cached", "--binary")
    const unstaged = p.git("diff", "--binary")
    const head = p.git("rev-parse", "HEAD")
    const result = p.commit()
    assert.notEqual(result.status, 0)
    assert.equal(p.git("rev-parse", "HEAD"), head)
    assert.equal(p.git("diff", "--cached", "--binary"), staged)
    assert.equal(p.git("diff", "--binary"), unstaged)
    assert.equal(p.git("stash", "list"), "")
})

test("完整链路：代码检查通过后非法提交信息仍被拒绝", (t) => {
    const p = commitProject(t)
    p.write("src/good.js", 'export const good = "hello"\n')
    p.git("add", "--", "src/good.js")
    const head = p.git("rev-parse", "HEAD")
    const result = p.commit("invalid: do not allow this")
    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /type-enum/)
    assert.equal(p.git("rev-parse", "HEAD"), head)
    assert.equal(p.git("show", ":src/good.js"), p.read("src/good.js"))
})

test("部分暂存与格式化发生冲突时安全退出，不丢失原始修改", (t) => {
    const p = commitProject(t)
    const name = "src/conflict.js"
    const stagedSource =
        'export const first="staged";\n' + "\n".repeat(12) + 'export const last="base";\n'
    p.write(name, stagedSource)
    p.git("add", "--", name)
    const worktree = stagedSource.replace('last="base"', 'last="UNSTAGED_ONLY"')
    p.write(name, worktree)
    const head = p.git("rev-parse", "HEAD")
    const staged = p.git("diff", "--cached", "--binary")
    const result = p.commit()
    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /Unstaged changes could not be restored/)
    assert.equal(p.git("rev-parse", "HEAD"), head)
    assert.equal(p.git("diff", "--cached", "--binary"), staged)
    assert.equal(p.read(name), worktree)
})

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

test("完整提交链：首次提交（无 HEAD 的全新仓库）通过 hooks 校验", (t) => {
    const dir = fs.mkdtempSync(path.join(runtime, "unborn-head-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const env = { ...process.env, HUSKY: "1", GIT_CONFIG_NOSYSTEM: "1" }
    const run = (cmd, args) =>
        spawnSync(cmd, args, { cwd: dir, encoding: "utf8", timeout: 60000, env })

    run("git", ["init", "-q", "-b", "main"])
    run("git", ["config", "user.name", "Demo Test"])
    run("git", ["config", "user.email", "demo@example.invalid"])
    run("git", ["config", "commit.gpgsign", "false"])

    // DO NOT commit baseline - repository has NO HEAD yet!
    fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "unborn-fixture", devDependencies: { eslint: "^9" } }),
    )
    const initRes = run(process.execPath, [path.join(root, "bin/init")])
    assert.equal(initRes.status, 0, initRes.stderr)
    const huskyRes = run(process.execPath, [
        path.join(path.dirname(localRequire.resolve("husky")), "bin.js"),
    ])
    assert.equal(huskyRes.status, 0, huskyRes.stderr)

    // Write valid file and stage it
    fs.mkdirSync(path.join(dir, "src"), { recursive: true })
    fs.writeFileSync(path.join(dir, "src/index.ts"), 'export const hello = "world"\n')
    run("git", ["add", "."])

    // First commit with valid conventional commit message
    const commitRes = run("git", ["commit", "-m", "feat: initial commit on empty repo"])
    assert.equal(commitRes.status, 0, commitRes.stdout + commitRes.stderr)

    // Verify HEAD is now established
    const logRes = run("git", ["log", "-1", "--oneline"])
    assert.match(logRes.stdout, /feat: initial commit on empty repo/)
})

test("完整提交链：已有用户 git stash 在提交过程中得到保留", (t) => {
    const p = commitProject(t)
    // Create an existing stash before doing new work
    p.write("src/stash-target.txt", "user WIP content before stash\n")
    p.git("add", "src/stash-target.txt")
    p.git("stash", "push", "-m", "user-existing-stash")

    const stashListBefore = p.git("stash", "list")
    assert.match(stashListBefore, /user-existing-stash/)

    // Now stage a new file and commit
    p.write("src/staged.ts", "const x: number = 1\nconsole.log(x)\n")
    p.git("add", "src/staged.ts")
    const commitRes = p.commit("feat: new commit with active stash")
    assert.equal(commitRes.status, 0, commitRes.stdout + commitRes.stderr)

    // Verify user stash is still intact
    const stashListAfter = p.git("stash", "list")
    assert.match(stashListAfter, /user-existing-stash/)
    assert.equal(stashListBefore.trim(), stashListAfter.trim())
})

test("完整提交链：文件重命名 (git mv) 与删除 (git rm) 正常通过 lint-staged", (t) => {
    const p = commitProject(t)
    // Create and commit initial files
    p.write("src/old-file.ts", "export const oldVal: number = 1\n")
    p.write("src/to-delete.ts", "export const toDelete: number = 2\n")
    p.git("add", "src/old-file.ts", "src/to-delete.ts")
    const initCommit = p.commit("feat: add files to rename and delete")
    assert.equal(initCommit.status, 0, initCommit.stdout + initCommit.stderr)

    // Git rm to-delete.ts
    p.git("rm", "src/to-delete.ts")

    // Git mv old-file.ts to new-file.ts
    p.git("mv", "src/old-file.ts", "src/new-file.ts")

    // Commit changes
    const commitRes = p.commit("refactor: rename and delete files")
    assert.equal(commitRes.status, 0, commitRes.stdout + commitRes.stderr)

    // Verify git log and status
    assert.ok(!fs.existsSync(path.join(p.dir, "src/to-delete.ts")))
    assert.ok(fs.existsSync(path.join(p.dir, "src/new-file.ts")))
    const status = p.git("status", "--porcelain", "-uno")
    assert.equal(status.trim(), "")
    assert.equal(p.git("diff", "HEAD").trim(), "")
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
