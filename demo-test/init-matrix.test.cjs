const { test } = require("node:test")
const assert = require("node:assert/strict")
const { project } = require("./helpers.cjs")
const cases = require("./fixtures/projects.json")

for (const scenario of cases) {
    test(`初始化场景：${scenario.name}`, (t) => {
        const p = project(t, {
            "package.json": JSON.stringify({
                name: "demo-consumer",
                devDependencies: scenario.dependencies,
            }),
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
            scenario.legacy ? "eslint . --ext .js,.cjs,.mjs,.ts,.mts,.cts" : "eslint .",
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
        assert.equal(p.read(".husky/pre-commit"), "npx --no-install -- lint-staged\n")
        assert.equal(p.read(".husky/commit-msg"), 'npx --no-install commitlint --edit "${1}"\n')
        for (const file of [
            ".prettierrc.cjs",
            ".prettierignore",
            ".editorconfig",
            ".gitattributes",
            ".gitignore",
            ".versionrc.js",
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
