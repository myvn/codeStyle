// Stylelint config for Vue/SCSS/Less projects
module.exports = {
    root: true,
    extends: [
        "stylelint-config-recommended",
        "stylelint-config-recommended-scss",
        "stylelint-config-recommended-vue/scss",
        "stylelint-config-html/vue",
    ],
    plugins: ["stylelint-prettier"],
    ignoreFiles: [
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/public/**",
        "**/assets/iconfont/**",
        "**/*.min.css",
    ],
    overrides: [
        {
            files: ["**/*.{vue,nvue,html}"],
            customSyntax: "postcss-html",
            // 内联 style="..." 属性同时被 prettier（经 eslint-plugin-prettier 以 vue
            // 解析器处理整份 SFC）格式化；stylelint 侧任何声明级 fixer（recess-order
            // 重排、stylelint-prettier）对同一批内联属性都有独立主张，且 postcss-html
            // 把属性内容 round-trip 时会有损（实测产生前导空格、丢失分号后空格），
            // 两边对"正确形态"永远谈不拢——lint-staged 链 stylelint 最后执行，提交
            // 产物永远 prettier-red，门禁无法收敛（下游 1.8.5 升级实测，BUG-031）。
            // 因此 vue/html 交给 prettier 全权格式化：这里既关 stylelint-prettier，
            // 也不启用 recess-order；<style> 块的格式化由 prettier CLI / eslint
            // --fix 承担，stylelint 只保留下面 rules 里的语义规则。
            rules: { "prettier/prettier": null },
        },
        {
            files: ["**/*.{css,scss}"],
            customSyntax: "postcss-scss",
            // recess-order 只在纯样式文件生效（extends 在 lint 时惰性解析，
            // 配置本体保持无 peer 可加载）；vue/html 的内联属性不参与排序
            extends: ["stylelint-config-recess-order"],
        },
        {
            files: ["**/*.less"],
            customSyntax: "postcss-less",
            extends: ["stylelint-config-recess-order"],
        },
    ],
    rules: {
        "prettier/prettier": true,
        // Less and SCSS both use @ for non-standard at-rules
        "at-rule-no-unknown": null,
        // 允许 global、export、v-deep 等伪类
        "selector-pseudo-class-no-unknown": [
            true,
            { ignorePseudoClasses: ["global", "export", "v-deep", "deep"] },
        ],
        // Allow ::v-deep / /deep/ pseudo-elements
        "selector-pseudo-element-no-unknown": [
            true,
            { ignorePseudoElements: ["v-deep", "deep", "ng-deep"] },
        ],
        // Less built-in functions unknown to Stylelint
        "function-no-unknown": null,
        // 允许小程序单位 rpx
        "unit-no-unknown": [true, { ignoreUnits: ["rpx"] }],
        // 允许小程序 page 标签
        "selector-type-no-unknown": [true, { ignoreTypes: ["page"] }],
        "comment-empty-line-before": "never",
        "custom-property-empty-line-before": "never",
        "no-empty-source": null,
        "comment-no-empty": null,
        "no-duplicate-selectors": null,
        "scss/comment-no-empty": null,
        "selector-class-pattern": null,
        "font-family-no-missing-generic-family-keyword": null,
        // 现代 CSS 语法与选择器宽松放行
        "selector-not-notation": null,
        "import-notation": null,
        "media-feature-range-notation": null,
        "no-descending-specificity": null,
        // 业务样式容错放行
        "block-no-empty": null,
        "scss/at-extend-no-missing-placeholder": null,
        // 兼容混合 Less 及 Vue 内嵌 Less 语法，避免 stylelint-scss 规则解析崩溃或误报
        "scss/operator-no-newline-after": null,
        "scss/operator-no-newline-before": null,
        "scss/operator-no-unspaced": null,
        "scss/no-global-function-names": null,
    },
}
