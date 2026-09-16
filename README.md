# my-code-style

Lint/Format/Git 配置工程化 npm 包。适用于 Vue 3 + TypeScript + uni-app 项目及纯 Node/TS 基础工程。

支持 ESLint v8 (.eslintrc.cjs) 和 ESLint v9 (Flat Config) 双格式，支持 SCSS 和 Less 样式检查。

## 快速开始

```bash
pnpm add -D my-code-style
npx my-code-style-init
```

init 脚本会自动检测项目技术栈类型（uni-app / Vue 3 / Node 基础库）、ESLint 版本和 CSS 预处理器，自动按需生成对应的配置文件。

## 生成的文件

| 文件                | 说明                                                    |
| ------------------- | ------------------------------------------------------- |
| `.eslintrc.cjs`     | ESLint 配置（v8 项目，TypeScript + Vue 3 / uni-app）    |
| `eslint.config.mjs` | ESLint Flat Config（v9 项目，默认优先推荐）             |
| `.prettierrc.cjs`   | Prettier 格式化配置                                     |
| `.prettierignore`   | Prettier 忽略文件（跳过二进制文件与产物）               |
| `.stylelintrc.cjs`  | Stylelint CSS/SCSS/Less 配置（非样式项目自动跳过）      |
| `.commitlintrc.cjs` | Git commit 信息规范（支持智能 scope 猜测）              |
| `.versionrc.js`     | 自动版本号 + CHANGELOG 生成                             |
| `.editorconfig`     | 编辑器基础配置                                          |
| `.gitattributes`    | Git 文件类型处理（统一 EOL=LF，标记二进制文件）         |
| `.gitignore`        | Git 忽略文件（自动忽略 node_modules/、dist/、*.tgz 等） |
| `.husky/commit-msg` | Git hook: commitlint（Husky 9 格式）                    |
| `.husky/pre-commit` | Git hook: lint-staged（Husky 9 格式）                   |

## 手动使用（不通过 init）

### ESLint v8 (.eslintrc.cjs)

```js
// .eslintrc.cjs
module.exports = require("my-code-style/eslint/uniapp")

// 或按需引入中间层
const base = require("my-code-style/eslint") // 基础 TypeScript
const vue3 = require("my-code-style/eslint/vue3") // + Vue 3 规则
```

### ESLint v9 (Flat Config / eslint.config.mjs)

```js
// eslint.config.mjs
import uniappConfig from "my-code-style/eslint/flat/uniapp"

// 或按需引入中间层
import baseConfig from "my-code-style/eslint/flat"
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

| 入口                                    | 说明                          |
| --------------------------------------- | ----------------------------- |
| `my-code-style`                         | 默认：ESLint v8 uni-app 配置  |
| `my-code-style/eslint`                  | 基础 ESLint v8（TypeScript）  |
| `my-code-style/eslint/vue3`             | + Vue 3 规则                  |
| `my-code-style/eslint/uniapp`           | + uni-app globals             |
| `my-code-style/eslint/flat`             | ESLint v9 Flat Config 基础    |
| `my-code-style/eslint/flat/vue3`        | + Vue 3 规则                  |
| `my-code-style/eslint/flat/uniapp`      | + uni-app globals             |
| `my-code-style/prettier`                | Prettier 配置                 |
| `my-code-style/stylelint`               | Stylelint 配置（SCSS / 默认） |
| `my-code-style/stylelint/less`          | Less 专用 Stylelint 配置      |
| `my-code-style/stylelint/less-override` | Less 专用覆写配置             |
| `my-code-style/commitlint`              | Commitlint 基础配置           |
| `my-code-style/commitlint/scopes`       | 动态 scope 工具函数           |
| `my-code-style/versionrc`               | standard-version 配置         |

## 特性

- **双引号**：`quotes: ["error", "double", { avoidEscape: false, allowTemplateLiterals: true }]`
- **4 空格缩进**：`tabWidth: 4`（由 Prettier 全权统一格式化）
- **无分号**：`semi: false`（`.nvue` 文件除外）
- **行宽 100**：`printWidth: 100`
- **多工程形态适配**：智能识别 uni-app / Vue 3 / 纯 Node-TS 基础工程，无样式的纯代码项目自动跳过 Stylelint
- **双 ESLint 格式**：ESLint v9 (Flat Config，未配置项目默认优先) 与 v8 (.eslintrc.cjs) 全自动检测
- **现代化 Git Hooks**：采用 Husky 9 原生极简 hook + lint-staged 自动过滤并修复暂存文件
- **Stylelint SCSS & Less 双支持**：放行 `@` 变量、小程序 `rpx`/`page`、深度选择器 `::v-deep` 及现代 CSS 伪类
- **动态 Scope 与智能猜测**：Commitlint 支持从项目目录自动发现 scope，并根据 git 暂存区自动填充默认 scope
- **自动版本发布**：继承 standard-version 中文 changelog 分类模板，一键版本递增与发布

## License

MIT
