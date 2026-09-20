const { test } = require("node:test")
const assert = require("node:assert/strict")
const { commitProject } = require("./_runtime.cjs")

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
