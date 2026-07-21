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
    overrides: [
        {
            files: ["**/*.{vue,html}"],
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
    },
}