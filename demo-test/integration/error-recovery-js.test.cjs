const { test } = require("node:test")
const assert = require("node:assert/strict")
const { prettier, eslint, commitProject } = require("./_runtime.cjs")

for (const [name, source] of [["src/bad.js", "const = ;\n"]]) {
    test(`完整提交链拒绝不可修复错误且恢复修改：${name}`, (t) => {
        const p = commitProject(t, name.endsWith("less") ? "less" : "scss")
        p.write(name, source)
        p.write("src/good.js", "const good='needs format';console.log(good);\n")
        p.git("add", "--", "src")
        const head = p.git("rev-parse", "HEAD")
        const staged = p.git("diff", "--cached", "--binary")
        const good = p.read("src/good.js")
        const result = p.commit()
        assert.notEqual(result.status, 0)
        assert.match(result.stdout + result.stderr, /prettier|eslint|stylelint/i)
        assert.equal(p.git("rev-parse", "HEAD"), head)
        assert.equal(p.git("diff", "--cached", "--binary"), staged)
        assert.equal(p.read(name), source)
        assert.equal(p.read("src/good.js"), good)
        assert.equal(p.git("stash", "list"), "")
    })
}
