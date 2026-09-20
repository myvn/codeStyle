// Commitlint scopes helper — dynamically generate scopes from project directories
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const PLURAL_MAP = {
    components: "component",
    views: "view",
    pages: "page",
    layouts: "layout",
    hooks: "hook",
    utils: "util",
    stores: "store",
    apis: "api",
    services: "service",
    plugins: "plugin",
    directives: "directive",
    filters: "filter",
    constants: "constant",
    helpers: "helper",
    scripts: "script",
    styles: "style",
    types: "types",
    settings: "setting",
    assets: "asset",
}

// Plurals whose singular cannot be derived by rule: uncountables, irregulars,
// and the "-e" + "s" words that would otherwise lose their stem ("caches" →
// "cach"). Everything else is handled by the suffix rules below.
const EXACT_SINGULAR = {
    news: "news",
    series: "series",
    movies: "movie",
    cookies: "cookie",
    caches: "cache",
    chases: "chase",
    niches: "niche",
}

// Directory names that already read as singular (or are conventional as-is)
const NON_PLURAL = [
    "status",
    "canvas",
    "bus",
    "pass",
    "process",
    "css",
    "less",
    "scss",
    "js",
    "ts",
    "types",
]

// Singulars that legitimately end in "s"/"z" and therefore take "-es":
// bus → buses, status → statuses. Without this list "buses" would follow the
// "-se + s" reading and become "buse".
const SIBILANT_SINGULARS = [
    "bus",
    "gas",
    "canvas",
    "alias",
    "atlas",
    "bias",
    "virus",
    "status",
    "process",
    "lens",
    "plus",
    "focus",
    "campus",
    "analysis",
    "axis",
    "basis",
    "crisis",
    "thesis",
    "quiz",
]

// Unambiguous "-es" plurals: the stem ends in a doubled sibilant or a digraph
// (classes, boxes, churches, dishes, buzzes, batches, fixes).
const ES_PLURAL = /(?:ss|zz|ch|sh|x)es$/i
// "-ses"/"-zes" are ambiguous: "cases" is case + s, "buses" is bus + es.
const S_OR_Z_ES_PLURAL = /[sz]es$/i

function toSingular(name) {
    if (!name) {
        return name
    }
    const lower = name.toLowerCase()
    if (PLURAL_MAP[lower]) {
        return PLURAL_MAP[lower]
    }
    if (EXACT_SINGULAR[lower]) {
        return EXACT_SINGULAR[lower]
    }
    if (NON_PLURAL.includes(lower)) {
        return name
    }
    if (/ies$/i.test(name) && name.length > 4) {
        return name.slice(0, -3) + "y"
    }
    if (ES_PLURAL.test(name)) {
        return name.slice(0, -2)
    }
    if (S_OR_Z_ES_PLURAL.test(name)) {
        const esStem = name.slice(0, -2).toLowerCase()
        return SIBILANT_SINGULARS.includes(esStem) ? name.slice(0, -2) : name.slice(0, -1)
    }
    if (name.endsWith("s") && !name.endsWith("ss") && name.length > 3) {
        return name.slice(0, -1)
    }
    return name
}

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
        let entries
        try {
            // A missing path, a plain file, or an unreadable directory must not
            // break the commitlint config load — just yield no scopes.
            entries = fs.readdirSync(resolved, { withFileTypes: true })
        } catch {
            continue
        }
        const scopes = entries
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => toSingular(dirent.name))
        allScopes.push(...scopes)
    }

    return [...new Set(allScopes)]
}

