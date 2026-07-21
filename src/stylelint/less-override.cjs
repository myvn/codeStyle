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
        // Allow ::v-deep / /deep/ / ::ng-deep pseudo-elements
        "selector-pseudo-element-no-unknown": [
            true,
            { ignorePseudoElements: ["v-deep", "deep", "ng-deep"] },
        ],
    },
}
