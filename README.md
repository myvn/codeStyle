# my-code-style

Lint/Format/Git 配置工程化 npm 包。适用于 Vue 3 + TypeScript + uni-app 项目及纯 Node/TS 基础工程。

支持 ESLint v8 (.eslintrc.cjs) 和 ESLint v9 (Flat Config) 双格式，支持 SCSS 和 Less 样式检查。

## 项目文档

- [HTML 项目技术全景](docs/project-overview.html)：下载或克隆仓库后，用浏览器直接打开，查看项目结构、配置架构、接入流程与维护注意事项；支持离线阅读和打印。
- [Markdown 技术文档](TECHNICAL_DOC.md)
- [使用说明书](docs/manual.md)：使用后的优点、带来的福利与解决的问题、完整使用步骤与常见问题 FAQ
- [初始化链路说明](docs/init-flow.md)：`pnpm add -D my-code-style` + `npx my-code-style-init` 逐步做了什么、生成哪些文件、常见坑

## 怎么使用

前置条件：Node ≥ 18、项目有合法 `package.json`、**已 `git init`**（husky 需要 git 仓库）。

```bash
# 1. 安装配置包
pnpm add -D my-code-style            # npm: npm i -D my-code-style

# 2. 先预览，再初始化（init 会覆盖已存在的 .prettierrc.cjs / hooks 等）
npx my-code-style-init --dry-run
npx my-code-style-init                # 需保留旧文件时加 --backup

# 3. 按 CLI 输出的缺失依赖清单安装 peerDependencies（会按包管理器生成命令，别漏 typescript）
pnpm add -D my-code-style eslint@^9.0.0 typescript@^5.0.0 prettier@^3.0.0 ...   # 以 CLI 实际输出为准

# 4. 初始化 hooks 并首次检查
pnpm prepare                          # npm: npm run prepare
pnpm lint
```

init 脚本会自动检测技术栈类型（uni-app / Vue 3 / Node 基础库）、ESLint 版本、CSS 预处理器和包管理器，按需生成配置文件，并在结尾列出尚未安装的 peerDependencies 与对应安装命令。

初始化后：`lint-staged` 会在 `git commit` 时自动修复暂存文件，`commitlint` 校验提交信息，`pnpm release` 生成版本与 CHANGELOG。全过程细节见 [docs/init-flow.md](docs/init-flow.md)，收益与代价评估见 [docs/manual.md](docs/manual.md)。

### 使用后的变化（速览）

| 维度       | 使用前                       | 使用后                                            |
| ---------- | ---------------------------- | ------------------------------------------------- |
| 代码格式   | 各自编辑器配置               | 全仓库统一（4 空格 / 无分号 / 双引号 / 行宽 100） |
| 提交       | 靠自觉，问题留到评审         | pre-commit 自动修复，修不好的挡下提交             |
| 提交信息   | 自由文本                     | conventional commits 强校验 + `pnpm cz` 引导      |
| 版本与日志 | 手工改版本、手工写 CHANGELOG | `pnpm release` 自动递增并生成 CHANGELOG           |
| 样式代码   | 基本无人检查                 | stylelint 覆盖 SCSS/Less/Vue 内嵌样式             |
| 规则同步   | 每个项目各抄一份             | 升级一个依赖版本，全项目生效                      |

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

## 常见问题（使用中遇到的问题）

| 现象                                                                 | 原因                                                       | 处理                                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 只装了 `my-code-style`，`pnpm lint` 报找不到 eslint                  | peerDependencies 全部是 optional，不会自动安装             | 按 CLI 结尾输出的清单装全，**别漏 `typescript`**（`@typescript-eslint/parser` / `typescript-eslint` 的必需 peer） |
| `pnpm prepare` 输出 `.git can't be found`，hooks 不生效              | husky 必须在 git 仓库内执行                                | 先 `git init`、再 `pnpm prepare`；验证 `git config core.hooksPath` 输出 `.husky/_`                                |
| 安装依赖报 `ERR_PNPM_IGNORED_BUILDS`（如 `unrs-resolver`）           | pnpm 10+ 默认拦截依赖的构建脚本                            | 执行 `pnpm approve-builds` 后重新安装，不是初始化失败                                                             |
| `eslint` 声明 `>=8.0.0` 却生成了 Flat Config                         | 无上界范围 npm 实际会装 9，CLI 按 9 生成                   | 确定留在 8 就把范围收紧到 `<9`（如 `~8.57.0`）后重跑 init                                                         |
| 重复 init 后，改过的 `.prettierrc.cjs` / hooks 被覆盖                | 除 ESLint 入口与已存在的 `.gitignore` 外，目标文件一律覆盖 | 先用 `--dry-run` 看清单、用 `--backup` 留档（备份含 `package.json`，目录会自动写入 `.gitignore`）                 |
| 自定义 `lint-staged` 分组消失                                        | `lint-staged` 为整体替换，避免残留失效分组                 | 从 `.my-code-style-backup/package.json` 恢复后手动合并                                                            |
| 提交时 lint 报错、提交失败                                           | 修不了的错误（语法错误、非法 CSS 属性）会阻止提交          | 按提示修复；紧急情况可用 `git commit --no-verify`，但请在 **CI 用 `pnpm lint` 兜底**                              |
| 提交信息被拒（`type may not be empty` / `subject may not be empty`） | 提交信息需符合 conventional commits                        | 用 `pnpm cz` 交互式生成；header 上限 108 字符                                                                     |
| 老项目已有 `.eslintrc.*`，init 只读退出                              | ESLint 版本与配置格式冲突时 CLI 拒绝写入                   | 先确认/迁移版本，再重跑 init                                                                                      |
| `pnpm release` 之后如何发布                                          | `release` 只生成版本、CHANGELOG、提交与 tag                | 另行执行 `npm publish`                                                                                            |

完整 FAQ（含更多场景与解释）见 [docs/manual.md](docs/manual.md#五使用中遇到的问题faq)。

## 测试套件

```bash
npm test                       # 运行基础 CLI 与配置矩阵测试（59 项）
npm run test:integration:setup # 安装现代化隔离依赖运行环境
npm run test:integration       # 运行 Flat Config、真实 Husky 及提交链路测试（47 项）
npm run test:legacy:setup      # 安装 ESLint 8 隔离运行环境
npm run test:legacy            # 运行 ESLint 8.57.0 兼容性回归测试（27 项）
npm run test:all               # 全量运行全部 133 项测试
```

## License

MIT
