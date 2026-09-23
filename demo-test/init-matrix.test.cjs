const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { project, root } = require("./helpers.cjs")
const cases = require("./fixtures/projects.json")

for (const scenario of cases) {
    test(`初始化场景：${scenario.name}`, (t) => {
        const pkgData = {
            name: "demo-consumer",
            devDependencies: scenario.dependencies,
        }
        if (scenario.type) {
            pkgData.type = scenario.type
        }
        const p = project(t, {
            "package.json": JSON.stringify(pkgData),
        })
        const result = p.init()
        assert.equal(result.status, 0, result.stderr)
        const name = scenario.legacy ? ".eslintrc.cjs" : "eslint.config.mjs"
        assert.ok(p.read(name).includes(`"${scenario.entry}"`))
        assert.equal(p.exists(".stylelintrc.cjs"), Boolean(scenario.style))
        if (scenario.style) {
            assert.ok(p.read(".stylelintrc.cjs").includes(`"${scenario.style}"`))
        }
        const pkg = JSON.parse(p.read("package.json"))
        assert.equal(
            pkg.scripts.lint,
            scenario.legacy ? "eslint . --ext .js,.cjs,.mjs,.ts,.mts,.cts,.jsx,.tsx" : "eslint .",
        )
        assert.equal(pkg.scripts.prepare, "husky")
        const tasks = pkg["lint-staged"]
        assert.equal(
            Object.values(tasks).flat().includes("stylelint --fix"),
            Boolean(scenario.style),
        )
        if (scenario.style) {
            const expectedPattern =
                scenario.name === "sass-less-coexist"
                    ? "**/*.{html,css,scss,less}"
                    : scenario.style.endsWith("/less")
                      ? "**/*.{html,css,less}"
                      : "**/*.{html,css,scss}"
            assert.deepEqual(tasks[expectedPattern], ["prettier --write", "stylelint --fix"])
        }
        // hook 优先直连本地 bin（省一次 npm CLI 启动），找不到时退回 npx
        assert.match(p.read(".husky/pre-commit"), /command -v lint-staged/)
        assert.match(p.read(".husky/pre-commit"), /npx --no-install -- lint-staged/)
        assert.match(p.read(".husky/commit-msg"), /command -v commitlint/)
        assert.match(p.read(".husky/commit-msg"), /npx --no-install commitlint --edit "\$1"/)
        const expectedVersionrc = scenario.esm ? ".versionrc.cjs" : ".versionrc.js"
        for (const file of [
            ".prettierrc.cjs",
            ".prettierignore",
            ".editorconfig",
            ".gitattributes",
            ".gitignore",
            expectedVersionrc,
        ]) {
            assert.ok(p.exists(file), file)
        }
        const firstConfig = p.read(name)
        assert.equal(p.init().status, 0)
        assert.equal(p.read(name), firstConfig, "重复初始化保留 ESLint 配置")
    })
}

test("已有 scripts 和 gitignore 保留；lint-staged 按现有设计替换", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            scripts: { lint: "custom-lint", build: "custom-build" },
            "lint-staged": { "*.custom": ["custom-check"] },
        }),
        ".gitignore": "private-files/\n",
    })
    assert.equal(p.init().status, 0)
    const pkg = JSON.parse(p.read("package.json"))
    assert.equal(pkg.scripts.lint, "custom-lint")
    assert.equal(pkg.scripts.build, "custom-build")
    assert.equal(p.read(".gitignore"), "private-files/\n")
    assert.equal(pkg["lint-staged"]["*.custom"], undefined)
})

test("遗留的 standard-version release 脚本被纠偏，其余自定义脚本仍保留（D3）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "legacy-project",
            scripts: { release: "standard-version", lint: "custom-lint" },
        }),
    })
    assert.equal(p.init().status, 0)
    const pkg = JSON.parse(p.read("package.json"))
    assert.equal(
        pkg.scripts.release,
        "commit-and-tag-version",
        "standard-version 已停维护且不在 peer 里，必须纠偏",
    )
    assert.equal(pkg.scripts.lint, "custom-lint", "非 standard-version 的自定义脚本不覆盖")
})

test("生成的 .prettierignore 默认排除各包管理器 lockfile（BUG-034 / issue #5）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({ name: "lockfile-ignore" }),
    })
    assert.equal(p.init().status, 0)
    const ignore = p.read(".prettierignore")
    for (const lock of ["pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb"]) {
        assert.ok(ignore.includes(lock), `应包含 ${lock}`)
    }
})

