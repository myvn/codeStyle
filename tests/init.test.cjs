const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const cli = path.resolve(__dirname, "../bin/init")

function fixture(t, files = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "code-style-test-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
        fs.writeFileSync(path.join(dir, name), content)
    }
    return {
        dir,
        run: (...args) =>
            spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: "utf8" }),
        read: (name) => fs.readFileSync(path.join(dir, name), "utf8"),
        exists: (name) => fs.existsSync(path.join(dir, name)),
        snapshot: () => snapshot(dir),
    }
}
function snapshot(dir) {
    return fs
        .readdirSync(dir)
        .sort()
        .map((name) => {
            const file = path.join(dir, name)
            return [
                name,
                fs.statSync(file).isDirectory() ? snapshot(file) : fs.readFileSync(file, "utf8"),
            ]
        })
}
const manifest = (version = "^9.0.0", extra = {}) =>
    JSON.stringify({
        name: "fixture",
        devDependencies: { eslint: version },
        ...extra,
    })
for (const invalid of [
    "{invalid",
    "null",
    "[]",
    '{"dependencies":{"eslint":9}}',
    '{"scripts":[]}',
]) {
    test(`invalid manifest is read-only: ${invalid}`, (t) => {
        const f = fixture(t, {
            "package.json": invalid,
            ".prettierrc.cjs": "custom",
            ".husky/pre-commit": "custom hook",
        })
        const before = f.snapshot()
        assert.equal(f.run().status, 1)
        assert.deepEqual(f.snapshot(), before)
    })
}
for (const args of [
    ["--help"],
    ["-h"],
    ["--version"],
    ["-v"],
    ["--dry-rnu"],
    ["--version", "--bad"],
]) {
    test(`safe CLI arguments: ${args}`, (t) => {
        const f = fixture(t, { "package.json": manifest() })
        const before = f.snapshot()
        const r = f.run(...args)
        assert.equal(r.status, args.some((a) => ["--dry-rnu", "--bad"].includes(a)) ? 1 : 0)
        assert.deepEqual(f.snapshot(), before)
    })
}
for (const name of [
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
]) {
    test(`preserve existing Flat Config: ${name}`, (t) => {
        const f = fixture(t, { "package.json": manifest(), [name]: "custom config" })
        assert.equal(f.run().status, 0)
        assert.equal(f.read(name), "custom config")
        assert.deepEqual(
            fs.readdirSync(f.dir).filter((n) => n.startsWith("eslint.config.")),
            [name],
        )
    })
}
for (const [version, name] of [
    ["^9", ".eslintrc.cjs"],
    ["^9", ".eslintrc.json"],
    ["^8", "eslint.config.js"],
]) {
    test(`format conflict exits without writes: ${version} ${name}`, (t) => {
        const f = fixture(t, { "package.json": manifest(version), [name]: "custom" })
        const before = f.snapshot()
        assert.equal(f.run().status, 1)
        assert.deepEqual(f.snapshot(), before)
    })
}
test("legacy config without declared ESLint requires explicit migration", (t) => {
    const f = fixture(t, { "package.json": '{"name":"fixture"}', ".eslintrc.js": "custom" })
    const before = f.snapshot()
    assert.equal(f.run().status, 1)
    assert.deepEqual(f.snapshot(), before)
})
test("ESLint 8 preserves legacy config", (t) => {
    const f = fixture(t, { "package.json": manifest("^8"), ".eslintrc.json": "{}" })
    assert.equal(f.run().status, 0)
    assert.equal(f.read(".eslintrc.json"), "{}")
    assert.equal(f.exists(".eslintrc.cjs"), false)
})
for (const [version, name] of [
    ["^9", "eslint.config.mjs"],
    ["^8", ".eslintrc.cjs"],
]) {
    test(`fresh initialization and dry-run: ${version}`, (t) => {
        const f = fixture(t, {
            "package.json": manifest(version, { scripts: { lint: "custom lint" } }),
        })
        const before = f.snapshot()
        assert.equal(f.run("--dry-run").status, 0)
        assert.deepEqual(f.snapshot(), before)
        assert.equal(f.run().status, 0)
        assert.equal(f.exists(name), true)
        assert.equal(JSON.parse(f.read("package.json")).scripts.lint, "custom lint")
    })
}
test("initialization without a manifest remains supported", (t) => {
    const f = fixture(t)
    assert.equal(f.run().status, 0)
    assert.equal(f.exists("package.json"), true)
    assert.equal(f.exists("eslint.config.mjs"), true)
})

test("no manifest: does not guess a CSS preprocessor", (t) => {
    const f = fixture(t)
    assert.equal(f.run().status, 0)
    // Without a package.json there is no way to tell whether the project uses
    // SCSS/Less; the tool must not install a stylelint stack by default.
    assert.equal(f.exists(".stylelintrc.cjs"), false)
    const pkg = JSON.parse(f.read("package.json"))
    const lintStaged = JSON.stringify(pkg["lint-staged"] || {})
    assert.ok(!lintStaged.includes("stylelint"), lintStaged)
})
