// Stylelint config for Vue/SCSS/Less projects
module.exports = {
    root: true,
    extends: [
        "stylelint-config-recommended",
        "stylelint-config-recommended-scss",
        "stylelint-config-recommended-vue/scss",
        "stylelint-config-html/vue",
        "stylelint-config-recess-order",
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
        },
        {
            files: ["**/*.{css,scss}"],
            customSyntax: "postcss-scss",
        },
        {
            files: ["**/*.less"],
            customSyntax: "postcss-less",
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
    },
}
