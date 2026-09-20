const { test } = require("node:test")
const assert = require("node:assert/strict")
const { prettier, eslint, commitProject } = require("./_runtime.cjs")

const style = "scss"

// 空提交守卫：把「未格式化的原文」再暂存一次，lint-staged 修复后的结果与 HEAD 相同，
// 此时 git 必须报「空提交」而不是生成内容漂移的提交。
test("完整提交链：重复暂存同样内容被空提交拦下", (t) => {
    const p = commitProject(t, style)
    const name = "src/demo.ts"
    const original = "const count:number=1;console.log(count);\n"
    p.write(name, original)
    p.git("add", "--", "src")
    const first = p.commit()
    assert.equal(first.status, 0, first.stdout + first.stderr)
    const committed = p.git("show", `HEAD:${name}`)
    assert.notEqual(committed, original, "首次提交应被 prettier/eslint 修复")
    assert.equal(p.read(name), committed)

    const head = p.git("rev-parse", "HEAD")
    p.write(name, original)
    p.git("add", "--", "src")
    const again = p.commit()
    assert.notEqual(again.status, 0)
    assert.match(again.stdout + again.stderr, /empty (?:git )?commit/i)
    assert.equal(p.git("rev-parse", "HEAD"), head)
})
