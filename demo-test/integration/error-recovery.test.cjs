const { test } = require("node:test")
const assert = require("node:assert/strict")
const { prettier, eslint, commitProject } = require("./_runtime.cjs")

for (const [name, source] of [
    ["src/bad.js", "const = ;\n"],
    ["src/bad.ts", "const value: = ;\n"],
    [
        "src/Bad.vue",
        '<template><view /></template><script setup lang="ts">const value: = ;</script>',
    ],
    [
        "src/Bad.nvue",
        '<template><view /></template><script setup lang="ts">const value: = ;</script>',
    ],
    ["src/bad.css", ".demo { unknown-property: red; }\n"],
    ["src/bad.scss", ".demo { unknown-property: red; }\n"],
    ["src/bad.less", ".demo { unknown-property: red; }\n"],
]) {
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
