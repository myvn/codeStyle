const { test } = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { pathToFileURL } = require("node:url")
const { copy, prettierConfig } = require("./_runtime.cjs")

/** 从运行时副本加载 flat 配置的默认导出（依赖在 .runtime 内解析） */
async function loadFlat(level) {
    return (await import(pathToFileURL(path.join(copy, `src/eslint/flat/${level}.mjs`)).href))
        .default
}

test("flat 与 legacy 分层对齐：nvue 覆写完整选项、uniapp globals 覆盖全部语言、extensions 同参（NIT-012）", async () => {
    // ① nvue 的 prettier 覆写必须携带完整选项：规则内联 options 会整体替换而非合并，
    //    缺项会静默回落到 prettier 默认（分号/2 空格/80 列），与项目风格整体脱节
    const vue3 = await loadFlat("vue3")
    const nvue = vue3.find(
        (entry) =>
            (entry.files || []).includes("**/*.nvue") &&
            entry.rules &&
            "prettier/prettier" in entry.rules,
    )
    assert.ok(nvue, "vue3 flat 配置缺少 .nvue 覆写")
    const { overrides: _overrides, ...prettierOptions } = prettierConfig
    assert.deepEqual(nvue.rules["prettier/prettier"], [
        "error",
        { ...prettierOptions, parser: "vue", semi: true },
    ])

    // ② uniapp globals 的 files 覆盖 base 的全部语言文件（此前漏 mjs/cjs/mts/cts/jsx/tsx）
    const uniapp = await loadFlat("uniapp")
    const globalsEntry = uniapp.find(
        (entry) => entry.languageOptions?.globals && "uni" in entry.languageOptions.globals,
    )
    assert.deepEqual(globalsEntry.files, ["**/*.{vue,ts,js,mjs,cjs,mts,cts,jsx,tsx,nvue}"])

    // ③ import-x/extensions 与 legacy 的 import/extensions 同参
    const base = await loadFlat("base")
    const rulesEntry = base.find((entry) => entry.rules && "import-x/extensions" in entry.rules)
    assert.deepEqual(rulesEntry.rules["import-x/extensions"], [
        "error",
        "ignorePackages",
        { js: "never", jsx: "never", ts: "never", tsx: "never" },
    ])
})

test("BUG-037：显式 .ts 扩展名项目 init 注入兼容段，fresh init 即绿起点", (t) => {
    const fs = require("node:fs")
    const { spawnSync } = require("node:child_process")
    const { root, runtime } = require("./_runtime.cjs")
    // 非点目录（stylelint overrides 的 glob 不匹配点路径，教训自 BUG-031）
    const dir = fs.mkdtempSync(path.join(root, "demo-test", "explicit-ext-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    fs.symlinkSync(path.join(runtime, "node_modules"), path.join(dir, "node_modules"), "junction")
    fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "explicit-ext", version: "1.0.0", type: "module" }),
    )
    fs.mkdirSync(path.join(dir, "src", "types"), { recursive: true })
    fs.writeFileSync(
        path.join(dir, "src", "types", "Foo.ts"),
        "export interface Foo {\n    a: number\n}\n",
    )
    fs.writeFileSync(
        path.join(dir, "src", "types", "Helper.ts"),
        "export function helper() {\n    return 1\n}\n",
    )
    // 混合写法：带与不带扩展名共存（BUG-037 验收要求"两种都兼容"）
    fs.writeFileSync(
        path.join(dir, "src", "use.ts"),
        'import type { Foo } from "./types/Foo.ts"\nimport { helper } from "./types/Helper"\nexport const f: Foo = { a: helper }\n',
    )
    const init = spawnSync(process.execPath, [path.join(root, "bin/init")], {
        cwd: dir,
        encoding: "utf8",
        timeout: 30000,
    })
    assert.equal(init.status, 0, init.stderr)
    assert.match(init.stdout, /显式 \.ts 扩展名/)
    assert.match(fs.readFileSync(path.join(dir, "eslint.config.mjs"), "utf8"), /兼容存量代码/)
    const lint = spawnSync(path.join(runtime, "node_modules/.bin/eslint"), ["src"], {
        cwd: dir,
        encoding: "utf8",
        timeout: 60000,
    })
    assert.equal(lint.status, 0, `fresh lint 应为绿起点：\n${lint.stdout}\n${lint.stderr}`)
    // 两种写法均不得产生 error 级问题（ 防止 "0 errors" 汇总行误判）
    assert.doesNotMatch(lint.stdout + lint.stderr, /\berror\b/, "不得有 error 级问题")
})
