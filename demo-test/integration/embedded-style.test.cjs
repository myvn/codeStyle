const { test } = require("node:test")
const assert = require("node:assert/strict")
const { commitProject } = require("./_runtime.cjs")

for (const ext of ["vue", "nvue"]) {
    test(`完整提交链拦截 ${ext} 内嵌样式错误（不是仅检查脚本）`, (t) => {
        const p = commitProject(t)
        const name = `src/BadStyle.${ext}`
        const source =
            "<template><view>Hello</view></template>\n<style>\n.demo {\n    unknown-property: red;\n}\n</style>\n"
        p.write(name, source)
        p.git("add", "--", name)
        const head = p.git("rev-parse", "HEAD")
        const staged = p.git("diff", "--cached", "--binary")
        const result = p.commit()
        assert.notEqual(result.status, 0)
        assert.match(result.stdout + result.stderr, /property-no-unknown/)
        assert.equal(p.git("rev-parse", "HEAD"), head)
        assert.equal(p.git("diff", "--cached", "--binary"), staged)
        assert.equal(p.read(name), source)
    })
}

test("完整提交链拦截混合工程中的 Vue 内嵌 Less 语法错误", (t) => {
    const p = commitProject(t, "both")
    const name = "src/BadLess.vue"
    const source =
        '<template><view /></template>\n<style lang="less">\n.demo {\n    unknown-property: red;\n}\n</style>\n'
    p.write(name, source)
    p.git("add", "--", name)
    const head = p.git("rev-parse", "HEAD")
    const staged = p.git("diff", "--cached", "--binary")
    const result = p.commit()
    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /property-no-unknown/)
    assert.equal(p.git("rev-parse", "HEAD"), head)
    assert.equal(p.git("diff", "--cached", "--binary"), staged)
    assert.equal(p.read(name), source)
})
