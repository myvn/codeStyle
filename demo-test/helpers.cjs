const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const root = path.resolve(__dirname, "..")

function project(t, files = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "my-code-style-demo-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    for (const [name, contents] of Object.entries(files)) {
        const dest = path.join(dir, name)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, contents)
    }
    return {
        dir,
        read: (name) => fs.readFileSync(path.join(dir, name), "utf8"),
        exists: (name) => fs.existsSync(path.join(dir, name)),
        init: (...args) =>
            spawnSync(process.execPath, [path.join(root, "bin/init"), ...args], {
                cwd: dir,
                encoding: "utf8",
                timeout: 10000,
            }),
        // 在子目录里运行 init（monorepo 场景：工作区根安装了 ESLint，子包声明范围）
        initIn: (subdir, ...args) =>
            spawnSync(process.execPath, [path.join(root, "bin/init"), ...args], {
                cwd: path.join(dir, subdir),
                encoding: "utf8",
                timeout: 10000,
            }),
        node: (script) =>
            spawnSync(process.execPath, ["-e", script], {
                cwd: dir,
                encoding: "utf8",
                timeout: 10000,
            }),
    }
}
module.exports = { project, root }
