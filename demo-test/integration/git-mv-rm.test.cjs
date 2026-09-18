const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { commitProject } = require("./_runtime.cjs")

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
