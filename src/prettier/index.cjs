// Prettier config
module.exports = {
    singleQuote: false,
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    semi: false,
    trailingComma: "all",
    endOfLine: "lf",
    htmlWhitespaceSensitivity: "ignore",
    overrides: [
        {
            files: ["*.json", "*.json5"],
            options: {
                tabWidth: 2,
                trailingComma: "none",
            },
        },
        {
            files: ["*.yml", "*.yaml"],
            options: {
                tabWidth: 2,
            },
        },
        {
            files: "*.nvue",
            options: { parser: "vue", semi: true },
        },
    ],
}