test("--merge 模式：已有配置原样保留、缺的补上、lint-staged 字段级保留（issue #7）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "merge-project",
            type: "module",
            scripts: { release: "standard-version", lint: "custom-lint" },
            "lint-staged": { "*.custom": ["custom-check"] },
        }),
        ".prettierrc.cjs": "// my custom prettier\n",
        ".versionrc.json": JSON.stringify({ types: [] }),
    })
    const r = p.init("--merge")
    assert.equal(r.status, 0, r.stderr + r.stdout)
    assert.equal(p.read(".prettierrc.cjs"), "// my custom prettier\n", "已有配置不覆盖")
    assert.ok(r.stdout.includes("保留 .prettierrc.cjs"), "打印保留清单")
    assert.ok(p.exists(".editorconfig"), "缺失文件照常生成")
    assert.ok(p.exists(".versionrc.cjs"), "versionrc 生成物照常生成")
    assert.ok(p.exists(".versionrc.json"), "merge 模式不动压优先级的旧配置")
    const pkg = JSON.parse(p.read("package.json"))
    assert.equal(pkg.scripts.lint, "custom-lint", "自定义脚本保留")
    assert.equal(pkg.scripts.release, "commit-and-tag-version", "standard-version 纠偏仍生效")
    assert.equal(pkg["lint-staged"]["*.custom"][0], "custom-check", "已有 lint-staged 保留")
    assert.equal(
        pkg["lint-staged"]["**/*.{js,ts,jsx,tsx,cjs,mjs,mts,cts}"],
        undefined,
        "lint-staged 字段级保留，不做键级混合",
    )
})

test("init 收尾 hook 自检：可执行位、未安装命令告警与 prepare 提示（issue #8）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({ name: "hook-check" }),
    })
    const r = p.init()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(r.stdout.includes("hook 自检"), "输出自检段")
    assert.ok(r.stdout.includes("lint-staged 未安装"), "命令未安装时明确告警")
    assert.ok(r.stdout.includes("prepare"), "提示 hooks 何时生效")
    assert.ok(
        (fs.statSync(path.join(p.dir, ".husky", "pre-commit")).mode & 0o111) !== 0,
        "可执行位在",
    )
})

test("有 CSS 预处理器时生成 lint:style 全量检查入口，无则不生成", (t) => {
    const withCss = project(t, {
        "package.json": JSON.stringify({
            name: "with-css",
            devDependencies: { sass: "^1" },
        }),
    })
    assert.equal(withCss.init().status, 0)
    const pkg1 = JSON.parse(withCss.read("package.json"))
    assert.match(pkg1.scripts["lint:style"], /stylelint/)
    assert.match(pkg1.scripts["lint:all"], /&& stylelint/, "lint:all 串联两个 lint")
    const noCss = project(t, {
        "package.json": JSON.stringify({ name: "no-css" }),
    })
    assert.equal(noCss.init().status, 0)
    const pkg2 = JSON.parse(noCss.read("package.json"))
    assert.equal(pkg2.scripts["lint:style"], undefined, "无预处理器不生成 lint:style")
})

test("显式 .ts 扩展名 import 项目：init 自动注入兼容段（BUG-037）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({ name: "explicit-ext", type: "module" }),
        "src/types/Foo.ts": "export interface Foo {\n    a: number\n}\n",
        "src/use.ts": 'import type { Foo } from "./types/Foo.ts"\nexport const f: Foo = { a: 1 }\n',
    })
    const r = p.init()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(r.stdout.includes("显式 .ts 扩展名"), "输出兼容提示")
    const config = p.read("eslint.config.mjs")
    assert.match(config, /兼容存量代码/, "注入兼容段")
    assert.match(config, /"import-x\/extensions": "off"/, "关闭扩展名强制")
})

test("无显式扩展名 import 的干净项目：不注入兼容段，保持严格（BUG-037）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({ name: "clean-imports", type: "module" }),
        "src/use.ts": 'import type { Foo } from "./types/Foo"\nexport const f: Foo = { a: 1 }\n',
    })
    assert.equal(p.init().status, 0)
    assert.doesNotMatch(p.read("eslint.config.mjs"), /兼容存量代码/)
})

test("doctor 识别 ESM-only peer（exports 仅 import 条件）为已安装（BUG-035）", (t) => {
    const esmPkg = (name, version) =>
        JSON.stringify({
            name,
            version,
            type: "module",
            exports: { ".": { import: "./index.js" } },
        })
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "esm-only-doctor",
            type: "module",
            devDependencies: { eslint: "^9", sass: "^1" },
        }),
        "node_modules/stylelint-config-recommended/package.json": esmPkg(
            "stylelint-config-recommended",
            "18.0.0",
        ),
        "node_modules/stylelint-config-recommended/index.js": "export default {}\n",
        "node_modules/stylelint-config-recommended-scss/package.json": esmPkg(
            "stylelint-config-recommended-scss",
            "17.0.1",
        ),
        "node_modules/stylelint-config-recommended-scss/index.js": "export default {}\n",
    })
    const r = p.run("bin/doctor")
    assert.equal(r.status, 1, "其余 peer 未装，整体仍应为 1")
    const offending = r.stdout
        .split("\n")
        .filter((line) => line.includes("✗") && /stylelint-config-recommended(-scss)? /.test(line))
    assert.deepEqual(offending, [], `ESM-only 包不得误报未安装：\n${offending.join("\n")}`)
})

