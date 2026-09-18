const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { project, root } = require("./helpers.cjs")
const modulePath = JSON.stringify(path.join(root, "src/commitlint/scopes.cjs"))

test("目录转 scope：单数转换、多目录去重、跳过文件", (t) => {
    const p = project(t, {
        "src/components/Button.vue": "",
        "src/utils/index.ts": "",
        "src/types/index.ts": "",
        "src/index.ts": "",
        "packages/components/Card.vue": "",
        "packages/pages/Home.vue": "",
    })
    const result = p.node(
        `const { generateScopes } = require(${modulePath}); console.log(JSON.stringify(generateScopes(["src", "packages", "missing"])))`,
    )
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout).sort(), ["component", "page", "types", "util"])
})

test("不存在源码目录时返回空 scope 列表", (t) => {
    const p = project(t)
    const result = p.node(`console.log(JSON.stringify(require(${modulePath}).generateScopes()))`)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), [])
})

test("目录转 scope：复数边界（-s 与 -es 不可互相误判）", (t) => {
    const expected = {
        interfaces: "interface",
        cases: "case",
        databases: "database",
        devices: "device",
        courses: "course",
        prizes: "prize",
        caches: "cache",
        houses: "house",
        news: "news",
        series: "series",
        classes: "class",
        boxes: "box",
        churches: "church",
        statuses: "status",
        processes: "process",
        buses: "bus",
        categories: "category",
        movies: "movie",
    }
    const files = Object.fromEntries(
        Object.keys(expected).map((name) => [`src/${name}/index.ts`, ""]),
    )
    const p = project(t, files)
    const result = p.node(
        `const { generateScopes } = require(${modulePath}); console.log(JSON.stringify(generateScopes()))`,
    )
    assert.equal(result.status, 0, result.stderr)
    const scopes = JSON.parse(result.stdout)
    for (const [plural, singular] of Object.entries(expected)) {
        assert.ok(
            scopes.includes(singular),
            `${plural} 应转换为 ${singular}，实际: ${scopes.join(",")}`,
        )
    }
    assert.equal(
        scopes.length,
        Object.keys(expected).length,
        `不应产生重复/多余 scope: ${scopes.join(",")}`,
    )
})

test("源码目录是文件时不抛异常，返回空列表", (t) => {
    const p = project(t, { src: "// not a directory\n" })
    const result = p.node(
        `const { generateScopes } = require(${modulePath}); console.log(JSON.stringify(generateScopes()))`,
    )
    assert.equal(result.status, 0, `stderr: ${result.stderr}`)
    assert.deepEqual(JSON.parse(result.stdout), [])
})

const { execSync } = require("node:child_process")

function setupGit(dir) {
    execSync("git init", { cwd: dir, stdio: "ignore" })
    execSync("git config user.name test && git config user.email test@example.com", {
        cwd: dir,
        stdio: "ignore",
    })
    execSync("git config commit.gpgSign false", { cwd: dir, stdio: "ignore" })
}

test("guessCurrentScope: 非 Git 目录或无暂存时返回 undefined", (t) => {
    const p = project(t, { "src/components/Button.vue": "<template />" })
    const nonGit = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(nonGit.status, 0, nonGit.stderr)
    assert.equal(JSON.parse(nonGit.stdout), null)

    setupGit(p.dir)
    // Working tree has files, but nothing is staged
    const unstagedOnly = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(unstagedOnly.status, 0, unstagedOnly.stderr)
    assert.equal(JSON.parse(unstagedOnly.stdout), null)
})

test("guessCurrentScope: 只依据暂存区，工作区未暂存及未跟踪改动不影响结果", (t) => {
    const p = project(t, {
        "src/components/Button.vue": "<template />",
        "src/utils/math.ts": "export const a = 1",
    })
    setupGit(p.dir)
    execSync("git add src/components/Button.vue && git commit -m 'init'", {
        cwd: p.dir,
        stdio: "ignore",
    })

    // Unstaged modification in components, untracked in views
    execSync("node -e \"require('fs').writeFileSync('src/components/Button.vue', 'changed')\"", {
        cwd: p.dir,
        stdio: "ignore",
    })
    execSync(
        "node -e \"require('fs').mkdirSync('src/views'); require('fs').writeFileSync('src/views/Home.vue', 'home')\"",
        { cwd: p.dir, stdio: "ignore" },
    )

    // Staged modification in utils
    execSync("git add src/utils/math.ts", { cwd: p.dir, stdio: "ignore" })

    const result = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(result.status, 0, result.stderr)
    // Only src/utils/math.ts is staged, so scope must be "util"
    assert.equal(JSON.parse(result.stdout), "util")
})

