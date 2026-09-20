/**
 * Stylelint 17 兼容性回归。
 *
 * 背景：我们在 peerDependencies 里声明了 `stylelint ^16.23 || ^17`（以及
 * recommended ^17||^18、recommended-scss ^16||^17、recess-order ^5||^6||^7），
 * 声明支持就必须真的跑一遍——stylelint 17 时代整条配置链都换了主版本
 * （config-recommended 18、recommended-scss 17、postcss-html 2、stylelint-order 8）。
 * 这些用例用真实 stylelint 17 CLI 加载 init 生成的 `.stylelintrc.cjs`，
 * 覆盖 scss / less / 混合三种工程形态。
 */
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")
const { spawnSync } = require("node:child_process")

const root = path.resolve(__dirname, "../..")
const runtime = path.join(root, "demo-test/.runtime-sl17")
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number)
const SUPPORTED = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 12)
const skip = SUPPORTED
    ? false
    : `stylelint 17 生态要求 Node >= 22.12（当前 ${process.versions.node}）`

if (SUPPORTED) {
    assert.ok(
        fs.existsSync(path.join(runtime, "node_modules/stylelint")),
        "先运行 npm run test:stylelint17:setup",
    )
}

const req = SUPPORTED ? createRequire(path.join(runtime, "package.json")) : null
// 有些配置包用 exports 封闭了 ./package.json，直接读文件更稳
const installedVersion = (name) =>
    JSON.parse(
        fs.readFileSync(
            path.join(runtime, "node_modules", ...name.split("/"), "package.json"),
            "utf8",
        ),
    ).version
const stylelintManifest = SUPPORTED ? req("stylelint/package.json") : null
const binRelative =
    typeof stylelintManifest?.bin === "object"
        ? stylelintManifest.bin.stylelint
        : stylelintManifest?.bin || "bin/stylelint.mjs"
const stylelintBin = SUPPORTED
    ? path.join(path.dirname(req.resolve("stylelint/package.json")), binRelative)
    : ""

if (SUPPORTED) {
    // 生成的 .stylelintrc.cjs 通过包名引用 my-code-style/stylelint，把当前源码放进隔离环境
    const copy = path.join(runtime, "node_modules/my-code-style")
    fs.mkdirSync(copy, { recursive: true })
    fs.cpSync(path.join(root, "src"), path.join(copy, "src"), { recursive: true })
    fs.copyFileSync(path.join(root, "package.json"), path.join(copy, "package.json"))
}

/** 在隔离环境里建一个消费工程，跑真实 init，然后可以用 stylelint CLI 检查它 */
function consumer(t, { dependencies = {}, files = {} } = {}) {
    const dir = fs.mkdtempSync(path.join(runtime, "consumer-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "stylelint17-consumer", devDependencies: dependencies }),
    )
    for (const [name, content] of Object.entries(files)) {
        const dest = path.join(dir, name)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, content)
    }
    const init = spawnSync(process.execPath, [path.join(root, "bin/init")], {
        cwd: dir,
        encoding: "utf8",
        timeout: 30000,
    })
    assert.equal(init.status, 0, init.stderr)
    return {
        dir,
        init,
        write: (name, content) => {
            const dest = path.join(dir, name)
            fs.mkdirSync(path.dirname(dest), { recursive: true })
            fs.writeFileSync(dest, content)
        },
        read: (name) => fs.readFileSync(path.join(dir, name), "utf8"),
        exists: (name) => fs.existsSync(path.join(dir, name)),
        lint: (args) => {
            const result = spawnSync(process.execPath, [stylelintBin, ...args], {
                cwd: dir,
                encoding: "utf8",
                timeout: 60000,
            })
            // stylelint 17 的报告可能走 stderr（取决于格式化器），断言时合并看
            result.output = `${result.stdout}
${result.stderr}`
            return result
        },
    }
}

