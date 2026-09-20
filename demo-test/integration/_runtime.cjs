// 集成测试共享引导：隔离运行环境、源码同步与公共 helper。
//
// 每个 *.test.cjs 由 node --test 在不同进程（且可能并行）中执行，而它们都要用
// <runtime>/node_modules/my-code-style 里的当前源码，因此同步必须加锁：
// 只在源码指纹变化时拷贝一次，其余进程等指纹落盘后再继续，避免读到写了一半的文件。
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { createRequire } = require("node:module")
const { pathToFileURL } = require("node:url")
const { spawnSync } = require("node:child_process")

const root = path.resolve(__dirname, "../..")
const runtime = path.join(root, "demo-test/.runtime")
if (!fs.existsSync(path.join(runtime, "node_modules/eslint"))) {
    throw new Error("先运行 npm run test:integration:setup；安装冲突时见 demo-test/README.md")
}
const localRequire = createRequire(path.join(runtime, "package.json"))
// Copy current code, not the published package. Dependencies resolve in isolation.
const copy = path.join(runtime, "node_modules/my-code-style")

const STAMP = path.join(runtime, ".my-code-style-sync.json")
const LOCK = path.join(runtime, ".my-code-style-sync.lock")
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** 源码指纹：文件名 + 大小 + mtime，足以判断是否需要重新同步 */
function fingerprint() {
    const hash = crypto.createHash("sha1")
    const walk = (dir, prefix) => {
        for (const entry of fs
            .readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const rel = `${prefix}${entry.name}`
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walk(full, `${rel}/`)
            } else {
                const stat = fs.statSync(full)
                hash.update(`${rel}:${stat.size}:${stat.mtimeMs}\n`)
            }
        }
    }
    walk(path.join(root, "src"), "src/")
    const pkg = fs.statSync(path.join(root, "package.json"))
    hash.update(`package.json:${pkg.size}:${pkg.mtimeMs}\n`)
    return hash.digest("hex")
}

function syncedFingerprint() {
    try {
        return JSON.parse(fs.readFileSync(STAMP, "utf8")).src
    } catch {
        return null
    }
}

function syncRuntime() {
    const stamp = fingerprint()
    if (syncedFingerprint() === stamp) {
        return
    }

    // mkdir 是原子操作：抢到锁的进程负责拷贝，其他进程等指纹落盘
    let ownsLock = false
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
        try {
            fs.mkdirSync(LOCK)
            ownsLock = true
            break
        } catch (error) {
            if (error.code !== "EEXIST") {
                throw error
            }
            if (syncedFingerprint() === stamp) {
                return
            }
            try {
                // 上次运行崩溃留下的过期锁
                if (Date.now() - fs.statSync(LOCK).mtimeMs > 120000) {
                    fs.rmdirSync(LOCK)
                }
            } catch {
                /* ignore stale lock removal errors */
            }
            sleep(100)
        }
    }

    try {
        fs.mkdirSync(copy, { recursive: true })
        fs.cpSync(path.join(root, "src"), path.join(copy, "src"), { recursive: true })
        fs.copyFileSync(path.join(root, "package.json"), path.join(copy, "package.json"))
        fs.writeFileSync(STAMP, JSON.stringify({ src: stamp, at: new Date().toISOString() }))
    } finally {
        if (ownsLock) {
            try {
                fs.rmdirSync(LOCK)
            } catch {
                /* ignore lock cleanup errors */
            }
        }
    }
}

syncRuntime()

// prettier / eslint 体积不小（约 130ms），只有真正用到的文件才加载：
// 这些以 getter 形式导出，测试文件解构到哪个才加载哪个。
const getPrettier = () => localRequire("prettier")
const getPrettierConfig = () => localRequire("my-code-style/prettier")
const getESLint = () => localRequire("eslint").ESLint

async function eslint(level = "base") {
    const config = (
        await import(pathToFileURL(path.join(copy, `src/eslint/flat/${level}.mjs`)).href)
    ).default
    return new (getESLint())({ cwd: runtime, overrideConfigFile: true, overrideConfig: config })
}

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

// Full hook chain. Unlike the earlier focused commit-msg test, these fixtures
// retain BOTH generated hooks and run real lint-staged against the Git index.
function commitProject(t, style = "scss") {
    // 诊断用：MY_CODE_STYLE_FIXTURE_DIR 可把 fixture 挪到别处（例如系统临时目录），
    // 用来判断仓库目录上的备份/同步/杀毒代理是不是并发时的隐形串行点。
    const fixtureRoot = process.env.MY_CODE_STYLE_FIXTURE_DIR || runtime
    fs.mkdirSync(fixtureRoot, { recursive: true })
    const dir = fs.mkdtempSync(path.join(fixtureRoot, "full-hooks-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    // 身份与开关用环境变量传给所有 git（含 hook 内部起的 git），
    // 省掉每个 fixture 4 次 `git config` 进程 —— 整套集成测试原本要为此起 92 次。
    const env = {
        ...process.env,
        HUSKY: "1",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "Demo Test",
        GIT_AUTHOR_EMAIL: "demo@example.invalid",
        GIT_COMMITTER_NAME: "Demo Test",
        GIT_COMMITTER_EMAIL: "demo@example.invalid",
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "commit.gpgsign",
        GIT_CONFIG_VALUE_0: "false",
        GIT_CONFIG_KEY_1: "core.autocrlf",
        GIT_CONFIG_VALUE_1: "false",
    }
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
    // 让 fixture 看起来像真实项目：husky 会把 node_modules/.bin 前置到 PATH，
    // 生成的 hook 因此能直连本地 lint-staged/commitlint（测试顺带覆盖这条快路径），
    // 而不是每次提交都起一个 npm CLI。符号链接不复制文件、也不需要额外进程。
    fs.symlinkSync(path.join(runtime, "node_modules"), path.join(dir, "node_modules"), "junction")
    git("init", "-q")
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

module.exports = {
    root,
    runtime,
    copy,
    localRequire,
    get prettier() {
        return getPrettier()
    },
    get prettierConfig() {
        return getPrettierConfig()
    },
    get ESLint() {
        return getESLint()
    },
    eslint,
    commitlint,
    commitProject,
}
