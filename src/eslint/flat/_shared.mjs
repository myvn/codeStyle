// Shared constants and rule objects for Flat Config files
import prettierConfig from "../../prettier/index.cjs"

// Prettier 选项以 src/prettier/index.cjs 为唯一来源，避免 rules 与配置文件漂移
const { overrides: _prettierOverrides, ...prettierOptions } = prettierConfig

/**
 * Prettier plugin rules — mirrors base.cjs prettier/prettier config
 */
export const prettierRules = {
    "prettier/prettier": ["error", prettierOptions],
}

/**
 * .nvue 覆写：规则内联 options 会整体替换而非合并，必须携带完整选项
 */
export const nvuePrettierRules = {
    "prettier/prettier": ["error", { ...prettierOptions, parser: "vue", semi: true }],
}

/**
 * Common rules shared across all flat config levels — mirrors base.cjs rules
 */
export const commonRules = {
    // 缩进由 Prettier 统一负责，关闭 ESLint 缩进避免打架
    indent: "off",
    semi: ["error", "never"],
    // avoidEscape must stay true: Prettier keeps the cheaper quote when a
    // string contains double quotes ('say "hi"'), so requiring an escape here
    // produces an error that --fix can never resolve.
    quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
    curly: ["error", "all"],
    "comma-dangle": ["error", "always-multiline"],
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],

    // Import rules (using import-x for flat config compatibility)
    "import-x/no-unresolved": "off",
    // 与 legacy 的 import/extensions 对齐（NIT-012）：相对导入的 js/jsx/ts/tsx 不带
    // 扩展名；mjs/cjs 未列出、按规则默认要求带扩展名（与本仓 .mjs 互引一致）
    "import-x/extensions": [
        "error",
        "ignorePackages",
        { js: "never", jsx: "never", ts: "never", tsx: "never" },
    ],
    "import-x/prefer-default-export": "off",
    "import-x/no-extraneous-dependencies": "off",

    // TypeScript
    "@typescript-eslint/no-redeclare": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-empty-object-type": "off",

    // Commonly disabled
    "no-console": "off",
    "no-plusplus": "off",
    "no-shadow": "off",
    "no-underscore-dangle": "off",
    "no-use-before-define": "off",
    "no-undef": "off",
    "no-unused-vars": "off",
    "no-unused-expressions": "off",
    "no-param-reassign": "off",
    "no-redeclare": "off",
    "prefer-promise-reject-errors": "off",

    // Standard JS uses @stylistic style/quotes — disable to avoid conflict
    "style/quotes": "off",
    "style/semi": "off",
}

/**
 * Uni-app global variables — mirrors uniapp.cjs globals
 */
export const uniappGlobals = {
    $t: true,
    uni: true,
    UniApp: true,
    wx: true,
    WechatMiniprogram: true,
    getCurrentPages: true,
    UniHelper: true,
    Page: true,
    App: true,
    NodeJS: true,
}
