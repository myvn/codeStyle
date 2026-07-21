// Base ESLint Flat Config for TypeScript projects (ESLint v9+)
// Equivalent to src/eslint/base.cjs but in flat config format

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
        ],
    },

    // TypeScript recommended rules
    // Replaces: extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"]
    ...tseslint.configs.recommended,

    // eslint-plugin-import-x configuration
    // Replaces: plugin:import/recommended + eslint-config-standard (via FlatCompat)
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
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

    // Prettier integration
    // Replaces: extends: ["plugin:prettier/recommended"]
    eslintPluginPrettierRecommended,

    // eslint-config-prettier MUST be last — disables conflicting ESLint rules
    eslintConfigPrettier,

    // Global language options + shared rules
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
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
            },
        },
        rules: {
            ...prettierRules,
            ...commonRules,
        },
    },

    // .nvue file handling (uni-app)
    {
        files: ["**/*.nvue"],
        languageOptions: {
            parserOptions: {
                sourceType: "script",
            },
        },
    },
]
