// Vue 3 ESLint config — extends base, adds Vue-specific rules
const base = require("./base.cjs")

module.exports = {
    ...base,
    parser: "vue-eslint-parser",
    extends: [...base.extends, "plugin:vue/vue3-essential"],
    parserOptions: {
        ...base.parserOptions,
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".vue"],
    },
    plugins: [...base.plugins, "vue"],
    overrides: [
        {
            env: { node: true },
            files: [".eslintrc.{js,cjs}", "*.nvue"],
            parserOptions: { sourceType: "script" },
            rules: { "vue/comment-directive": "off" },
        },
        ...(base.overrides || []),
    ],
    rules: {
        ...base.rules,
        "vue/multi-word-component-names": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "vue/no-mutating-props": ["error", { shallowOnly: true }],
        "vue/html-indent": "off",
        "vue/script-indent": "off",
        "vue/html-self-closing": "off",
        "vue/max-attributes-per-line": "off",
        "vue/singleline-html-element-content-newline": "off",
    },
}
