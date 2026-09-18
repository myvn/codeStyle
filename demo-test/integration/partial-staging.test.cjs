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
