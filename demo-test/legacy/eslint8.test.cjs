const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")
const { spawnSync } = require("node:child_process")
const root = path.resolve(__dirname, "../..")
const runtime = path.join(root, "demo-test/.runtime-legacy")
assert.ok(fs.existsSync(path.join(runtime, "node_modules/eslint")), "先运行 npm run test:legacy:setup")
const req = createRequire(path.join(runtime, "package.json"))
const copy = path.join(runtime, "node_modules/my-code-style")
fs.mkdirSync(copy, { recursive: true })
fs.cpSync(path.join(root, "src"), path.join(copy, "src"), { recursive: true })
fs.copyFileSync(path.join(root, "package.json"), path.join(copy, "package.json"))
const { ESLint } = req("eslint")
const prettier = req("prettier")
const format = (source, file) => prettier.format(source, {
    ...req("my-code-style/prettier"), filepath: file,
    ...(file.endsWith(".nvue") ? { parser: "vue", semi: true } : {}),
})

function consumer(t, level) {
    const dir = fs.mkdtempSync(path.join(runtime, "consumer-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const dependencies = { eslint: "8.57.0" }
    if (level !== "base") dependencies.vue = "^3"
    if (level === "uniapp") dependencies["@dcloudio/uni-app"] = "3.0.0"
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "legacy-consumer", devDependencies: dependencies }))
    const result = spawnSync(process.execPath, [path.join(root, "bin/init")], { cwd: dir, encoding: "utf8", timeout: 10000 })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(fs.existsSync(path.join(dir, ".eslintrc.cjs")))
    assert.equal(fs.existsSync(path.join(dir, "eslint.config.mjs")), false)
    return {
        dir,
        engine: (fix = false) => new ESLint({ cwd: dir, fix }),
        cli: (args) => spawnSync(process.execPath, [path.join(path.dirname(req.resolve("eslint/package.json")), "bin/eslint.js"), ...args], {
            cwd: dir, encoding: "utf8", timeout: 15000,
            env: { ...process.env, ESLINT_USE_FLAT_CONFIG: "false" },
        }),
    }
}
const examples = [
    ["base", "demo.ts", 'const count: number = 1\nconsole.log(count)\n'],
    ["vue3", "Demo.vue", '<template><div>{{ count }}</div></template>\n<script setup lang="ts">\nconst count: number = 1\n</script>\n'],
    ["uniapp", "Page.vue", '<template><view>Hello</view></template>\n<script setup lang="ts">\nuni.showToast({ title: "Hello" })\n</script>\n'],
]

test("独立运行 ESLint 8 支持下限而非 ESLint 9", () => {
    assert.equal(ESLint.version, "8.57.0")
})
for (const [level, file, source] of examples) {
    test(`ESLint 8 ${level}：实际 CLI 加载生成配置并接受正常文件`, async (t) => {
        const p = consumer(t, level)
        fs.writeFileSync(path.join(p.dir, file), await format(source, file))
        const result = p.cli([file, "--format", "json"])
        assert.equal(result.status, 0, result.stdout + result.stderr)
        const [report] = JSON.parse(result.stdout)
        assert.equal(report.errorCount, 0)
        assert.equal(report.warningCount, 0)
    })
    test(`ESLint 8 ${level}：修复后重复检查无误`, async (t) => {
        const p = consumer(t, level)
        const raw = level === "base" ? "const value='hello';console.log(value);\n" : '<template><view>Hello</view></template><script setup lang="ts">const value=1;console.log(value);</script>'
        const [bad] = await p.engine().lintText(raw, { filePath: file })
        assert.ok(bad.messages.some((message) => message.ruleId === "prettier/prettier"))
        const [fixed] = await p.engine(true).lintText(raw, { filePath: file })
        assert.ok(fixed.output)
        const [clean] = await p.engine().lintText(fixed.output, { filePath: file })
        assert.equal(clean.errorCount, 0, JSON.stringify(clean.messages))
        const [again] = await p.engine(true).lintText(fixed.output, { filePath: file })
        assert.equal(again.output, undefined)
    })
    test(`ESLint 8 ${level}：拒绝语法错误`, async (t) => {
        const p = consumer(t, level)
        const source = level === "base" ? "const value: = ;" : '<template><view /></template><script setup lang="ts">const value: = ;</script>'
        const [result] = await p.engine().lintText(source, { filePath: file })
        assert.ok(result.fatalErrorCount > 0)
    })
}
for (const file of ["Demo.nvue", "src/pages/Demo.nvue"]) {
    test(`ESLint 8 uni-app：${file} 模块 TS 脚本及分号例外`, async (t) => {
        const p = consumer(t, "uniapp")
        const source = '<template><view>{{ value }}</view></template>\n<script setup lang="ts">\nimport { ref } from "vue";\nconst value = ref<number>(1);\nuni.showToast({ title: "Hello" });\n</script>\n'
        const [result] = await p.engine().lintText(await format(source, file), { filePath: file })
        assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
        assert.equal(result.warningCount, 0, JSON.stringify(result.messages))
    })
}
test("ESLint 8 基础工程允许生成的 CommonJS 配置使用 require", async (t) => {
    const p = consumer(t, "base")
    const [result] = await p.engine().lintText('module.exports = require("my-code-style/prettier")\n', { filePath: "tool.config.cjs" })
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
})

for (const [level, file] of [["base", "broken.ts"], ["vue3", "Broken.vue"], ["uniapp", "Broken.nvue"]]) {
    test(`ESLint 8 ${level}：生成的 lint 脚本遍历并拦截 ${file}`, (t) => {
        const p = consumer(t, level)
        fs.writeFileSync(path.join(p.dir, file), level === "base" ? "const value: = ;" : '<template><view /></template><script setup lang="ts">const value: = ;</script>')
        const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, "package.json"), "utf8"))
        assert.ok(pkg.scripts.lint.includes("--ext"))
        assert.equal(pkg.scripts["lint:fix"], `${pkg.scripts.lint} --fix`)
        const result = p.cli(pkg.scripts.lint.split(" ").slice(1).concat(["--format", "json"]))
        assert.equal(result.status, 1, result.stdout + result.stderr)
        const reports = JSON.parse(result.stdout)
        assert.ok(reports.some((report) => report.filePath.endsWith(file) && report.fatalErrorCount > 0))
    })
}
test("ESLint 8 Vue essential 规则实际生效：重复属性被拒绝", async (t) => {
    const p = consumer(t, "vue3")
    const source = '<template><div id="a" id="b">Hello</div></template>\n'
    const [result] = await p.engine().lintText(await format(source, "Demo.vue"), { filePath: "Demo.vue" })
    assert.ok(result.messages.some((message) => message.ruleId === "vue/no-duplicate-attributes"))
})
