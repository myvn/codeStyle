// Less-specific Stylelint override configuration
// Usage: merge into your Stylelint config when your project uses Less

module.exports = {
    overrides: [
        {
            files: ["**/*.less"],
            customSyntax: "postcss-less",
        },
    ],
    rules: {
        // Less uses @ for variables, mixins, etc. — disable globally
        "at-rule-no-unknown": null,
        // Less built-in functions (darken, lighten, fade...) unknown to Stylelint
        "function-no-unknown": null,
        // Less 变量出现在媒体查询里（`@media (max-width: @screen-md)`）、Less 的
        // `@import (reference) "m.less"` 选项，在 CSS 语法里都非法，会被 recommended
        // 开启的这两条规则判死且无法 --fix（与 less.cjs 同源：BUG-040 / BUG-041）。
        // 走 less-override 合并的项目同样需要这层放行。
        "media-query-no-invalid": null,
        "at-rule-prelude-no-invalid": null,
        // Allow ::v-deep / /deep/ / ::ng-deep pseudo-elements
        "selector-pseudo-element-no-unknown": [
            true,
            { ignorePseudoElements: ["v-deep", "deep", "ng-deep"] },
        ],
    },
}
