const { test } = require("node:test")
const assert = require("node:assert/strict")
const { commitProject } = require("./_runtime.cjs")

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
