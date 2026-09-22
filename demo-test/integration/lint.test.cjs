const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")
const { spawnSync } = require("node:child_process")
const {
    root,
    runtime,
    copy,
    localRequire,
    prettier,
    prettierConfig,
    ESLint,
    eslint,
    commitlint,
} = require("./_runtime.cjs")

/**
 * stylelint 17 的 results 里带 postcss Lexer 的循环引用，直接 JSON.stringify 会抛
 * "Converting circular structure to JSON"（会把断言消息本身变成失败）。这里只摘出
 * 断言需要的信息，两个 stylelint 大版本都安全。
 */
const summarize = (results) =>
    (results || []).map((result) => ({
        source: result.source,
        errored: Boolean(result.errored),
        warnings: (result.warnings || []).map((warning) => ({
            rule: warning.rule,
            text: warning.text,
            line: warning.line,
        })),
    }))

for (const [parser, source, expected] of [
    ["babel", "const name='demo';\n", 'const name = "demo"\n'],
    ["typescript", "const count:number=1;\n", "const count: number = 1\n"],
    ["json", '{"name":"demo","count":1}', '{ "name": "demo", "count": 1 }\n'],
]) {
    test(`Prettier 实际格式化及幂等性：${parser}`, async () => {
        const result = await prettier.format(source, { ...prettierConfig, parser })
        assert.equal(result, expected)
        assert.equal(await prettier.format(result, { ...prettierConfig, parser }), result)
    })
}
for (const [level, filePath, source] of [
    ["base", "demo.ts", "const count: number = 1\nconsole.log(count)\n"],
    ["vue3", "Demo.vue", "<template><div>Hello</div></template>\n"],
    [
        "uniapp",
        "page.vue",
        '<template><view>Hello</view></template>\n<script setup lang="ts">\nuni.showToast({ title: "Hello" })\n</script>\n',
    ],
    ["base", "Header.jsx", 'export const Header = () => <div className="header">Title</div>\n'],
    [
        "base",
        "Button.tsx",
        "export interface ButtonProps {\n    label: string\n}\nexport const Button = (props: ButtonProps) => <button>{props.label}</button>\n",
    ],
]) {
    test(`ESLint 正常文件：${level} (${filePath})`, async () => {
        const engine = await eslint(level)
        const formatted = await prettier.format(source, { ...prettierConfig, filepath: filePath })
        const [result] = await engine.lintText(formatted, { filePath })
        assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
        assert.equal(result.warningCount, 0, JSON.stringify(result.messages))
    })
}

test("ESLint 报出格式错误并修复；再次检查无错误", async () => {
    const config = (await import(pathToFileURL(path.join(copy, "src/eslint/flat/base.mjs")).href))
        .default
    const source = "const name='demo';\nconsole.log(name);\n"
    const engine = await eslint()
    const [before] = await engine.lintText(source, { filePath: "bad.js" })
    assert.ok(before.messages.some((message) => message.ruleId === "prettier/prettier"))
    const fixer = new ESLint({
        cwd: runtime,
        overrideConfigFile: true,
        overrideConfig: config,
        fix: true,
    })
    const [fixed] = await fixer.lintText(source, { filePath: "bad.js" })
    assert.ok(fixed.output)
    const [after] = await engine.lintText(fixed.output, { filePath: "bad.js" })
    assert.equal(after.errorCount, 0, JSON.stringify(after.messages))
})

test("ESLint (Flat Config) 识别并修复 JSX/TSX 格式，拒绝语法错误", async () => {
    const config = (await import(pathToFileURL(path.join(copy, "src/eslint/flat/base.mjs")).href))
        .default
    const engine = await eslint("base")
    const fixer = new ESLint({
        cwd: runtime,
        overrideConfigFile: true,
        overrideConfig: config,
        fix: true,
    })

    // JSX format & fix
    const unformattedJsx = 'export const App=()=><div>{"test"}</div>;\n'
    const [jsxBefore] = await engine.lintText(unformattedJsx, { filePath: "App.jsx" })
    assert.ok(jsxBefore.messages.some((m) => m.ruleId === "prettier/prettier"))
    const [jsxFixed] = await fixer.lintText(unformattedJsx, { filePath: "App.jsx" })
    assert.ok(jsxFixed.output)
    const [jsxAfter] = await engine.lintText(jsxFixed.output, { filePath: "App.jsx" })
    assert.equal(jsxAfter.errorCount, 0, JSON.stringify(jsxAfter.messages))

    // TSX format & fix
    const unformattedTsx = "export const Card=(props:{title:string})=><div>{props.title}</div>;\n"
    const [tsxBefore] = await engine.lintText(unformattedTsx, { filePath: "Card.tsx" })
    assert.ok(tsxBefore.messages.some((m) => m.ruleId === "prettier/prettier"))
    const [tsxFixed] = await fixer.lintText(unformattedTsx, { filePath: "Card.tsx" })
    assert.ok(tsxFixed.output)
    const [tsxAfter] = await engine.lintText(tsxFixed.output, { filePath: "Card.tsx" })
    assert.equal(tsxAfter.errorCount, 0, JSON.stringify(tsxAfter.messages))

    // JSX/TSX syntax errors
    const [badJsx] = await engine.lintText("export const App = () => <div><span></div>\n", {
        filePath: "Bad.jsx",
    })
    assert.ok(badJsx.fatalErrorCount > 0)
    const [badTsx] = await engine.lintText("export const Card = (props: {) => <div />\n", {
        filePath: "Bad.tsx",
    })
    assert.ok(badTsx.fatalErrorCount > 0)
})

