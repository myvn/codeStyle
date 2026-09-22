// Stylelint config for Vue/Less projects
module.exports = {
    root: true,
    extends: [
        "stylelint-config-recommended",
        "stylelint-config-recommended-vue",
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
            files: ["**/*.less"],
            customSyntax: "postcss-less",
        },
    ],
    rules: {
        "prettier/prettier": true,
        // Less uses @ for variables/mixins/etc
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
        // 关闭属性-值匹配校验：stylelint-config-recommended 默认开启它，会把
        // `width: 750rpx` 报成 unknown value（ Less 线没有 scss 配置包那层关闭，
        // BUG-029 深测实测）；SCSS 线上游（recommended-scss）本就将其置 null，
        // 这里对齐，保证 uni-app Less 项目 rpx 写法不误报。
        "declaration-property-value-no-unknown": null,
        // 允许小程序 page 标签
        "selector-type-no-unknown": [true, { ignoreTypes: ["page"] }],
        "comment-empty-line-before": "never",
        "custom-property-empty-line-before": "never",
        "no-empty-source": null,
        "comment-no-empty": null,
        "no-duplicate-selectors": null,
        "selector-class-pattern": null,
        "font-family-no-missing-generic-family-keyword": null,
        // 现代 CSS 语法与选择器宽松放行
        "selector-not-notation": null,
        "import-notation": null,
        "media-feature-range-notation": null,
        "no-descending-specificity": null,
        // 业务样式容错放行
        "block-no-empty": null,
    },
}