test("--merge 预览与完成统计用「保留」语义，不再先报「覆盖」（BUG-036）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({ name: "merge-preview" }),
        ".prettierrc.cjs": "// custom\n",
    })
    const dry = p.init("--merge", "--dry-run")
    assert.equal(dry.status, 0)
    assert.ok(dry.stdout.includes("保留 .prettierrc.cjs"), "预览逐项为保留")
    assert.ok(!dry.stdout.includes("覆盖 .prettierrc.cjs"), "预览不得出现「覆盖」文案")
    assert.ok(dry.stdout.includes("小计：保留 1 个"), "小计统计语义一致")
    assert.ok(!dry.stdout.includes("小计：覆盖"))
    const real = p.init("--merge")
    assert.equal(real.status, 0)
    assert.ok(real.stdout.includes("初始化完成：保留"), "完成统计同样用保留语义")
    assert.equal(p.read(".prettierrc.cjs"), "// custom\n", "内容确实未被覆盖")
})

test("doctor：裸项目报未安装并以 1 退出；--help/--version 可用（issue #6）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({ name: "bare-doctor" }),
    })
    const r = p.run("bin/doctor")
    assert.equal(r.status, 1)
    assert.match(r.stdout, /my-code-style 未安装/)
    const help = p.run("bin/doctor", "--help")
    assert.equal(help.status, 0)
    assert.match(help.stdout, /Usage/)
    const version = p.run("bin/doctor", "--version")
    assert.equal(version.status, 0)
    assert.match(version.stdout, /^\d+\.\d+\.\d+/)
    const bad = p.run("bin/doctor", "--wat")
    assert.equal(bad.status, 1)
    assert.match(bad.stderr, /未知参数/)
})

test(
    "doctor：完整链上 runtime 的 base 项目体检全绿退出 0（issue #6）",
    { skip: !fs.existsSync(path.join(root, "demo-test/.runtime/node_modules/eslint")) },
    (t) => {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "healthy-doctor",
                devDependencies: { eslint: "^9.0.0" },
            }),
        })
        assert.equal(p.init().status, 0)
        fs.symlinkSync(
            path.join(root, "demo-test/.runtime/node_modules"),
            path.join(p.dir, "node_modules"),
            "dir",
        )
        const r = p.run("bin/doctor")
        assert.equal(r.status, 0, r.stdout + "\n" + r.stderr)
        assert.match(r.stdout, /全部健康/)
        assert.match(r.stdout, /peer 依赖 \d+ 个全部安装且版本达标/)
    },
)

test("ESM 项目同名旧版配置在 --backup 下备份并移除，由 .versionrc.cjs 接管（D2）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "esm-project",
            type: "module",
            scripts: { release: "standard-version" },
        }),
        ".versionrc.js": "module.exports = { types: [] }\n",
        ".versionrc.json": JSON.stringify({ types: [] }),
    })
    assert.equal(p.init("--backup").status, 0)
    assert.ok(p.exists(".versionrc.cjs"), "生成 .versionrc.cjs")
    assert.ok(!p.exists(".versionrc.js"), "旧 .versionrc.js 已移除")
    assert.ok(!p.exists(".versionrc.json"), "压优先级的 .versionrc.json 已移除")
    assert.ok(p.exists(".my-code-style-backup/.versionrc.js"), "旧 .versionrc.js 有备份")
    assert.ok(p.exists(".my-code-style-backup/.versionrc.json"), "旧 .versionrc.json 有备份")
    const pkg = JSON.parse(p.read("package.json"))
    assert.equal(pkg.scripts.release, "commit-and-tag-version", "D2 场景同时命中 D3 纠偏")
})

test("项目类型可从 peerDependencies 检测", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            peerDependencies: { vue: "^3", eslint: "^9" },
        }),
    })
    assert.equal(p.init().status, 0)
    assert.ok(p.read("eslint.config.mjs").includes('"my-code-style/eslint/flat/vue3"'))
})

test("Less 缺失依赖提示应包含 stylelint-config-html", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: { vue: "^3", less: "^4" },
        }),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(result.stdout, /stylelint-config-html@/)
})

test("混合 SCSS 和 Less 工程缺失依赖提示应同时包含 postcss-scss 和 postcss-less", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: { vue: "^3", sass: "^1", less: "^4" },
        }),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(result.stdout, /postcss-scss@/)
    assert.match(result.stdout, /postcss-less@/)
})

