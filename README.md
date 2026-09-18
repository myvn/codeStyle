# my-code-style

Lint/Format/Git 配置工程化 npm 包。适用于 Vue 3 + TypeScript + uni-app 项目及纯 Node/TS 基础工程。

支持 ESLint v8 (.eslintrc.cjs) 和 ESLint v9 (Flat Config) 双格式，支持 SCSS 和 Less 样式检查。

## 项目文档

- [HTML 项目技术全景](docs/project-overview.html)：下载或克隆仓库后，用浏览器直接打开，查看项目结构、配置架构、接入流程与维护注意事项；支持离线阅读和打印。
- [Markdown 技术文档](TECHNICAL_DOC.md)

## 快速开始

```bash
pnpm add -D my-code-style
npx my-code-style-init
```

init 脚本会自动检测项目技术栈类型（uni-app / Vue 3 / Node 基础库）、ESLint 版本和 CSS 预处理器，自动按需生成对应的配置文件。

## 生成的文件

| 文件                               | 说明                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `.eslintrc.cjs`                    | ESLint 配置（v8 项目，TypeScript + Vue 3 / uni-app）                          |
| `eslint.config.mjs`                | ESLint Flat Config（v9 项目，默认优先推荐）                                   |
| `.prettierrc.cjs`                  | Prettier 格式化配置                                                           |
| `.prettierignore`                  | Prettier 忽略文件（跳过二进制文件与产物）                                     |
| `.stylelintrc.cjs`                 | Stylelint CSS/SCSS/Less 配置（非样式项目自动跳过）                            |
| `.commitlintrc.cjs`                | Git commit 信息规范（支持智能 scope 猜测）                                    |
| `.versionrc.js` / `.versionrc.cjs` | 自动版本号 + CHANGELOG（ESM 生成 `.versionrc.cjs`，CJS 生成 `.versionrc.js`） |
| `.editorconfig`                    | 编辑器基础配置                                                                |
| `.gitattributes`                   | Git 文件类型处理（统一 EOL=LF，标记二进制文件）                               |
| `.gitignore`                       | Git 忽略文件（自动忽略 node_modules/、dist/、*.tgz 等）                       |
| `.husky/commit-msg`                | Git hook: commitlint（Husky 9 格式）                                          |
| `.husky/pre-commit`                | Git hook: lint-staged（Husky 9 格式）                                         |

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
const scopeComplete = guessCurrentScope()
module.exports = {
    ...base,
    prompt: {
        ...base.prompt,
        customScopesAlign: !scopeComplete ? "top" : "bottom",
        defaultScope: scopeComplete,
        scopes: [...generateScopes("src"), "mock"],
    },
}

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

## CLI 初始化参数

```bash
npx my-code-style-init [--dry-run] [--backup] [--version|-v] [--help|-h]
```

- `--dry-run`：试运行模式，仅输出将执行的变更，不修改任何文件。
- `--backup`：在覆盖已有配置文件之前，将其备份到 `.my-code-style-backup/` 目录。
- 具备**事务回滚保护**：若在写入过程中遭遇文件权限或磁盘异常，自动回滚所有修改，恢复工作区原始状态。

## 特性

- **双引号**：`quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }]`（`avoidEscape` 必须为 `true`，否则与 Prettier 的转义策略冲突，`--fix` 无法消除报错）
- **4 空格缩进**：`tabWidth: 4`（由 Prettier 全权统一格式化）
- **无分号**：`semi: false`（`.nvue` 文件除外）
- **行宽 100**：`printWidth: 100`
- **JSX / TSX 全面支持**：Flat Config 与传统配置均支持 `.jsx` 和 `.tsx` 语法解析、Prettier 格式化、规则修复与目录扫描
- **多工程形态适配**：智能识别 uni-app / Vue 3 / 纯 Node-TS 基础工程，无样式的纯代码项目自动跳过 Stylelint
- **双 ESLint 格式**：ESLint v9 (Flat Config，未配置项目默认优先) 与 v8 (.eslintrc.cjs) 全自动检测，强化支持 npm 别名、workspace 协议与复杂 semver 范围
- **现代化 Git Hooks**：采用 Husky 9 原生极简 hook + lint-staged 互斥文件分组，串行运行、消除并发写入缓存冲突
- **Stylelint SCSS、Less 及混合工程双支持**：支持纯 SCSS、纯 Less 以及两者共存的混合工程，放行 `@` 变量、小程序 `rpx`/`page`、深度选择器 `::v-deep` 及现代 CSS 伪类，组件内嵌多预处理器样式全面检查
- **严格暂存区 Scope 猜测**：`guessCurrentScope()` 严格只依据 Git 暂存区推断 scope，支持多目录频次投票、重命名、物理删除、中文路径与空格路径
- **ESM 兼容的自动版本发布**：支持 CommonJS（`.versionrc.js`）与 ESM（`.versionrc.cjs`）工程无缝对接 standard-version，一键版本递增与 CHANGELOG 生成

## 测试套件

```bash
npm test                       # 运行基础 CLI 与配置矩阵测试（52 项）
npm run test:integration:setup # 安装现代化隔离依赖运行环境
npm run test:integration       # 运行 Flat Config、真实 Husky 及提交链路测试（47 项）
npm run test:legacy:setup      # 安装 ESLint 8 隔离运行环境
npm run test:legacy            # 运行 ESLint 8.57.0 兼容性回归测试（27 项）
npm run test:all               # 全量运行全部 132 项测试
```

## License

MIT