test("ESLint 拒绝 TypeScript 语法错误", async () => {
    const engine = await eslint()
    const [result] = await engine.lintText("const value: =\n", { filePath: "bad.ts" })
    assert.ok(result.fatalErrorCount > 0)
})

// tseslint.configs.recommended 只覆盖 TypeScript 相关规则，flat 配置必须自行补齐
// eslint:recommended，否则这些核心规则对消费方完全失效（legacy 配置一直生效）。
for (const [ruleId, source] of [
    ["no-debugger", "debugger\n"],
    ["no-cond-assign", "let value = 0\nif (value = 1) { console.log(value) }\n"],
    ["no-constant-condition", "if (true) { console.log(1) }\n"],
    ["no-empty", "if (Math.random() > 0.5) {}\n"],
    ["no-fallthrough", "switch (1) { case 1: console.log(1)\ncase 2: console.log(2) }\n"],
    ["no-unsafe-finally", "function demo() { try { return 1 } finally { return 2 } }\ndemo()\n"],
]) {
    test(`Flat Config 启用 eslint:recommended 核心规则：${ruleId}`, async () => {
        const engine = await eslint("base")
        const [result] = await engine.lintText(source, { filePath: "probe.js" })
        assert.ok(
            result.messages.some((message) => message.ruleId === ruleId && message.severity === 2),
            `${ruleId} 未生效：${JSON.stringify(result.messages)}`,
        )
    })
}

test("Flat Config 与传统配置的 .nvue Prettier 例外完全一致", async () => {
    const legacy = localRequire("my-code-style/eslint/vue3")
    const legacyNvue = legacy.overrides.find((item) => item.files.includes("**/*.nvue"))
    assert.ok(legacyNvue, "legacy vue3 配置缺少 .nvue 覆写")
    const flat = (await import(pathToFileURL(path.join(copy, "src/eslint/flat/vue3.mjs")).href))
        .default
    const flatNvue = flat.find(
        (block) =>
            Array.isArray(block.files) &&
            block.files.includes("**/*.nvue") &&
            block.rules?.["prettier/prettier"],
    )
    assert.ok(flatNvue, "Flat Config 缺少 .nvue 覆写")
    // 规则内联 options 是整体替换而非合并，因此两边都必须是完整选项集
    assert.deepEqual(flatNvue.rules["prettier/prettier"], legacyNvue.rules["prettier/prettier"])
    const [, options] = flatNvue.rules["prettier/prettier"]
    assert.equal(options.printWidth, 100, "nvue 覆写漏了 printWidth 之类的项目级选项")
    assert.equal(options.useTabs, false)
    assert.equal(options.semi, true)
    assert.equal(options.parser, "vue")
})