test("缺失依赖提示包含 typescript，并按包管理器给出可执行命令", (t) => {
    const cases = [
        ["pnpm-lock.yaml", "pnpm add -D my-code-style", "pnpm prepare", true],
        ["package-lock.json", "npm i -D my-code-style", "npm run prepare", false],
        ["yarn.lock", "yarn add -D my-code-style", "yarn prepare", false],
        ["bun.lockb", "bun add -d my-code-style", "bun run prepare", false],
    ]
    for (const [lock, installCommand, prepareCommand, pnpmBuildHint] of cases) {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "package-manager-detection",
                devDependencies: { eslint: "^9.0.0" },
            }),
            [lock]: "",
        })
        const result = p.init()
        assert.equal(result.status, 0, result.stderr)
        // typescript is a non-optional peer of @typescript-eslint/parser
        assert.match(result.stdout, /typescript@\^5\.0\.0/, `${lock}: 应提示安装 typescript`)
        assert.ok(result.stdout.includes(installCommand), `${lock}: 期望安装命令 ${installCommand}`)
        assert.ok(
            result.stdout.includes(prepareCommand),
            `${lock}: 期望 husky 初始化命令 ${prepareCommand}`,
        )
        // pnpm 10+ 拦截依赖构建脚本（如 unrs-resolver），仅 pnpm 需要提示
        assert.equal(
            result.stdout.includes("pnpm approve-builds"),
            pnpmBuildHint,
            `${lock}: approve-builds 提示`,
        )
    }

    // 已声明 typescript 时不再出现在缺失列表
    const installed = project(t, {
        "package.json": JSON.stringify({
            name: "typescript-installed",
            devDependencies: { eslint: "^9.0.0", typescript: "^5.4.0" },
        }),
        "pnpm-lock.yaml": "",
    })
    const result = installed.init()
    assert.equal(result.status, 0, result.stderr)
    const missing = result.stdout.split("\n").find((line) => line.includes("以下依赖未安装"))
    assert.ok(missing, "应输出缺失依赖列表")
    assert.ok(!/：typescript,|：typescript$/.test(missing), `typescript 不应重复提示: ${missing}`)
})

test("检测到会压过 .versionrc.cjs 的旧配置文件时给出警告", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "stale-versionrc",
            type: "module",
            devDependencies: { eslint: "^9.0.0" },
        }),
        ".versionrc": '{"header":"旧配置"}',
    })
    const result = p.init("--dry-run")
    assert.equal(result.status, 0, result.stderr)
    assert.match(
        result.stdout,
        /检测到 \.versionrc：发布工具会优先读取它，本次生成的 \.versionrc\.cjs 不会生效/,
    )
    assert.ok(!p.exists(".versionrc.cjs"), "dry-run 不得写文件")
})

test("init 输出按六步组织，dry-run 也完整预览依赖体检与下一步", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "six-step-output",
            devDependencies: { eslint: "^9.0.0", vue: "^3", sass: "^1" },
        }),
        "pnpm-lock.yaml": "",
    })
    const dry = p.init("--dry-run")
    assert.equal(dry.status, 0, dry.stderr)
    const titles = [
        "检测项目环境",
        "ESLint 入口",
        "配置文件与 Git hooks",
        "package.json",
        "依赖体检",
        "接下来",
    ]
    titles.forEach((title, i) => {
        assert.ok(dry.stdout.includes(`步骤 ${i + 1}/6 · ${title}`), `缺少步骤标题: ${title}`)
    })
    // dry-run 必须预览到依赖体检与安装命令（此前在这之前就 return 了）
    assert.match(dry.stdout, /以下依赖未安装（\d+ 个）/)
    assert.match(dry.stdout, /一键安装命令（可整段粘贴执行）/)
    assert.ok(dry.stdout.includes("Dry run 结束：未写入任何文件"))
    assert.ok(!p.exists(".prettierrc.cjs"), "dry-run 不得写文件")

    const real = p.init()
    assert.equal(real.status, 0, real.stderr)
    assert.match(real.stdout, /初始化完成：覆盖 0 个 · 新建 \d+ 个 · package\.json 已更新/)
})

test("一键安装命令对含 || 的版本范围加引号，可整段粘贴执行", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "quote-install-specs",
            devDependencies: { eslint: "^9.0.0", vue: "^3", sass: "^1" },
        }),
        "pnpm-lock.yaml": "",
    })
    const result = p.init()
    assert.equal(result.status, 0, result.stderr)
    // stylelint 的联合范围必须整体加引号，否则 || 会被 shell 当管道截断命令
    assert.ok(
        result.stdout.includes('"stylelint@^16.24.0 || ^17.0.0"'),
        "stylelint 联合范围应带双引号",
    )
    assert.ok(!result.stdout.includes(" stylelint@^16.24.0 ||"), "不应出现未加引号的 || 范围")
})

