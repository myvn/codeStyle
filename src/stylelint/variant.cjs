// 样式方案（变体）判定原语：bin/init 与 bin/doctor 共用，避免两侧口径漂移。
//
// 背景（BUG-043）：doctor 曾只按 package.json 的依赖猜变体，其中
// `deps.less && (deps.sass || isVue)` 把「Vue + Less（无 sass）」判成 both，于是给
// 纯 Less 项目索要 postcss-scss / stylelint-config-recommended-scss —— 项目实际
// extends 的是 my-code-style/stylelint/less，这两个包装了也用不上，doctor 的
// 「一键补齐」还会诱导用户装无用依赖（下游 Vue 3 + Less 项目实测 exit 1）。
//
// 真正决定加载哪条线的是 stylelint 配置本身（统一入口顶层 extends 了
// recommended-scss，缺 peer 会直接加载失败），所以「体检 peer」必须以配置为准。
// init 的口径刻意不同：它要决定「生成哪份配置」，依赖是项目意图的更强信号，
// 因此保持 1.9.4 的顺序（先依赖、后配置），只是换成同一套原语。

const fs = require("fs")
const path = require("path")

// stylelint 官方配置查找顺序里的常见文件名；package.json 的 stylelint 字段单列处理
const CONFIG_FILES = [
    ".stylelintrc",
    ".stylelintrc.json",
    ".stylelintrc.yaml",
    ".stylelintrc.yml",
    ".stylelintrc.js",
    ".stylelintrc.cjs",
    ".stylelintrc.mjs",
    "stylelint.config.js",
    "stylelint.config.mjs",
    "stylelint.config.cjs",
]

/**
 * 读取项目已有的 stylelint 配置内容（含 package.json 的 stylelint 字段）。
 * 查找顺序对齐 stylelint 自己的 searchPlaces：package.json 优先，其后按 cosmiconfig
 * 的文件名顺序，命中即停。
 * @returns {string|null} 没有配置文件时返回 null
 */
function readStylelintConfig(projectRoot) {
    const pkgPath = path.join(projectRoot, "package.json")
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
            if (pkg.stylelint) {
                return JSON.stringify(pkg.stylelint)
            }
        } catch {
            // 非法 JSON 当作没有 package.json 处理（配置文件继续找）
        }
    }
    for (const file of CONFIG_FILES) {
        const configPath = path.join(projectRoot, file)
        if (!fs.existsSync(configPath)) {
            continue
        }
        try {
            return fs.readFileSync(configPath, "utf8")
        } catch {
            // 读不出来（无权限、同名目录等）就继续找下一个候选文件
            continue
        }
    }
    return null
}

/**
 * 从已有配置内容判定变体。
 * @returns {"less"|"scss"|"both"|"unknown"|null}
 *   less/scss/both — 命中明确标记；unknown — 有配置文件但认不出变体（纯手写规则）；
 *   null — 项目没有 stylelint 配置
 */
function variantFromConfig(projectRoot) {
    const content = readStylelintConfig(projectRoot)
    if (content === null) {
        return null
    }
    // "my-code-style/stylelint" 是 "my-code-style/stylelint/less" 的前缀，
    // 所以 Less 入口必须先匹配（BUG-003 的教训）。
    const usesLess =
        /my-code-style\/stylelint\/less(?:-override)?/.test(content) ||
        content.includes("postcss-less") ||
        content.includes("stylelint-config-recommended-less")
    const usesScss =
        /my-code-style\/stylelint(?![-\w/])/.test(content) ||
        content.includes("postcss-scss") ||
        content.includes("stylelint-config-recommended-scss")
    if (usesLess && usesScss) {
        return "both"
    }
    if (usesLess) {
        return "less"
    }
    if (usesScss) {
        return "scss"
    }
    return "unknown"
}

/**
 * 从依赖判定变体（sass / node-sass / sass-loader 与 less / less-loader 的组合）。
 * @returns {"less"|"scss"|"both"|null} 认不出时返回 null
 */
function variantFromDeps(deps = {}) {
    const hasSass = Boolean(deps.sass || deps["node-sass"] || deps["sass-loader"])
    const hasLess = Boolean(deps.less || deps["less-loader"])
    if (hasSass && hasLess) {
        return "both"
    }
    if (hasLess) {
        return "less"
    }
    if (hasSass) {
        return "scss"
    }
    return null
}

/**
 * 依赖判定 + Vue/uni-app 项目默认走统一（SCSS）入口 —— 与 bin/init 的兜底一致。
 * @returns {"less"|"scss"|"both"|null}
 */
function variantFromDepsWithVueDefault(deps, isVue) {
    return variantFromDeps(deps) ?? (isVue ? "scss" : null)
}

/**
 * 体检口径（doctor）：配置内容优先，认不出再看依赖。
 * @returns {"less"|"scss"|"both"|null} null = 项目不涉及样式检查
 */
function detectVariant(projectRoot, deps, isVue) {
    const fromConfig = variantFromConfig(projectRoot)
    if (fromConfig && fromConfig !== "unknown") {
        return fromConfig
    }
    return variantFromDepsWithVueDefault(deps, isVue)
}

module.exports = {
    readStylelintConfig,
    variantFromConfig,
    variantFromDeps,
    variantFromDepsWithVueDefault,
    detectVariant,
}
