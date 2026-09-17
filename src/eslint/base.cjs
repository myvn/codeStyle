// Base ESLint config for TypeScript projects
module.exports = {
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
    plugins: ["@typescript-eslint", "prettier", "import"],
    overrides: [
        {
            files: ["**/*.cjs", "**/.*rc.js", "**/*.config.js"],
            rules: { "@typescript-eslint/no-require-imports": "off" },
        },
    ],
    rules: {
        // Prettier 集成
        "prettier/prettier": [
            "error",
            {
                singleQuote: false,
                tabWidth: 4,
                semi: false,
                trailingComma: "all",
                endOfLine: "lf",
            },
        ],
        // 格式化与风格
        indent: "off",
        semi: ["error", "never"],
        quotes: ["error", "double", { avoidEscape: false, allowTemplateLiterals: true }],
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

        // Standard JS 风格规则已通过手动配置实现，不再依赖 eslint-config-standard
        "style/quotes": "off",
        "style/semi": "off",
    },
    settings: {
        "import/parsers": { "@typescript-eslint/parser": [".ts", ".tsx"] },
        "import/resolver": { typescript: {} },
    },
}
