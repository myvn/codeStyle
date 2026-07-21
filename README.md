# my-code-style

Lint/Format/Git 配置工程化 npm 包。适用于 Vue 3 + TypeScript + uni-app 项目。

支持 ESLint v8 (.eslintrc.cjs) 和 ESLint v9 (Flat Config) 双格式，支持 SCSS 和 Less 样式检查。

## 快速开始

```bash
pnpm add -D my-code-style
npx my-code-style-init
```

init 脚本会自动检测项目的 ESLint 版本和 CSS 预处理器，生成对应的配置文件。

## 生成的文件

| 文件 | 说明 |
|------|------|
| `.eslintrc.cjs` | ESLint 配置（v8 项目，TypeScript + Vue 3 + uni-app） |
| `eslint.config.ts` | ESLint Flat Config（v9 项目，TypeScript + Vue 3 + uni-app） |
| `.prettierrc.cjs` | Prettier 格式化配置 |
| `.stylelintrc.cjs` | Stylelint CSS/SCSS/Less 配置 |
| `.commitlintrc.cjs` | Git commit 信息规范 |
| `.versionrc.js` | 自动版本号 + CHANGELOG 生成 |
| `.editorconfig` | 编辑器基础配置 |
| `.husky/commit-msg` | Git hook: commitlint |
| `.husky/pre-commit` | Git hook: lint-staged |

## 手动使用（不通过 init）

### ESLint v8 (.eslintrc.cjs)

```js
// .eslintrc.cjs
module.exports = require("my-code-style/eslint/uniapp")

// 或按需引入中间层
const base = require("my-code-style/eslint")        // 基础 TypeScript
const vue3 = require("my-code-style/eslint/vue3")   // + Vue 3 规则
```

### ESLint v9 (Flat Config / eslint.config.ts)

```ts
// eslint.config.ts
import uniappConfig from "my-code-style/eslint/flat/uniapp"

// 或按需引入中间层
import baseConfig from "my-code-style/eslint/flat/base"
import vue3Config from "my-code-style/eslint/flat/vue3"
```

### 其他配置

```js
// .prettierrc.cjs
module.exports = require("my-code-style/prettier")

// .stylelintrc.cjs
module.exports = require("my-code-style/stylelint")

// .commitlintrc.cjs
const base = require("my-code-style/commitlint")
const { generateScopes, guessCurrentScope } = require("my-code-style/commitlint/scopes")
module.exports = { ...base, prompt: { ...base.prompt, scopes: generateScopes("src") } }

// .versionrc.js
module.exports = require("my-code-style/versionrc")
```

## 配置覆盖

```js
// .eslintrc.cjs
const base = require("my-code-style/eslint/uniapp")
module.exports = {
    ...base,
    rules: {
        ...base.rules,
        "no-console": "warn",
    },
}
```

## 导出入口

| 入口 | 说明 |
|------|------|
| `my-code-style` | 默认：ESLint v8 uni-app 配置 |
| `my-code-style/eslint` | 基础 ESLint v8（TypeScript） |
| `my-code-style/eslint/vue3` | + Vue 3 规则 |
| `my-code-style/eslint/uniapp` | + uni-app globals |
| `my-code-style/eslint/flat` | ESLint v9 Flat Config 基础 |
| `my-code-style/eslint/flat/vue3` | + Vue 3 规则 |
| `my-code-style/eslint/flat/uniapp` | + uni-app globals |
| `my-code-style/prettier` | Prettier 配置 |
| `my-code-style/stylelint` | Stylelint 配置（SCSS + Less） |
| `my-code-style/stylelint/less-override` | Less 专用覆写配置 |
| `my-code-style/commitlint` | Commitlint 基础配置 |
| `my-code-style/commitlint/scopes` | 动态 scope 工具函数 |
| `my-code-style/versionrc` | standard-version 配置 |

## 特性

- **双引号**：`quotes: ["error", "double", { avoidEscape: false, allowTemplateLiterals: true }]`
- **4 空格缩进**：`tabWidth: 4`
- **无分号**：`semi: false`（`.nvue` 文件除外）
- **行宽 100**：`printWidth: 100`
- **小程序适配**：允许 `rpx` 单位、`page` 标签、`::v-deep` 伪类
- **uni-app globals**：`uni`、`UniApp`、`wx`、`getCurrentPages` 等
- **Less 支持**：`postcss-less` 解析、`@` 变量放行、`::v-deep` 伪元素
- **双 ESLint 格式**：v8 (.eslintrc.cjs) 和 v9 (Flat Config) 自动检测

## License

MIT