function getStagedFiles(cwd) {
    try {
        const output = execSync("git diff --cached --name-only -z", {
            cwd,
            stdio: ["pipe", "pipe", "ignore"],
            // 大仓库/大量暂存文件可能超过默认 1MB，避免 ENOBUFS 导致 scope 猜测整体失败
            maxBuffer: 64 * 1024 * 1024,
        }).toString()
        return output.split("\0").filter(Boolean)
    } catch {
        try {
            const output = execSync("git status --porcelain -z", {
                cwd,
                stdio: ["pipe", "pipe", "ignore"],
                maxBuffer: 64 * 1024 * 1024,
            }).toString()
            const parts = output.split("\0")
            const staged = []
            for (let i = 0; i < parts.length; i++) {
                const entry = parts[i]
                if (!entry) {
                    continue
                }
                const x = entry[0]
                const isRenameOrCopy = x === "R" || x === "C"
                const filePath = entry.slice(3)
                if (x !== " " && x !== "?" && x !== "!") {
                    if (filePath) {
                        staged.push(filePath)
                    }
                }
                if (isRenameOrCopy) {
                    i++
                }
            }
            return staged
        } catch {
            return []
        }
    }
}

/**
 * Guess the current scope from staged files in the git index.
 * Only staged files are considered (unstaged and untracked changes are ignored).
 * Multi-directory strategy: votes by the number of staged changes under each candidate scope directory;
 * in case of a tie, the first encountered scope among staged files is chosen.
 *
 * @param {string|string[]} [srcDirs="src"] - Source directory name(s) relative to cwd
 * @returns {string|undefined} Guessed scope name, or undefined if none matched
 */
function guessCurrentScope(srcDirs = "src") {
    try {
        const cwd = process.cwd()
        const rawPrefix = execSync("git rev-parse --show-prefix", {
            cwd,
            stdio: ["pipe", "pipe", "ignore"],
        })
            .toString()
            .trim()
        const prefix = rawPrefix.replace(/\\/g, "/")

        const stagedFiles = getStagedFiles(cwd)
        if (!stagedFiles || stagedFiles.length === 0) {
            return undefined
        }

        const normalizedDirs = (Array.isArray(srcDirs) ? srcDirs : [srcDirs])
            .map((d) => d.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
            .filter(Boolean)

        const candidateScopes = []

        for (const file of stagedFiles) {
            const normalizedFile = file.replace(/\\/g, "/")
            if (prefix && !normalizedFile.startsWith(prefix)) {
                continue
            }
            const relativeToCwd = prefix ? normalizedFile.slice(prefix.length) : normalizedFile

            for (const srcDir of normalizedDirs) {
                const dirPrefix = srcDir ? `${srcDir}/` : ""
                if (relativeToCwd.startsWith(dirPrefix)) {
                    const subPath = relativeToCwd.slice(dirPrefix.length)
                    const segments = subPath.split("/").filter(Boolean)
                    // Must have at least 2 segments (directory + file) to belong to a scope directory
                    if (segments.length >= 2) {
                        const rawName = segments[0]
                        const resolvedDir = path.resolve(cwd, srcDir, rawName)
                        if (fs.existsSync(resolvedDir)) {
                            if (fs.statSync(resolvedDir).isDirectory()) {
                                candidateScopes.push(toSingular(rawName))
                                break
                            }
                        } else {
                            // If deleted on disk, having segments >= 2 indicates it was a directory in git
                            candidateScopes.push(toSingular(rawName))
                            break
                        }
                    }
                }
            }
        }

        if (candidateScopes.length === 0) {
            return undefined
        }

        // Multi-directory selection strategy: vote by frequency; first encountered breaks ties
        const counts = new Map()
        const order = []

        for (const scope of candidateScopes) {
            if (!counts.has(scope)) {
                counts.set(scope, 0)
                order.push(scope)
            }
            counts.set(scope, counts.get(scope) + 1)
        }

        let bestScope = undefined
        let maxCount = 0
        for (const scope of order) {
            const count = counts.get(scope)
            if (count > maxCount) {
                maxCount = count
                bestScope = scope
            }
        }

        return bestScope
    } catch {
        return undefined
    }
}

module.exports = { generateScopes, guessCurrentScope }
