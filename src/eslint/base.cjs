// Base ESLint config for TypeScript projects
//
// Prettier 选项以 src/prettier/index.cjs 为唯一来源，避免 rules 与 prettier 配置文件漂移
const prettierConfig = require("../prettier/index.cjs")
const { overrides: _prettierOverrides, ...prettierOptions } = prettierConfig

module.exports = {
    // 阻止 eslintrc 的级联合并：没有它，祖先目录（monorepo 根 / 上层目录）的
    // .eslintrc 会被静默合并进来 —— 实测两个后果：① 根配置里本包没声明的规则
    // （eqeqeq 之类）漏进子项目，报出与本包口径无关的错；② 根配置引用的插件
    // 子项目没装时整条 lint 直接崩（ESLint couldn't find the plugin）。
    // 本包的 stylelint 配置一直带 root: true，ESLint 侧对齐（BUG-042）。
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    parser: "@typescript-eslint/parser",
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "prettier",
        "plugin:prettier/recommended",
    ],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
        },
    },
    // Mirrors the ignores of src/eslint/flat/base.mjs: without them `eslint .`
    // lints build output (dist/, coverage/) and fails on generated code.
    ignorePatterns: [
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/public/**",
        "**/assets/iconfont/**",
        "**/*.min.js",
        "**/*.min.css",
    ],
    plugins: ["@typescript-eslint", "prettier", "import"],
    overrides: [
        {
            files: ["**/*.cjs", "**/.*rc.js", "**/*.config.js"],
            rules: { "@typescript-eslint/no-require-imports": "off" },
        },
    ],
    rules: {
        // Prettier 集成
        "prettier/prettier": ["error", prettierOptions],
        // 格式化与风格
        indent: "off",
        semi: ["error", "never"],
        // avoidEscape must stay true: Prettier keeps the cheaper quote when a
        // string contains double quotes ('say "hi"'), so requiring an escape
        // here produces an error that --fix can never resolve.
        quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
        curly: ["error", "all"],
        "comma-dangle": ["error", "always-multiline"],
        "object-curly-spacing": ["error", "always"],
        "array-bracket-spacing": ["error", "never"],

        // Import 相关
        "import/no-unresolved": "off",
        "import/extensions": [
            "error",
            "ignorePackages",
            { js: "never", jsx: "never", ts: "never", tsx: "never" },
        ],
        "import/prefer-default-export": "off",
        "import/no-extraneous-dependencies": "off",

        // TypeScript
        "@typescript-eslint/no-redeclare": "error",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-empty-object-type": "off",

        // 常用关闭
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
    },
    settings: {
        "import/parsers": { "@typescript-eslint/parser": [".ts", ".tsx"] },
        "import/resolver": { typescript: {} },
    },
}