const vueScss = { vue: "^3", sass: "^1", stylelint: "^17.0.0" }
const vueLess = { vue: "^3", less: "^4", stylelint: "^17.0.0" }
const vueBoth = { vue: "^3", sass: "^1", less: "^4", stylelint: "^17.0.0" }

test("隔离环境装的是 stylelint 17（不是 16）", { skip }, () => {
    const installed = installedVersion("stylelint")
    assert.equal(installed.split(".")[0], "17", `实际装的是 ${installed}`)
    assert.equal(installedVersion("stylelint-config-recommended").split(".")[0], "18")
    assert.equal(installedVersion("postcss-html").split(".")[0], "2")
})

test("生成的 .stylelintrc.cjs 在 stylelint 17 下可加载并放过正常 SCSS", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueScss,
        files: { "src/style.scss": ".a {\n    color: red;\n}\n" },
    })
    assert.ok(p.exists(".stylelintrc.cjs"), "应生成 stylelint 配置")
    const result = p.lint(["src/style.scss"])
    assert.equal(result.status, 0, result.output)
})

test("stylelint 17 下非法属性仍被拦截（SCSS）", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueScss,
        files: { "src/bad.scss": ".a {\n    colour: red;\n}\n" },
    })
    const result = p.lint(["src/bad.scss"])
    assert.notEqual(result.status, 0)
    assert.match(result.output, /property-no-unknown/)
})

test("stylelint 17 下 --fix 生效且幂等（SCSS）", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueScss,
        files: { "src/bad.scss": ".a{color:red;}\n" },
    })
    const first = p.lint(["--fix", "src/bad.scss"])
    assert.equal(first.status, 0, first.output)
    const fixed = p.read("src/bad.scss")
    assert.match(fixed, /\.a \{\n {4}color: red;\n\}\n/)
    const second = p.lint(["--fix", "src/bad.scss"])
    assert.equal(second.status, 0)
    assert.equal(p.read("src/bad.scss"), fixed, "第二次修复不应再改动文件")
})

test("stylelint 17 下 Vue 单文件的内嵌 SCSS 样式被检查", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueScss,
        files: {
            "src/Bad.vue":
                '<template><div class="a" /></template>\n<style lang="scss">\n.a {\n    colour: red;\n}\n</style>\n',
        },
    })
    const result = p.lint(["src/Bad.vue"])
    assert.notEqual(result.status, 0)
    assert.match(result.output, /property-no-unknown/)
})

test("stylelint 17 下 Less 工程使用 less 分支配置", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueLess,
        files: { "src/bad.less": ".a {\n    colour: red;\n}\n" },
    })
    const config = p.read(".stylelintrc.cjs")
    assert.match(config, /my-code-style\/stylelint\/less/)
    const result = p.lint(["src/bad.less"])
    assert.notEqual(result.status, 0)
    assert.match(result.output, /property-no-unknown/)
})

test("stylelint 17 下混合 SCSS + Less 工程两种文件都能检查", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueBoth,
        files: {
            "src/a.scss": ".a {\n    colour: red;\n}\n",
            "src/b.less": ".b {\n    colour: blue;\n}\n",
            "src/good.less": ".c {\n    color: blue;\n}\n",
        },
    })
    const scss = p.lint(["src/a.scss"])
    assert.notEqual(scss.status, 0)
    assert.match(scss.output, /property-no-unknown/)
    const less = p.lint(["src/b.less"])
    assert.notEqual(less.status, 0)
    assert.match(less.output, /property-no-unknown/)
    const good = p.lint(["src/good.less"])
    assert.equal(good.status, 0, good.output)
})

test("stylelint-order（recess-order 7 的 peer）在 stylelint 17 下可用", { skip }, (t) => {
    const p = consumer(t, {
        dependencies: vueScss,
        files: { "src/order.scss": ".a {\n    color: red;\n    display: block;\n}\n" },
    })
    const result = p.lint(["src/order.scss"])
    assert.notEqual(result.status, 0, "位置属性顺序错误应被 recess-order 报出")
    assert.match(result.output, /order\/properties-order|recess-order|properties-order/)
})
