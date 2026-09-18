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
