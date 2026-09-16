// Commitlint config — powered by my-code-style
const base = require("my-code-style/commitlint")
const { generateScopes, guessCurrentScope } = require("my-code-style/commitlint/scopes")

const scopes = generateScopes("src")
const scopeComplete = guessCurrentScope()

module.exports = {
    ...base,
    prompt: {
        ...base.prompt,
        customScopesAlign: !scopeComplete ? "top" : "bottom",
        defaultScope: scopeComplete,
        scopes: [...scopes, "mock"],
        allowEmptyIssuePrefixs: false,
        allowCustomIssuePrefixs: false,
    },
}