test("Flat Config：curly 规则生效并可修复（不被 eslint-config-prettier 关掉）", async () => {
    const config = (await import(pathToFileURL(path.join(copy, "src/eslint/flat/base.mjs")).href))
        .default
    const source = "const value = 1\nif (value) console.log(value)\n"
    const engine = new ESLint({ cwd: runtime, overrideConfigFile: true, overrideConfig: config })
    const [before] = await engine.lintText(source, { filePath: "curly.ts" })
    assert.ok(
        before.messages.some((message) => message.ruleId === "curly"),
        JSON.stringify(before.messages),
    )
    const fixer = new ESLint({
        cwd: runtime,
        overrideConfigFile: true,
        overrideConfig: config,
        fix: true,
    })
    const [fixed] = await fixer.lintText(source, { filePath: "curly.ts" })
    assert.match(fixed.output, /if \(value\) \{/)
    const [after] = await engine.lintText(fixed.output, { filePath: "curly.ts" })
    assert.equal(after.errorCount, 0, JSON.stringify(after.messages))
})

test("Flat Config：引号规则与 Prettier 不冲突（含双引号的字符串可通过）", async () => {
    const engine = await eslint("base")
    const formatted = await prettier.format(
        "const greeting = 'say \"hi\" bye'\nconsole.log(greeting)\n",
        {
            ...prettierConfig,
            filepath: "quote.ts",
        },
    )
    const [result] = await engine.lintText(formatted, { filePath: "quote.ts" })
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
    const [fixed] = await new ESLint({
        cwd: runtime,
        overrideConfigFile: true,
        overrideConfig: (
            await import(pathToFileURL(path.join(copy, "src/eslint/flat/base.mjs")).href)
        ).default,
        fix: true,
    }).lintText(formatted, { filePath: "quote.ts" })
    assert.equal(fixed.output, undefined, "不应存在需要反复修复的残留错误")
})

test("Flat Config uni-app：.nvue 分号例外不产生 semi 冲突", async () => {
    const engine = await eslint("uniapp")
    const source =
        '<template><view>{{ value }}</view></template>\n<script setup lang="ts">\nimport { ref } from "vue"\nconst value = ref<number>(1)\nuni.showToast({ title: "Hello" });\n</script>\n'
    const formatted = await prettier.format(source, {
        ...prettierConfig,
        filepath: "Page.nvue",
        parser: "vue",
        semi: true,
    })
    const [result] = await engine.lintText(formatted, { filePath: "Page.nvue" })
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
    assert.equal(result.warningCount, 0, JSON.stringify(result.messages))
})

for (const [entry, ext, source] of [
    ["stylelint", "scss", "$color: red;\n.demo { color: $color; }\n"],
    ["stylelint/less", "less", "@color: red;\n.demo { color: @color; }\n"],
]) {
    test(`Stylelint 检查和修复：${ext}`, async () => {
        const stylelint = localRequire("stylelint")
        const config = localRequire(`my-code-style/${entry}`)
        const options = {
            config,
            configBasedir: runtime,
            codeFilename: path.join(runtime, `demo.${ext}`),
        }
        const fixed = await stylelint.lint({ ...options, code: source, fix: true })
        assert.equal(fixed.errored, false, JSON.stringify(summarize(fixed.results)))
        const output = fixed.code ?? fixed.output
        assert.ok(output.includes("color"))
        const clean = await stylelint.lint({ ...options, code: output })
        assert.equal(clean.errored, false, JSON.stringify(summarize(clean.results)))
        const bad = await stylelint.lint({ ...options, code: ".demo { unknown-property: red; }" })
        assert.ok(
            bad.results.some((result) =>
                result.warnings.some((warning) => warning.rule === "property-no-unknown"),
            ),
        )
    })

    test("Stylelint：Less 线的 rpx 值不误报 declaration-property-value-no-unknown（BUG-029）", async () => {
        const stylelint = localRequire("stylelint")
        const config = localRequire("my-code-style/stylelint/less")
        const linted = await stylelint.lint({
            config,
            configBasedir: runtime,
            codeFilename: path.join(runtime, "rpx.less"),
            code: ".card { width: 750rpx; margin: 24rpx; }\n",
        })
        const warnings = linted.results.flatMap((item) => item.warnings)
        const offenders = warnings.filter(
            (warning) => warning.rule === "declaration-property-value-no-unknown",
        )
        assert.equal(offenders.length, 0, JSON.stringify(summarize(linted.results)))
    })
}

test("Stylelint (my-code-style/stylelint) 统一支持 SCSS、Less 及 Vue 内嵌双预处理器", async () => {
    const stylelint = localRequire("stylelint")
    const config = localRequire("my-code-style/stylelint")
    const scssRes = await stylelint.lint({
        config,
        configBasedir: runtime,
        codeFilename: path.join(runtime, "demo.scss"),
        code: "$color: red;\n.demo { color: $color; }\n",
        fix: true,
    })
    assert.equal(scssRes.errored, false, JSON.stringify(summarize(scssRes.results)))

    const lessRes = await stylelint.lint({
        config,
        configBasedir: runtime,
        codeFilename: path.join(runtime, "demo.less"),
        code: "@color: blue;\n.demo { color: @color; }\n",
        fix: true,
    })
    assert.equal(lessRes.errored, false, JSON.stringify(summarize(lessRes.results)))

    const vueMixedRes = await stylelint.lint({
        config,
        configBasedir: runtime,
        codeFilename: path.join(runtime, "Mixed.vue"),
        code: '<template><div /></template>\n<style lang="scss">\n$c: red;\n.s { color: $c; }\n</style>\n<style lang="less">\n@c: blue;\n.l { color: @c; }\n</style>\n',
        fix: true,
    })
    assert.equal(vueMixedRes.errored, false, JSON.stringify(summarize(vueMixedRes.results)))
})

test("Commitlint 接受规范提交并拒绝非法 type / 超长标题", async () => {
    assert.equal((await commitlint("feat(component): add button")).valid, true)
    assert.equal((await commitlint("invalid(component): add button")).valid, false)
    assert.equal((await commitlint("feat: " + "a".repeat(109))).valid, false)
})

test("Commitlint 不应跳过包含 init 的非法提交", async () => {
    assert.equal((await commitlint("invalid: initialize broken message")).valid, false)
})

test("uni-app 应解析嵌套 .nvue 文件", async () => {
    const engine = await eslint("uniapp")
    const [result] = await engine.lintText("<template><view>Hello</view></template>\n", {
        filePath: "src/pages/demo.nvue",
    })
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
    assert.equal(result.warningCount, 0, JSON.stringify(result.messages))
})

test("生成的 commit-msg hook 真正阻止非法提交（仅临时 Git 仓库）", (t) => {
    const dir = fs.mkdtempSync(path.join(runtime, "git-fixture-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const identity = {
        GIT_AUTHOR_NAME: "Demo Test",
        GIT_AUTHOR_EMAIL: "demo@example.invalid",
        GIT_COMMITTER_NAME: "Demo Test",
        GIT_COMMITTER_EMAIL: "demo@example.invalid",
    }
    function run(command, args, env = {}) {
        return spawnSync(command, args, {
            cwd: dir,
            encoding: "utf8",
            timeout: 15000,
            env: { ...process.env, ...identity, ...env },
        })
    }
    function git(...args) {
        const result = run("git", args)
        assert.equal(result.status, 0, result.stderr)
    }
    git("init", "-q")
    fs.writeFileSync(
        path.join(dir, "package.json"),
        '{"name":"hook-fixture","devDependencies":{"eslint":"^9"}}',
    )
    const init = run(process.execPath, [path.join(root, "bin/init")])
    assert.equal(init.status, 0, init.stderr)
    // Run real Husky setup; only this disposable repository is affected.
    const husky = run(process.execPath, [
        path.join(path.dirname(localRequire.resolve("husky")), "bin.js"),
    ])
    assert.equal(husky.status, 0, husky.stderr)
    // Isolate commit-msg from pre-commit: lint-staged is a separate coverage gap.
    fs.writeFileSync(path.join(dir, ".husky/pre-commit"), "")
    const rejected = run("git", [
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "-m",
        "invalid: broken message",
    ])
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stdout + rejected.stderr, /type-enum/)
    const accepted = run("git", [
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "-m",
        "feat: add demo",
    ])
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr)
})

