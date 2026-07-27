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
            files: "*.json",
            options: { trailingComma: "none" },
        },
        {
            files: "*.nvue",
            options: { semi: true },
        },
    ],
}