test("ESLint 版本识别：支持 npm alias、workspace、latest、联合范围及本地已安装版本", (t) => {
    // 1. npm alias: 8
    const pAlias8 = project(t, {
        "package.json": JSON.stringify({
            name: "alias-8",
            devDependencies: { eslint: "npm:eslint@^8.57.0" },
        }),
    })
    assert.equal(pAlias8.init().status, 0)
    assert.ok(pAlias8.exists(".eslintrc.cjs"))

    // 2. npm alias: 9
    const pAlias9 = project(t, {
        "package.json": JSON.stringify({
            name: "alias-9",
            devDependencies: { eslint: "npm:eslint@^9.0.0" },
        }),
    })
    assert.equal(pAlias9.init().status, 0)
    assert.ok(pAlias9.exists("eslint.config.mjs"))

    // 3. workspace protocol: 8
    const pWs8 = project(t, {
        "package.json": JSON.stringify({
            name: "ws-8",
            devDependencies: { eslint: "workspace:^8.0.0" },
        }),
    })
    assert.equal(pWs8.init().status, 0)
    assert.ok(pWs8.exists(".eslintrc.cjs"))

    // 4. latest tag: 9
    const pLatest = project(t, {
        "package.json": JSON.stringify({
            name: "latest-project",
            devDependencies: { eslint: "latest" },
        }),
    })
    assert.equal(pLatest.init().status, 0)
    assert.ok(pLatest.exists("eslint.config.mjs"))

    // 5. Multi-version range: ^8.57.0 || ^9.0.0 defaults to 9 Flat Config
    const pMulti = project(t, {
        "package.json": JSON.stringify({
            name: "multi-range",
            devDependencies: { eslint: "^8.57.0 || ^9.0.0" },
        }),
    })
    assert.equal(pMulti.init().status, 0)
    assert.ok(pMulti.exists("eslint.config.mjs"))

    // 6. Installed in node_modules takes top precedence
    const pInstalled8 = project(t, {
        "package.json": JSON.stringify({
            name: "installed-8",
            devDependencies: { eslint: "^8.57.0 || ^9.0.0" },
        }),
        "node_modules/eslint/package.json": JSON.stringify({
            name: "eslint",
            version: "8.57.0",
        }),
    })
    assert.equal(pInstalled8.init().status, 0)
    assert.ok(pInstalled8.exists(".eslintrc.cjs"))
})

test("ESLint 版本识别：范围语义（上限 <9 走 legacy，开口 >=8 走 flat）", (t) => {
    // "<9.0.0" can only install ESLint 8 — it must not generate a flat config.
    const pLt9 = project(t, {
        "package.json": JSON.stringify({
            name: "lt-9",
            devDependencies: { eslint: "<9.0.0" },
        }),
    })
    assert.equal(pLt9.init().status, 0)
    assert.ok(pLt9.exists(".eslintrc.cjs"))
    assert.ok(!pLt9.exists("eslint.config.mjs"))

    // ">=8.0.0" has no upper bound — npm installs 9, so flat config is required.
    for (const range of [">=8.0.0", "8.x - 9.x", "^8.57.0 || ^9.0.0", ">7.0.0"]) {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "open-range",
                devDependencies: { eslint: range },
            }),
        })
        assert.equal(p.init().status, 0, range)
        assert.ok(p.exists("eslint.config.mjs"), `${range} 应使用 Flat Config`)
    }

    // Upper-bounded ranges keep the legacy format even with a 9-like bound text.
    for (const range of ["<=8.57.0", "~8.57", ">=8.57.0 <9.0.0"]) {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "bounded-range",
                devDependencies: { eslint: range },
            }),
        })
        assert.equal(p.init().status, 0, range)
        assert.ok(p.exists(".eslintrc.cjs"), `${range} 应使用 .eslintrc.cjs`)
    }
})

test("存量 Less stylelint 配置不被误判为 SCSS 并覆盖", (t) => {
    const cases = [
        [
            'module.exports = require("my-code-style/stylelint/less")\n',
            "my-code-style/stylelint/less",
        ],
        ['module.exports = { customSyntax: "postcss-less" }\n', "postcss-less"],
    ]
    for (const [content, marker] of cases) {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "less-project",
                devDependencies: { vue: "^3" },
            }),
            ".stylelintrc.cjs": content,
        })
        assert.equal(p.init().status, 0)
        const written = p.read(".stylelintrc.cjs")
        assert.ok(
            written.includes("my-code-style/stylelint/less"),
            `${marker} 应保持 Less 入口，实际为 ${written}`,
        )
        const pkg = JSON.parse(p.read("package.json"))
        assert.deepEqual(pkg["lint-staged"]["**/*.{html,css,less}"], [
            "prettier --write",
            "stylelint --fix",
        ])
    }

    // The SCSS entry must still be detected as SCSS (no false "both").
    const scss = project(t, {
        "package.json": JSON.stringify({ name: "scss-project", devDependencies: { vue: "^3" } }),
        ".stylelintrc.cjs": 'module.exports = require("my-code-style/stylelint")\n',
    })
    assert.equal(scss.init().status, 0)
    assert.ok(!scss.read(".stylelintrc.cjs").includes("/less"))
})

test("无 package.json 时生成的 manifest 含 name 与 version", (t) => {
    const p = project(t)
    assert.equal(p.init().status, 0)
    const pkg = JSON.parse(p.read("package.json"))
    assert.ok(typeof pkg.name === "string" && pkg.name.length > 0, "生成的 manifest 缺少 name")
    assert.ok(
        typeof pkg.version === "string" && pkg.version.length > 0,
        "生成的 manifest 缺少 version",
    )
})

test("ESLint 7 及以下版本被拒绝并提示升级", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "legacy-unsupported",
            devDependencies: { eslint: "^7.32.0" },
        }),
    })
    const result = p.init()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /不支持 ESLint 7 版本/)
    assert.ok(!p.exists("eslint.config.mjs"))
    assert.ok(!p.exists(".eslintrc.cjs"))
})

