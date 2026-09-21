// ESLint Flat Config — powered by my-code-style
// https://www.npmjs.com/package/my-code-style
import baseConfig from "my-code-style/eslint/flat"

// demo-test/.runtime* holds isolated installs for the integration suites
export default [
    ...baseConfig,
    { ignores: ["demo-test/.runtime/**", "demo-test/.runtime-legacy/**"] },
    {
        // 本仓测试文件自引用包名（import "my-code-style/*"），经 symlink 解析后
        // import-x/extensions 的 ignorePackages 识别不了、逐条误报 missing extension；
        // 消费者项目没有这种自引用形态，包内配置保持与 legacy 对齐的 error（NIT-012）。
        files: ["**/*.{cjs,mjs,js}"],
        rules: { "import-x/extensions": "off" },
    },
]
