// Vue 3 ESLint Flat Config — extends base, adds Vue-specific rules

import pluginVue from "eslint-plugin-vue"
import baseConfig from "./base.mjs"

export default [
    // Spread all base configs first
    ...baseConfig,

    // Vue 3 essential rules
    // Replaces: extends: ["plugin:vue/vue3-essential"]
    // Must scope to .vue files only
    ...pluginVue.configs["flat/essential"].map((config) => ({
        ...config,
        files: ["**/*.vue"],
    })),

    // Vue plugin setup and custom overrides
    {
        files: ["**/*.vue"],
        languageOptions: {
            parserOptions: {
                parser: "@typescript-eslint/parser",
                sourceType: "module",
            },
        },
        rules: {
            "vue/multi-word-component-names": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "vue/no-mutating-props": ["error", { shallowOnly: true }],
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