test("ESLint 版本识别：monorepo 子目录向上读取工作区根已安装的版本", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "monorepo",
            private: true,
            workspaces: ["packages/*"],
        }),
        // 依赖被提升安装到工作区根，子包自己的声明只是范围
        "node_modules/eslint/package.json": JSON.stringify({
            name: "eslint",
            version: "8.57.0",
        }),
        "packages/app/package.json": JSON.stringify({
            name: "app",
            devDependencies: { eslint: "^8.57.0 || ^9.0.0" },
        }),
    })
    const result = p.initIn("packages/app")
    assert.equal(result.status, 0, result.stderr)
    assert.ok(
        p.exists("packages/app/.eslintrc.cjs"),
        "应按工作区根已安装的 ESLint 8 生成 legacy 配置",
    )
    assert.ok(!p.exists("packages/app/eslint.config.mjs"))
})

test("ESLint 版本识别：不越过非工作区祖先目录", (t) => {
    // 祖先目录里有 node_modules/eslint，但没有 package.json／workspace 标记；
    // 说明它不是当前项目的工作区根，不能拿它的版本来决定配置格式。
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "code-style-ancestor-"))
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }))
    fs.mkdirSync(path.join(parent, "node_modules/eslint"), { recursive: true })
    fs.writeFileSync(
        path.join(parent, "node_modules/eslint/package.json"),
        JSON.stringify({ name: "eslint", version: "9.39.5" }),
    )
    const app = path.join(parent, "app")
    fs.mkdirSync(app, { recursive: true })
    fs.writeFileSync(
        path.join(app, "package.json"),
        JSON.stringify({ name: "standalone", devDependencies: { eslint: "^8.57.0" } }),
    )

    const result = spawnSync(process.execPath, [path.join(root, "bin/init")], {
        cwd: app,
        encoding: "utf8",
        timeout: 10000,
    })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(fs.existsSync(path.join(app, ".eslintrc.cjs")), "应按声明的 ^8.57.0 生成 legacy 配置")
    assert.ok(!fs.existsSync(path.join(app, "eslint.config.mjs")))
})

test("ESLint 10 视为受支持版本，ESLint 11 才提示尚未声明支持", (t) => {
    const supported = project(t, {
        "package.json": JSON.stringify({
            name: "eslint-10",
            devDependencies: { eslint: "^10.0.0" },
        }),
    })
    const supportedResult = supported.init()
    assert.equal(supportedResult.status, 0, supportedResult.stderr)
    assert.ok(supported.exists("eslint.config.mjs"))
    assert.doesNotMatch(
        supportedResult.stdout + supportedResult.stderr,
        /尚未在 peerDependencies 声明支持/,
    )

    const future = project(t, {
        "package.json": JSON.stringify({
            name: "eslint-11",
            devDependencies: { eslint: "^11.0.0" },
        }),
    })
    const futureResult = future.init()
    assert.equal(futureResult.status, 0, futureResult.stderr)
    assert.match(futureResult.stdout, /ESLint 11 尚未在 peerDependencies 声明支持/)
})

test("--backup 参数在覆盖前备份已有文件到 .my-code-style-backup", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "backup-test",
            devDependencies: { eslint: "^9.0.0" },
        }),
        ".prettierrc.cjs": "// custom old prettier\n",
        ".versionrc.js": "// custom old versionrc\n",
    })
    const result = p.init("--backup")
    assert.equal(result.status, 0, result.stderr)
    assert.ok(p.exists(".my-code-style-backup/.prettierrc.cjs"))
    assert.equal(p.read(".my-code-style-backup/.prettierrc.cjs"), "// custom old prettier\n")
    assert.ok(p.exists(".my-code-style-backup/.versionrc.js"))
    assert.equal(p.read(".my-code-style-backup/.versionrc.js"), "// custom old versionrc\n")
    assert.notEqual(p.read(".prettierrc.cjs"), "// custom old prettier\n")

    // package.json is rewritten (scripts + lint-staged), so it must be backed up
    const backupPkg = JSON.parse(p.read(".my-code-style-backup/package.json"))
    assert.equal(backupPkg.devDependencies.eslint, "^9.0.0")
    assert.equal(backupPkg["lint-staged"], undefined)

    // the backup directory must not be committed
    assert.ok(p.read(".gitignore").includes(".my-code-style-backup/"))
})

test("--backup 备份用户自定义 lint-staged，并保持 .gitignore 幂等", (t) => {
    const manifest = JSON.stringify({
        name: "backup-lint-staged",
        devDependencies: { eslint: "^9.0.0" },
        scripts: { lint: "custom-lint" },
        "lint-staged": { "*.custom": ["custom-check"] },
    })
    const p = project(t, { "package.json": manifest, ".gitignore": "private-files/\n" })
    assert.equal(p.init("--backup").status, 0)

    const backupPkg = JSON.parse(p.read(".my-code-style-backup/package.json"))
    assert.deepEqual(backupPkg["lint-staged"], { "*.custom": ["custom-check"] })
    assert.equal(backupPkg.scripts.lint, "custom-lint")

    const gitignore = p.read(".gitignore")
    assert.ok(gitignore.startsWith("private-files/\n"), "既有 .gitignore 内容应保留")
    assert.equal(
        gitignore.split("\n").filter((line) => line === ".my-code-style-backup/").length,
        1,
    )

    // Repeated runs must not append duplicate entries
    assert.equal(p.init("--backup").status, 0)
    assert.equal(
        p
            .read(".gitignore")
            .split("\n")
            .filter((line) => line === ".my-code-style-backup/").length,
        1,
    )
})

