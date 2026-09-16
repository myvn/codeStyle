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

function toSingular(name) {
    if (!name) {
        return name
    }
    if (PLURAL_MAP[name]) {
        return PLURAL_MAP[name]
    }
    if (name.endsWith("ies") && name.length > 4) {
        return name.slice(0, -3) + "y"
    }
    if (/(?:[sxz]|[ch|sh])es$/.test(name)) {
        return name.slice(0, -2)
    }
    const nonPluralEndingInS = [
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
    if (nonPluralEndingInS.includes(name.toLowerCase())) {
        return name
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
        if (!fs.existsSync(resolved)) {
            continue
        }
        const scopes = fs
            .readdirSync(resolved, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => toSingular(dirent.name))
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
        if (!output) {
            return undefined
        }
        const line = output.split("\n").find((r) => /(?:src\/|src\\)/.test(r))
        if (!line) {
            return undefined
        }
        const match = line.match(/src[/\\]([^/\\]+)/)
        const rawName = match?.[1]
        if (!rawName) {
            return undefined
        }

        const resolvedDir = path.resolve(process.cwd(), "src", rawName)
        if (fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
            return toSingular(rawName)
        }
        return undefined
    } catch {
        return undefined
    }
}

module.exports = { generateScopes, guessCurrentScope }
