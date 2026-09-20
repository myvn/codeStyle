// Base ESLint Flat Config for TypeScript projects (ESLint v9+)
// Equivalent to src/eslint/base.cjs but in flat config format

import js from "@eslint/js"
import tseslint from "typescript-eslint"
import importX from "eslint-plugin-import-x"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"
import eslintConfigPrettier from "eslint-config-prettier"
import globals from "globals"
import { prettierRules, commonRules } from "./_shared.mjs"

export default [
    // Ignore patterns
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/coverage/**",
            "**/public/**",
            "**/assets/iconfont/**",
            "**/*.min.js",
            "**/*.min.css",
        ],
    },

    // ESLint 官方推荐规则
    // Replaces: extends: ["eslint:recommended"] — 缺失它会让 flat 配置弱于传统配置
    // （no-debugger / no-cond-assign / no-constant-condition / no-empty 等不会被检查）
    js.configs.recommended,

    // TypeScript recommended rules
    // Replaces: extends: ["plugin:@typescript-eslint/recommended"]
    ...tseslint.configs.recommended,

    // eslint-plugin-import-x configuration
    // Replaces: plugin:import/recommended (ESLint 8 equivalent in src/eslint/base.cjs)
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue,nvue}"],
        plugins: {
            "import-x": importX,
        },
        rules: {
            ...importX.configs.recommended.rules,
        },
        settings: {
            "import-x/resolver": {
                typescript: true,
                node: true,
            },
        },
    },

    // Global language options for JS/TS/JSX/TSX
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
    },

    // Prettier integration (replaces: extends: ["plugin:prettier/recommended"])
    eslintPluginPrettierRecommended,

    // eslint-config-prettier disables rules that conflict with Prettier —
    // including `curly`, which Prettier never rewrites.
    eslintConfigPrettier,

    // Shared rules for all JS, TS, JSX, TSX and Vue files.
    // MUST come after eslint-config-prettier: in flat config a later entry wins,
    // so explicit rules such as `curly` would otherwise be silently switched off.
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue,nvue}"],
        rules: {
            ...commonRules,
            ...prettierRules,
        },
    },

    // CommonJS files and config files legitimately need require()
    {
        files: ["**/*.cjs", "**/.*rc.js", "**/*.config.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },

    // .nvue file handling (uni-app) — mirrors the legacy config, which parses
    // nvue script blocks as modules so `import` works.
    {
        files: ["**/*.nvue"],
        languageOptions: {
            parserOptions: {
                sourceType: "module",
            },
        },
    },
]
