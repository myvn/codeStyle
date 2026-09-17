const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { root } = require("./helpers.cjs")
const pkg = require("../package.json")

test("所有公共导出目标存在且可通过包名解析", () => {
    for (const [key, dest] of Object.entries(pkg.exports)) {
        const entry = pkg.name + (key === "." ? "" : key.slice(1))
        assert.ok(fs.existsSync(path.join(root, dest)), dest)
        assert.equal(require.resolve(entry), path.join(root, dest))
    }
})

test("Prettier 默认值和 JSON/YAML/nvue 文件例外", () => {
    const config = require("my-code-style/prettier")
    assert.equal(config.singleQuote, false)
    assert.equal(config.tabWidth, 4)
    assert.equal(config.semi, false)
    assert.equal(config.printWidth, 100)
    assert.equal(config.endOfLine, "lf")
    const json = config.overrides.find((item) => item.files.includes("*.json"))
    assert.deepEqual(json.options, { tabWidth: 2, trailingComma: "none" })
    assert.equal(config.overrides.find((item) => item.files.includes("*.yaml")).options.tabWidth, 2)
    assert.equal(config.overrides.find((item) => item.files === "*.nvue").options.semi, true)
})

test("传统 ESLint 分层保留基础规则并补充 uni-app globals", () => {
    const base = require("my-code-style/eslint")
    const vue = require("my-code-style/eslint/vue3")
    const uni = require("my-code-style/eslint/uniapp")
    assert.equal(vue.parser, "vue-eslint-parser")
    assert.equal(vue.parserOptions.parser, base.parser)
    assert.equal(uni.globals.uni, true)
    assert.equal(uni.globals.wx, true)
    assert.deepEqual(uni.rules, vue.rules)
    assert.equal(uni.rules.curly[1], "all")
    assert.equal(base.globals, undefined)
})

test("Stylelint 的 SCSS / Less 解析器和小程序规则", () => {
    const scss = require("my-code-style/stylelint")
    const less = require("my-code-style/stylelint/less")
    assert.ok(scss.extends.includes("stylelint-config-recommended-scss"))
    assert.ok(!less.extends.includes("stylelint-config-recommended-scss"))
    for (const config of [scss, less]) {
        assert.ok(config.overrides.some((item) => item.customSyntax === "postcss-html"))
        assert.ok(config.rules["unit-no-unknown"][1].ignoreUnits.includes("rpx"))
        assert.ok(config.rules["selector-type-no-unknown"][1].ignoreTypes.includes("page"))
    }
    assert.ok(less.overrides.some((item) => item.customSyntax === "postcss-less"))
})

test("Commitlint 标题约束和版本管理开关", () => {
    const commit = require("my-code-style/commitlint")
    assert.deepEqual(commit.rules["header-max-length"], [2, "always", 108])
    assert.ok(commit.rules["type-enum"][2].includes("feat"))
    assert.ok(commit.rules["type-enum"][2].includes("fix"))
    const version = require("my-code-style/versionrc")
    assert.deepEqual(version.skip, { bump: false, changelog: false, commit: false, tag: false })
    assert.ok(version.types.some((item) => item.type === "feat"))
})
