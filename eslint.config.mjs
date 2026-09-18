// ESLint Flat Config — powered by my-code-style
// https://www.npmjs.com/package/my-code-style
import baseConfig from "my-code-style/eslint/flat"

// demo-test/.runtime* holds isolated installs for the integration suites
export default [
    ...baseConfig,
    { ignores: ["demo-test/.runtime/**", "demo-test/.runtime-legacy/**"] },
]
