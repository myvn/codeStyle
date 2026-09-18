const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const {
    root, runtime, localRequire, eslint, commitProject,
} = require("./_runtime.cjs")

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
