// Base ESLint config for TypeScript projects
module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "standard",
        "prettier",
        "plugin:prettier/recommended",
    ],
    parserOptions: {
        ecmaVersion: "latest",
        parser: "@typescript-eslint/parser",
        sourceType: "module",
    },
    plugins: ["@typescript-eslint", "prettier", "import"],
    rules: {
        // Prettier 集成
        "prettier/prettier": ["error", { singleQuote: false, tabWidth: 4 }],
        // Import 相关
        "import/no-unresolved": "off",
        "import/extensions": [
            "error",
            "ignorePackages",
            { js: "never", jsx: "never", ts: "never", tsx: "never" },
        ],
        "import/prefer-default-export": ["off"],
        "import/no-extraneous-dependencies": "off",
        // TypeScript
        "@typescript-eslint/no-redeclare": "error",
        // 常用关闭
        "no-console": ["off"],
        "no-plusplus": "off",
        "no-shadow": "off",
        "no-underscore-dangle": "off",
        "no-use-before-define": "off",
        "no-undef": "off",
        "no-unused-vars": "off",
        "no-param-reassign": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "no-redeclare": "off",
        "prefer-promise-reject-errors": "off",
        // 引号规则
        quotes: ["error", "double", { avoidEscape: false, allowTemplateLiterals: true }],
    },
    settings: {
        "import/parsers": { "@typescript-eslint/parser": [".ts", ".tsx"] },
        "import/resolver": { typescript: {} },
    },
}
