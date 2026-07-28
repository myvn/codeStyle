// Shared constants and rule objects for Flat Config files

/**
 * Prettier plugin rules — mirrors base.cjs prettier/prettier config
 */
export const prettierRules = {
    "prettier/prettier": ["error", { singleQuote: false, tabWidth: 4 }],
}

/**
 * Common rules shared across all flat config levels — mirrors base.cjs rules
 */
export const commonRules = {
    // Import rules (using import-x for flat config compatibility)
    "import-x/no-unresolved": "off",
    "import-x/extensions": [
        "error",
        "ignorePackages",
        { js: "never", jsx: "never", ts: "never", tsx: "never" },
    ],
    "import-x/prefer-default-export": "off",
    "import-x/no-extraneous-dependencies": "off",
    // TypeScript
    "@typescript-eslint/no-redeclare": "error",
    // Commonly disabled
    "no-console": "off",
    "no-plusplus": "off",
    "no-shadow": "off",
    "no-underscore-dangle": "off",
    "no-use-before-define": "off",
    "no-undef": "off",
    "no-unused-vars": "off",
    "no-param-reassign": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-redeclare": "off",
    "prefer-promise-reject-errors": "off",
    // Quotes
    quotes: ["error", "double", { avoidEscape: false, allowTemplateLiterals: true }],
    // Standard JS uses @stylistic style/quotes — disable to avoid conflict
    "style/quotes": "off",
    "style/semi": "off",
}

/**
 * Uni-app global variables — mirrors uniapp.cjs globals
 */
export const uniappGlobals = {
    $t: true,
    uni: true,
    UniApp: true,
    wx: true,
    WechatMiniprogram: true,
    getCurrentPages: true,
    UniHelper: true,
    Page: true,
    App: true,
    NodeJS: true,
}
