import baseConfig from "./src/eslint/flat/base.mjs"

export default [
    ...baseConfig,
    {
        ignores: ["node_modules/**", "dist/**", "*.tgz"],
    },
]