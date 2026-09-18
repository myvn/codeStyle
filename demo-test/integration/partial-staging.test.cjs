const { test } = require("node:test")
const assert = require("node:assert/strict")
const { commitProject } = require("./_runtime.cjs")

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
