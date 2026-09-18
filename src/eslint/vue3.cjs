// Vue 3 ESLint config — extends base, adds Vue-specific rules
const base = require("./base.cjs")

// .nvue 覆写必须携带完整 Prettier 选项：规则内联 options 会整体替换而非合并
const prettierConfig = require("../prettier/index.cjs")
const { overrides: _prettierOverrides, ...prettierOptions } = prettierConfig

module.exports = {
    ...base,
    parser: "vue-eslint-parser",
    extends: [...base.extends, "plugin:vue/essential"],
    parserOptions: {
        ...base.parserOptions,
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".vue", ".nvue"],
    },
    plugins: [...base.plugins, "vue"],
    overrides: [
        {
            env: { node: true },
            files: [".eslintrc.{js,cjs}"],
            parserOptions: { sourceType: "script" },
            rules: { "vue/comment-directive": "off" },
        },
        ...(base.overrides || []),
        {
            files: ["**/*.nvue"],
            parserOptions: { sourceType: "module" },
            rules: {
                "vue/comment-directive": "off",
                semi: "off",
                "prettier/prettier": ["error", { ...prettierOptions, parser: "vue", semi: true }],
            },
        },
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