test("初始化异常时执行事务回滚：恢复已有文件内容并清理新创建文件", (t) => {
    const originalPrettier = "// pre-existing prettier\n"
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "rollback-test",
            devDependencies: { eslint: "^9.0.0" },
        }),
        ".prettierrc.cjs": originalPrettier,
    })
    // 制造写入故障：创建同名目录 .editorconfig，导致 writeFile 发生 EISDIR 异常
    const fs = require("node:fs")
    const path = require("node:path")
    fs.mkdirSync(path.join(p.dir, ".editorconfig"))

    const result = p.init()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /初始化写入失败/)
    assert.match(result.stderr, /已成功回滚所有更改/)

    // 验证回滚行为
    assert.equal(p.read(".prettierrc.cjs"), originalPrettier, "已有文件内容已恢复")
    assert.ok(!p.exists("eslint.config.mjs"), "新创建的入口文件已被清理")
    assert.ok(!p.exists(".prettierignore"), "新创建的忽略文件已被清理")
    assert.ok(!p.exists(".husky"), "新创建的 husky 目录已被清理")
})

// --- 已装依赖的版本体检（pnpm 只 WARN、npm 直接 ERESOLVE，所以 init 主动查） ---

const manifest = (name, version, peerDependencies) =>
    JSON.stringify({ name, version, ...(peerDependencies ? { peerDependencies } : {}) })

test("依赖版本体检：已安装版本低于 peer 范围时提示并对齐", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: { vue: "^3", sass: "^1", "postcss-html": "^1.0.0" },
        }),
        "node_modules/postcss-html/package.json": manifest("postcss-html", "1.8.1"),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(result.stdout, /已安装，但版本与当前配置不匹配/)
    assert.match(result.stdout, /postcss-html 装了 1\.8\.1，本工具要求 \^2\.0\.0/)
    assert.match(result.stdout, /postcss-html@\^2\.0\.0/)
})

test("依赖版本体检：两位数主版本（stylelint 17）不再被静默跳过", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: {
                vue: "^3",
                sass: "^1",
                stylelint: "^17.0.0",
                "stylelint-config-recommended": "^18.0.0",
            },
        }),
        "node_modules/stylelint/package.json": manifest("stylelint", "17.15.0"),
        "node_modules/stylelint-config-recommended/package.json": manifest(
            "stylelint-config-recommended",
            "18.0.0",
            { stylelint: "^17.0.0" },
        ),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    // stylelint 17 满足 config-recommended@18 的 ^17.0.0，不应有任何版本体检噪音
    assert.doesNotMatch(result.stdout, /已安装，但版本与当前配置不匹配/)
})

test("依赖版本体检：上游配置的 peer 与实际安装冲突时提示", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: {
                vue: "^3",
                sass: "^1",
                stylelint: "^16.0.0",
                "stylelint-config-recommended": "^18.0.0",
            },
        }),
        "node_modules/stylelint/package.json": manifest("stylelint", "16.26.1"),
        "node_modules/stylelint-config-recommended/package.json": manifest(
            "stylelint-config-recommended",
            "18.0.0",
            { stylelint: "^17.0.0" },
        ),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(
        result.stdout,
        /stylelint-config-recommended@18\.0\.0 要求 stylelint@\^17\.0\.0，实际装了 16\.26\.1/,
    )
    assert.match(result.stdout, /stylelint@\^17\.0\.0/)
})

test("依赖版本体检：recess-order 7 缺少 stylelint-order 时提示补装", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: { vue: "^3", sass: "^1", "stylelint-config-recess-order": "^7.8.0" },
        }),
        "node_modules/stylelint-config-recess-order/package.json": manifest(
            "stylelint-config-recess-order",
            "7.8.0",
            { stylelint: "^16.18.0 || ^17.0.0", "stylelint-order": "^7.0.0 || ^8.0.0" },
        ),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(result.stdout, /stylelint-config-recess-order@7\.8\.0 需要 stylelint-order@/)
    assert.match(result.stdout, /stylelint-order@\^7\.0\.0 \|\| \^8\.0\.0/)
})

test("依赖版本体检：typescript-eslint 与 parser 版本错位时提示对齐", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: {
                eslint: "^9.0.0",
                "typescript-eslint": "^8.54.0",
                "@typescript-eslint/parser": "^8.48.0",
            },
        }),
        "node_modules/typescript-eslint/package.json": manifest("typescript-eslint", "8.69.0"),
        "node_modules/@typescript-eslint/parser/package.json": manifest(
            "@typescript-eslint/parser",
            "8.54.0",
        ),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(
        result.stdout,
        /@typescript-eslint\/parser@8\.54\.0 与 typescript-eslint@8\.69\.0 不是同一版本/,
    )
    assert.match(result.stdout, /@typescript-eslint\/parser@8\.69\.0/)
})

