// Stylelint 16+ 才引入 at-rule-prelude-no-invalid；存量项目若仍用
// Stylelint 15，静态写入该规则会报 Unknown rule 阻断提交（1.9.5 落地反馈）。
// 动态探测宿主是否已注册该规则，未注册时不注入，保持两版本开箱即用。
const supportsAtRulePrelude = (() => {
    try {
        const sl = require("stylelint")
        return Boolean(sl.rules && "at-rule-prelude-no-invalid" in sl.rules)
    } catch {
        // 未安装 stylelint 时交由运行时校验；为与 1.9.5 语义一致默认视为支持
        return true
    }
})()

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
        // Stylelint 15 尚无该规则，静态写入会报 Unknown rule 阻断提交，故动态注入。
        ...(supportsAtRulePrelude ? { "at-rule-prelude-no-invalid": null } : {}),
        // Allow ::v-deep / /deep/ / ::ng-deep pseudo-elements
        "selector-pseudo-element-no-unknown": [
            true,
            { ignorePseudoElements: ["v-deep", "deep", "ng-deep"] },
        ],
    },
}
