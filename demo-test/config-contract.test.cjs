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

test("传统 ESLint 分层以 prettier 配置为唯一来源（含 .nvue 例外）", () => {
    const prettierConfig = require("my-code-style/prettier")
    const { overrides: _overrides, ...prettierOptions } = prettierConfig
    const base = require("my-code-style/eslint")
    const vue = require("my-code-style/eslint/vue3")

    // 规则里必须是完整的 Prettier 选项，漏项会在 nvue/覆写场景静默回落到默认值
    assert.deepEqual(base.rules["prettier/prettier"], ["error", prettierOptions])
    for (const key of ["printWidth", "tabWidth", "useTabs", "semi", "htmlWhitespaceSensitivity"]) {
        assert.equal(base.rules["prettier/prettier"][1][key], prettierConfig[key], key)
    }

    const nvue = vue.overrides.find((item) => item.files.includes("**/*.nvue"))
    assert.ok(nvue, "vue3 配置缺少 .nvue 覆写")
    assert.deepEqual(nvue.rules["prettier/prettier"], [
        "error",
        { ...prettierOptions, parser: "vue", semi: true },
    ])
})

test("peerDependencies 覆盖 ESLint 8/9/10，无残留的 @eslint/eslintrc", () => {
    assert.match(pkg.peerDependencies.eslint, /\^8\.57\.0/)
    assert.match(pkg.peerDependencies.eslint, /\^10\.0\.0/)
    assert.equal(pkg.peerDependencies["@eslint/eslintrc"], undefined)
    assert.equal(pkg.peerDependenciesMeta["@eslint/eslintrc"], undefined)
    // Flat Config 现在真的 import 了 @eslint/js
    assert.ok(pkg.peerDependencies["@eslint/js"], "@eslint/js 应保留在 peerDependencies")
    assert.equal(pkg.peerDependenciesMeta["@eslint/js"].optional, true)
    // 刻意不含 ^10：@eslint/js 10 要求 Node >= 20.19
    assert.equal(pkg.peerDependencies["@eslint/js"], "^9.0.0")
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

test("发布工作流保持 provenance 契约（--provenance + 发布日志自证 + 慢回传重试）", () => {
    const yml = fs.readFileSync(path.join(root, ".github/workflows/publish.yml"), "utf8")
    // 注释里会提到被删掉的旧写法（例如"不再使用 || npm publish 兜底"），断言只看实际代码行
    const code = yml
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n")

    // 1.7.1 的绿勾就是被删掉 --provenance 弄丢的：只有 OIDC 是自动生成 provenance，
    // token 发布必须显式带这个 flag，否则 attestation 不会产生。
    assert.match(code, /npm publish --provenance --access public/)
    assert.doesNotMatch(code, /\|\|\s*npm publish/, "不能有静默降级成无凭据发布的分支")
    assert.match(yml, /id-token:\s*write/)
    assert.match(yml, /^\s*environment:\s*npm-publish$/m)

    // npm 真正生成了 provenance 时会打印这一行（libnpmpublish 10/11/12 文案一致），
    // 发布步骤据此在 registry 回传之前就当场自证。
    assert.match(yml, /Signed provenance statement/)

    // registry 回传延迟实测可达 2 分钟以上（1.7.2：透明日志签名 06:47:57Z，publish 结束 06:45:49Z），
    // 回查预算必须给足，否则会把已经带 provenance 的发布误判成失败。
    const num = (pattern) => Number(yml.match(pattern)[1])
    const maxAttempts = num(/MAX_ATTEMPTS:-(\d+)/)
    const fastAttempts = num(/FAST_ATTEMPTS:-(\d+)/)
    const fastDelay = num(/RETRY_FAST:-(\d+)/)
    const slowDelay = num(/RETRY_SLOW:-(\d+)/)
    const budget = fastAttempts * fastDelay + (maxAttempts - fastAttempts - 1) * slowDelay
    assert.ok(
        budget >= 300,
        `provenance 回查预算只有 ${budget}s，应 ≥ 300s（registry 回传实测可超过 2 分钟）`,
    )
    assert.match(yml, /attestations\/my-code-style@\$\{version\}/)
})

test("cz 交互提示为中文，且可选类型与 type-enum 一一对应", () => {
    const commit = require("my-code-style/commitlint")
    const { messages, types, customScopesAlias, emptyScopesAlias } = commit.prompt
    const cjk = /[\u4e00-\u9fa5]/

    // 交互文案（cz-git 的 prompt.messages）默认中文；想改语言在自己的 .commitlintrc.cjs 里覆盖
    for (const key of ["type", "scope", "subject", "body", "confirmCommit"]) {
        assert.ok(messages[key], `messages.${key} 应存在`)
        assert.match(messages[key], cjk, `messages.${key} 应为中文提示`)
    }
    assert.match(customScopesAlias, cjk)
    assert.match(emptyScopesAlias, cjk)

    // 此前 release 只写在 type-enum 里、cz 的选择列表没有它：两边必须完全一致
    const ruleTypes = [...commit.rules["type-enum"][2]].sort()
    const promptTypes = types.map((item) => item.value).sort()
    assert.deepEqual(promptTypes, ruleTypes, "cz 可选类型必须与 type-enum 完全一致")
    for (const item of types) {
        assert.match(item.name, cjk, `${item.value} 的描述应为中文`)
        assert.match(
            item.name,
            new RegExp(`^${item.value}:\\s`),
            `${item.value} 的名称应带类型前缀`,
        )
        assert.ok(item.emoji, `${item.value} 应带 emoji（useEmoji 关闭时不影响显示）`)
    }
})