test("对齐命令对含 >= 的版本范围加引号（裸 > 会被 shell 当重定向）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "quote-align-specs",
            devDependencies: { eslint: "^9.0.0", "stylelint-prettier": "^5.0.0" },
        }),
        "node_modules/stylelint-prettier/package.json": manifest("stylelint-prettier", "5.0.3", {
            stylelint: ">=16.0.0",
        }),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(
        result.stdout,
        /stylelint-prettier@5\.0\.3 需要 stylelint@>=16\.0\.0，项目里没有安装/,
    )
    assert.ok(result.stdout.includes('"stylelint@>=16.0.0"'), "对齐命令的 >= 范围应带双引号")
    // 只检查命令行本身：体检消息行里的 >= 是给人看的说明，不受引号约束；
    // 包管理器按环境检测结果可能是 pnpm/npm/yarn/bun，断言只看规格引号
    const lines = result.stdout.split("\n")
    const alignIdx = lines.findIndex((line) => line.includes("对齐命令"))
    assert.ok(alignIdx >= 0 && alignIdx + 1 < lines.length, "应输出对齐命令")
    const alignCommand = lines[alignIdx + 1]
    assert.match(alignCommand, /"stylelint@>=16\.0\.0"/, "对齐命令应整段加引号")
    assert.doesNotMatch(
        alignCommand.replaceAll('"stylelint@>=16.0.0"', ""),
        /stylelint@/,
        "命令行里不应残留未加引号的规格",
    )
})

test("依赖版本体检：版本都匹配时不产生噪音", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: {
                vue: "^3",
                sass: "^1",
                stylelint: "^17.0.0",
                "stylelint-config-recommended": "^18.0.0",
                "stylelint-config-recess-order": "^7.8.0",
                "stylelint-order": "^8.0.0",
            },
        }),
        "node_modules/stylelint/package.json": manifest("stylelint", "17.15.0"),
        "node_modules/stylelint-config-recommended/package.json": manifest(
            "stylelint-config-recommended",
            "18.0.0",
            { stylelint: "^17.0.0" },
        ),
        "node_modules/stylelint-config-recess-order/package.json": manifest(
            "stylelint-config-recess-order",
            "7.8.0",
            { stylelint: "^16.18.0 || ^17.0.0", "stylelint-order": "^7.0.0 || ^8.0.0" },
        ),
        "node_modules/stylelint-order/package.json": manifest("stylelint-order", "8.1.1"),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.doesNotMatch(result.stdout, /已安装，但版本与当前配置不匹配/)
})

test("依赖版本体检：minor 级错位也能发现（10.2.0 不满足 ^10.3.0）", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: {
                vue: "^3",
                sass: "^1",
                eslint: "^9.0.0",
                "vue-eslint-parser": "^10.0.0",
            },
        }),
        "node_modules/vue-eslint-parser/package.json": manifest("vue-eslint-parser", "10.2.0"),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.match(result.stdout, /vue-eslint-parser 装了 10\.2\.0，本工具要求 \^10\.3\.0/)
    assert.match(result.stdout, /vue-eslint-parser@\^10\.3\.0/)
})

test("依赖版本体检：stylelint 16 线的合法组合不误报", (t) => {
    const p = project(t, {
        "package.json": JSON.stringify({
            name: "demo-consumer",
            devDependencies: {
                vue: "^3",
                sass: "^1",
                stylelint: "16.26.1",
                "stylelint-config-recommended": "^17.0.0",
                "stylelint-config-recommended-scss": "^16.0.0",
            },
        }),
        "node_modules/stylelint/package.json": manifest("stylelint", "16.26.1"),
        "node_modules/stylelint-config-recommended/package.json": manifest(
            "stylelint-config-recommended",
            "17.0.0",
            { stylelint: "^16.23.0" },
        ),
        "node_modules/stylelint-config-recommended-scss/package.json": manifest(
            "stylelint-config-recommended-scss",
            "16.0.2",
            { stylelint: "^16.24.0" },
        ),
    })
    const result = p.init()
    assert.equal(result.status, 0)
    assert.doesNotMatch(result.stdout, /已安装，但版本与当前配置不匹配/)
})

test("初始化结尾指引把 cz 用法说清楚（先 git add + 指到 README 手册）", (t) => {
    for (const [lock, isFlat] of [
        ["pnpm-lock.yaml", true],
        ["package-lock.json", false],
    ]) {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "cz-doc-pointer",
                devDependencies: { eslint: isFlat ? "^9.0.0" : "^8.57.0" },
            }),
            [lock]: "",
        })
        const result = p.init()
        assert.equal(result.status, 0, result.stderr)
        assert.match(result.stdout, /使用 czg 提交 commit/)
        // czg 由暂存区驱动：不先 git add 会直接退出，指引里必须写明
        assert.match(result.stdout, /先 git add 暂存改动/, result.stdout)
        // 使用手册随包发布（package.json files 含 README.md），指过去就能看到
        assert.match(result.stdout, /README《用 pnpm cz 提交》/, result.stdout)
    }
})
