// Commitlint scopes helper — dynamically generate scopes from project directories
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

/**
 * Generate scopes by reading directory names
 * @param {string|string[]} srcDirs - Source directory name(s) relative to cwd
 * @returns {string[]} Scope names
 */
function generateScopes(srcDirs = "src") {
    const dirs = Array.isArray(srcDirs) ? srcDirs : [srcDirs]
    const allScopes = []

    for (const srcDir of dirs) {
        const resolved = path.resolve(process.cwd(), srcDir)
        if (!fs.existsSync(resolved)) continue
        const scopes = fs
            .readdirSync(resolved, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name.replace(/s$/, ""))
        allScopes.push(...scopes)
    }

    return [...new Set(allScopes)]
}

/**
 * Guess the current scope from git status (modified files under src/)
 * @returns {string|undefined}
 */
function guessCurrentScope() {
    try {
        const output = execSync("git status --porcelain || true").toString().trim()
        const line = output.split("\n").find((r) => r.includes("M  src"))
        if (!line) return undefined
        return line
            .replace(/\//g, "%%")
            .match(/src%%((\w|-)*)/)?.[1]
            ?.replace(/s$/, "")
    } catch {
        return undefined
    }
}

module.exports = { generateScopes, guessCurrentScope }
