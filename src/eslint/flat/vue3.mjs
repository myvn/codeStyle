// Vue 3 ESLint Flat Config — extends base, adds Vue-specific rules

import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"
import parserVue from "vue-eslint-parser"
import baseConfig from "./base.mjs"

export default [
    // Spread all base configs first
    ...baseConfig,

    // Vue 3 essential rules
    ...pluginVue.configs["flat/essential"].map((config) => ({
        ...config,
        files: ["**/*.vue"],
    })),

    // Vue plugin setup and custom overrides
    {
        files: ["**/*.vue"],
        languageOptions: {
            parser: parserVue,
            parserOptions: {
                parser: tseslint.parser,
                sourceType: "module",
                ecmaVersion: "latest",
                extraFileExtensions: [".vue"],
            },
        },
        rules: {
            "vue/multi-word-component-names": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "vue/no-mutating-props": ["error", { shallowOnly: true }],
            "vue/html-indent": ["error", 4],
            "vue/script-indent": "off",
            "vue/html-self-closing": "off",
            "vue/max-attributes-per-line": "off",
            "vue/singleline-html-element-content-newline": "off",
        },
    },

    // .nvue specific overrides
    {
        files: ["*.nvue"],
        languageOptions: {
            parserOptions: {
                sourceType: "script",
            },
        },
        rules: {
            "vue/comment-directive": "off",
        },
    },
]