for (const filePath of ["Demo.nvue", "src/pages/demo.nvue"]) {
    test(`nvue 完整 TS 脚本和 Prettier 文件例外：${filePath}`, async () => {
        const source =
            '<template><view>{{ count }}</view></template>\n<script setup lang="ts">\nimport { ref } from "vue";\nconst count = ref<number>(1);\nuni.showToast({ title: "Hello" });\n</script>\n'
        const options = {
            ...prettierConfig,
            ...prettierConfig.overrides.find((item) => item.files === "*.nvue").options,
            filepath: filePath,
        }
        const formatted = await prettier.format(source, options)
        assert.equal(await prettier.format(formatted, options), formatted)
        const engine = await eslint("uniapp")
        const [result] = await engine.lintText(formatted, { filePath })
        assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
        assert.equal(result.warningCount, 0, JSON.stringify(result.messages))
    })
}

test("nvue 错误脚本不会被静默忽略", async () => {
    const engine = await eslint("uniapp")
    const [result] = await engine.lintText(
        '<template><view /></template>\n<script setup lang="ts">const count: = ;</script>',
        { filePath: "src/pages/broken.nvue" },
    )
    assert.ok(result.fatalErrorCount > 0)
})

test("Commitlint 允许规范的初始化提交但不放过普通 init 文本", async () => {
    assert.equal((await commitlint("chore: initialize project")).valid, true)
    assert.equal((await commitlint("init arbitrary text")).valid, false)
})
