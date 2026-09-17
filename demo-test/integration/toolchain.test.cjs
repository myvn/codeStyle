const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")
const { pathToFileURL } = require("node:url")
const { spawnSync } = require("node:child_process")
const root = path.resolve(__dirname, "../..")
const runtime = path.join(root, "demo-test/.runtime")
const localRequire = createRequire(path.join(runtime, "package.json"))
// Copy current code, not the published package. Dependencies resolve in isolation.
const copy = path.join(runtime, "node_modules/my-code-style")
assert.ok(
    fs.existsSync(path.join(runtime, "node_modules/eslint")),
    "先运行 npm run test:integration:setup；安装冲突时见 demo-test/README.md",
)
fs.mkdirSync(copy, { recursive: true })
fs.cpSync(path.join(root, "src"), path.join(copy, "src"), { recursive: true })
fs.copyFileSync(path.join(root, "package.json"), path.join(copy, "package.json"))
const prettier = localRequire("prettier")
const prettierConfig = localRequire("my-code-style/prettier")
const { ESLint } = localRequire("eslint")
async function eslint(level = "base") {
    const config = (
        await import(pathToFileURL(path.join(copy, `src/eslint/flat/${level}.mjs`)).href)
    ).default
    return new ESLint({ cwd: runtime, overrideConfigFile: true, overrideConfig: config })
}

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
]) {
    test(`ESLint 正常文件：${level}`, async () => {
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

test("ESLint 拒绝 TypeScript 语法错误", async () => {
    const engine = await eslint()
    const [result] = await engine.lintText("const value: =\n", { filePath: "bad.ts" })
    assert.ok(result.fatalErrorCount > 0)
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
        assert.equal(fixed.errored, false, JSON.stringify(fixed.results))
        const output = fixed.code ?? fixed.output
        assert.ok(output.includes("color"))
        const clean = await stylelint.lint({ ...options, code: output })
        assert.equal(clean.errored, false, JSON.stringify(clean.results))
        const bad = await stylelint.lint({ ...options, code: ".demo { unknown-property: red; }" })
        assert.ok(
            bad.results.some((result) =>
                result.warnings.some((warning) => warning.rule === "property-no-unknown"),
            ),
        )
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
    assert.equal(scssRes.errored, false, JSON.stringify(scssRes.results))

    const lessRes = await stylelint.lint({
        config,
        configBasedir: runtime,
        codeFilename: path.join(runtime, "demo.less"),
        code: "@color: blue;\n.demo { color: @color; }\n",
        fix: true,
    })
    assert.equal(lessRes.errored, false, JSON.stringify(lessRes.results))

    const vueMixedRes = await stylelint.lint({
        config,
        configBasedir: runtime,
        codeFilename: path.join(runtime, "Mixed.vue"),
        code: '<template><div /></template>\n<style lang="scss">\n$c: red;\n.s { color: $c; }\n</style>\n<style lang="less">\n@c: blue;\n.l { color: @c; }\n</style>\n',
        fix: true,
    })
    assert.equal(vueMixedRes.errored, false, JSON.stringify(vueMixedRes.results))
})

async function commitlint(message) {
    const load = (await import(pathToFileURL(localRequire.resolve("@commitlint/load")).href))
        .default
    const lint = (await import(pathToFileURL(localRequire.resolve("@commitlint/lint")).href))
        .default
    const config = await load(localRequire("my-code-style/commitlint"), {
        cwd: runtime,
        file: path.join(copy, "src/commitlint/base.cjs"),
    })
    return lint(message, config.rules, {
        parserOpts: config.parserPreset?.parserOpts,
        ignores: config.ignores,
        defaultIgnores: config.defaultIgnores,
    })
}
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
    function run(command, args, env = {}) {
        return spawnSync(command, args, {
            cwd: dir,
            encoding: "utf8",
            timeout: 15000,
            env: { ...process.env, ...env },
        })
    }
    function git(...args) {
        const result = run("git", args)
        assert.equal(result.status, 0, result.stderr)
    }
    git("init", "-q")
    git("config", "user.name", "Demo Test")
    git("config", "user.email", "demo@example.invalid")
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

// Full hook chain. Unlike the earlier focused commit-msg test, these fixtures
// retain BOTH generated hooks and run real lint-staged against the Git index.
function commitProject(t, style = "scss") {
    const dir = fs.mkdtempSync(path.join(runtime, "full-hooks-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const env = { ...process.env, HUSKY: "1", GIT_CONFIG_NOSYSTEM: "1" }
    const run = (command, args) =>
        spawnSync(command, args, {
            cwd: dir,
            encoding: "utf8",
            timeout: 60000,
            env,
        })
    function git(...args) {
        const result = run("git", args)
        assert.equal(result.status, 0, result.stdout + result.stderr)
        return result.stdout
    }
    function write(name, content) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
        fs.writeFileSync(path.join(dir, name), content)
    }
    git("init", "-q")
    git("config", "user.name", "Demo Test")
    git("config", "user.email", "demo@example.invalid")
    git("config", "commit.gpgsign", "false")
    git("config", "core.autocrlf", "false")
    // Establish HEAD before installing hooks so lint-staged can stash/restore.
    git("commit", "--allow-empty", "-m", "chore: baseline")
    const styleDeps =
        style === "both" ? { sass: "*", less: "*" } : { [style === "less" ? "less" : "sass"]: "*" }
    write(
        "package.json",
        JSON.stringify({
            name: "full-hook-fixture",
            devDependencies: {
                eslint: "^9",
                "@dcloudio/uni-app": "3.0.0",
                ...styleDeps,
            },
        }),
    )
    let result = run(process.execPath, [path.join(root, "bin/init")])
    assert.equal(result.status, 0, result.stderr)
    result = run(process.execPath, [
        path.join(path.dirname(localRequire.resolve("husky")), "bin.js"),
    ])
    assert.equal(result.status, 0, result.stderr)
    return {
        dir,
        git,
        write,
        read: (name) => fs.readFileSync(path.join(dir, name), "utf8"),
        commit: (message = "feat: verify full hook chain") => run("git", ["commit", "-m", message]),
    }
}

for (const style of ["scss", "less", "both"]) {
    test(`完整提交链：JS/TS/Vue/nvue/CSS/${style} 自动修复及二次复检`, (t) => {
        const p = commitProject(t, style)
        const samples = {
            "src/中文 空格/demo file.js": "const value='hello';console.log(value);\n",
            "src/demo.ts": "const count:number=1;console.log(count);\n",
            "src/Demo.vue":
                '<template><view>Hello</view></template><script setup lang="ts">const count:number=1;console.log(count);</script><style>.demo{color:red;}</style>',
            "src/pages/Demo.nvue":
                '<template><view>Hello</view></template><script setup lang="ts">uni.showToast({title:"Hello"});</script><style>.demo{color:red;}</style>',
            "src/styles/main.css": ".demo{color:red;}\n",
            ...(style === "both"
                ? {
                      "src/styles/main.scss": "$color:red;.demo{color:$color;}\n",
                      "src/styles/main.less": "@color:red;.demo{color:@color;}\n",
                      "src/Mixed.vue":
                          '<template><view /></template><style lang="scss">$c:red;.s{color:$c;}</style><style lang="less">@c:blue;.l{color:@c;}</style>',
                  }
                : {
                      [`src/styles/main.${style}`]:
                          style === "less"
                              ? "@color:red;.demo{color:@color;}\n"
                              : "$color:red;.demo{color:$color;}\n",
                  }),
        }
        for (const [name, content] of Object.entries(samples)) p.write(name, content)
        p.git("add", "--", "src")
        const result = p.commit()
        assert.equal(result.status, 0, result.stdout + result.stderr)
        for (const [name, original] of Object.entries(samples)) {
            const committed = p.git("show", `HEAD:${name}`)
            assert.notEqual(committed, original, `${name} must actually be formatted`)
            assert.equal(p.read(name), committed)
        }
        assert.equal(p.git("diff", "--", "src"), "")
        assert.equal(p.git("diff", "--cached"), "")
        // Re-stage the same malformed originals; fix should reproduce HEAD,
        // and lint-staged must prevent an empty commit rather than drift output.
        const head = p.git("rev-parse", "HEAD")
        for (const [name, content] of Object.entries(samples)) p.write(name, content)
        p.git("add", "--", "src")
        const again = p.commit()
        assert.notEqual(again.status, 0)
        assert.match(again.stdout + again.stderr, /empty (?:git )?commit/i)
        assert.equal(p.git("rev-parse", "HEAD"), head)
    })
}

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

test("所有支持的文件只匹配一个任务组，组件工具严格按序执行", (t) => {
    const micromatch = localRequire("micromatch")
    for (const style of ["scss", "less", "both"]) {
        const p = commitProject(t, style)
        const tasks = JSON.parse(p.read("package.json"))["lint-staged"]
        const exts =
            style === "both"
                ? [
                      "vue",
                      "nvue",
                      "js",
                      "ts",
                      "jsx",
                      "tsx",
                      "cjs",
                      "mjs",
                      "mts",
                      "cts",
                      "html",
                      "css",
                      "scss",
                      "less",
                      "json",
                      "json5",
                      "md",
                      "yml",
                      "yaml",
                  ]
                : [
                      "vue",
                      "nvue",
                      "js",
                      "ts",
                      "jsx",
                      "tsx",
                      "cjs",
                      "mjs",
                      "mts",
                      "cts",
                      "html",
                      "css",
                      style,
                      "json",
                      "json5",
                      "md",
                      "yml",
                      "yaml",
                  ]
        for (const ext of exts) {
            const matches = Object.keys(tasks).filter((pattern) =>
                micromatch.isMatch(`src/中文 空格/file.${ext}`, pattern),
            )
            assert.equal(matches.length, 1, `${style}/${ext}: ${matches}`)
        }
        assert.deepEqual(tasks["**/*.{vue,nvue}"], [
            "prettier --write",
            "eslint --fix",
            "stylelint --fix",
        ])
    }
})

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