test("guessCurrentScope: 覆盖重命名与删除场景（包括目录在磁盘上被移除）", (t) => {
    const p = project(t, {
        "src/components/Old.vue": "<template />",
        "src/views/ViewA.vue": "<template />",
        "src/services/api.ts": "export const api = {}",
    })
    setupGit(p.dir)
    execSync("git add . && git commit -m 'init'", { cwd: p.dir, stdio: "ignore" })

    // 1. Rename: Old.vue -> New.vue within components
    execSync("git mv src/components/Old.vue src/components/New.vue", {
        cwd: p.dir,
        stdio: "ignore",
    })
    const renameRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(renameRes.status, 0, renameRes.stderr)
    assert.equal(JSON.parse(renameRes.stdout), "component")

    // Commit rename to clear index
    execSync("git commit -m 'chore: rename'", { cwd: p.dir, stdio: "ignore" })

    // 2. Cross-directory rename: ViewA.vue -> components/ViewA.vue
    execSync("git mv src/views/ViewA.vue src/components/ViewA.vue", { cwd: p.dir, stdio: "ignore" })
    const crossRenameRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(crossRenameRes.status, 0, crossRenameRes.stderr)
    assert.equal(JSON.parse(crossRenameRes.stdout), "component")

    execSync("git commit -m 'chore: cross rename'", { cwd: p.dir, stdio: "ignore" })

    // 3. Staged delete: delete api.ts and remove services directory completely from disk
    execSync("git rm src/services/api.ts", { cwd: p.dir, stdio: "ignore" })
    const deleteRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(deleteRes.status, 0, deleteRes.stderr)
    assert.equal(JSON.parse(deleteRes.stdout), "service")
})

test("guessCurrentScope: 覆盖中文路径与空格路径", (t) => {
    const p = project(t, {
        "src/用户 模块/登录 页面.vue": "<template />",
        "src/my helpers/my string.ts": "export const str = ''",
    })
    setupGit(p.dir)

    // Staged Chinese path with space
    execSync('git add "src/用户 模块/登录 页面.vue"', { cwd: p.dir, stdio: "ignore" })
    const zhRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(zhRes.status, 0, zhRes.stderr)
    assert.equal(JSON.parse(zhRes.stdout), "用户 模块")

    // Staged space path
    execSync("git reset", { cwd: p.dir, stdio: "ignore" })
    execSync('git add "src/my helpers/my string.ts"', { cwd: p.dir, stdio: "ignore" })
    const spaceRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(spaceRes.status, 0, spaceRes.stderr)
    assert.equal(JSON.parse(spaceRes.stdout), "my helper")
})

test("guessCurrentScope: 多目录按修改数量投票，平票时按首个暂存文件确定", (t) => {
    const p = project(t, {
        "src/components/A.vue": "a",
        "src/components/B.vue": "b",
        "src/utils/math.ts": "m",
        "src/index.ts": "root file",
    })
    setupGit(p.dir)

    // Stage root file (no scope directory) + 2 in components + 1 in utils
    execSync("git add src/index.ts src/components/A.vue src/components/B.vue src/utils/math.ts", {
        cwd: p.dir,
        stdio: "ignore",
    })
    const voteRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(voteRes.status, 0, voteRes.stderr)
    assert.equal(JSON.parse(voteRes.stdout), "component")

    // Tie test: 1 in components, 1 in utils
    execSync("git reset", { cwd: p.dir, stdio: "ignore" })
    execSync("git add src/components/A.vue src/utils/math.ts", { cwd: p.dir, stdio: "ignore" })
    const tieRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(tieRes.status, 0, tieRes.stderr)
    assert.equal(JSON.parse(tieRes.stdout), "component")

    // Reverse tie order
    execSync("git reset", { cwd: p.dir, stdio: "ignore" })
    execSync("git add src/utils/math.ts", { cwd: p.dir, stdio: "ignore" })
    const utilOnly = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(utilOnly.status, 0, utilOnly.stderr)
    assert.equal(JSON.parse(utilOnly.stdout), "util")
})

test("guessCurrentScope: 支持自定义多源码目录与直接位于根目录的文件", (t) => {
    const p = project(t, {
        "packages/components/Card.vue": "<template />",
        "src/main.ts": "console.log()",
    })
    setupGit(p.dir)

    // Only root file in src/ -> no directory segment, returns null
    execSync("git add src/main.ts", { cwd: p.dir, stdio: "ignore" })
    const rootRes = p.node(
        `const res = require(${modulePath}).guessCurrentScope(); console.log(JSON.stringify(res === undefined ? null : res))`,
    )
    assert.equal(rootRes.status, 0, rootRes.stderr)
    assert.equal(JSON.parse(rootRes.stdout), null)

    // Custom srcDirs with packages
    execSync("git add packages/components/Card.vue", { cwd: p.dir, stdio: "ignore" })
    const pkgRes = p.node(
        `console.log(JSON.stringify(require(${modulePath}).guessCurrentScope(["src", "packages"])))`,
    )
    assert.equal(pkgRes.status, 0, pkgRes.stderr)
    assert.equal(JSON.parse(pkgRes.stdout), "component")
})

test("guessCurrentScope: 暂存文件输出超过默认 1MB 缓冲时不再失败（大仓库 ENOBUFS）", (t) => {
    const p = project(t, { "src/components/Button.vue": "" })
    // 用假 git 模拟超大暂存区：约 1.5MB，超过 execSync 默认的 1MB maxBuffer
    const shimDir = path.join(p.dir, "fake-bin")
    fs.mkdirSync(shimDir, { recursive: true })
    fs.writeFileSync(
        path.join(shimDir, "git"),
        `#!/usr/bin/env node
const args = process.argv.slice(2)
if (args.includes("--cached")) {
    process.stdout.write("src/components/Button.vue\\0".repeat(60000))
} else if (args[0] === "rev-parse") {
    process.stdout.write("\\n")
}
`,
        { mode: 0o755 },
    )
    const result = spawnSync(
        process.execPath,
        ["-e", `console.log(JSON.stringify(require(${modulePath}).guessCurrentScope()))`],
        {
            cwd: p.dir,
            encoding: "utf8",
            env: { ...process.env, PATH: `${shimDir}${path.delimiter}${process.env.PATH}` },
        },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout), "component", result.stderr)
})
