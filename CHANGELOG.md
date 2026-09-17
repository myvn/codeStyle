## 变更日志

## [1.4.0](https://github.com/myvn/codeStyle/compare/v1.2.0...v1.4.0) (2026-09-17)

### 🐛 Bug Fixes | Bug 修复

- **commitlint:** guessCurrentScope 仅基于暂存区推断并补充频次投票与全场景回归 ([3f5f8ea](https://github.com/myvn/codeStyle/commit/3f5f8ea1a4526621006025ce2d86608dd53e9b2d))
- harden initialization and lint workflows with integration tests ([7079998](https://github.com/myvn/codeStyle/commit/707999895ac4d80d311537bd833584694c7a8510))
- **stylelint:** 支持混合 SCSS 与 Less 工程并在组件内嵌/独立样式中全量检查与修复 ([e5a1b7e](https://github.com/myvn/codeStyle/commit/e5a1b7e4992f40cf6b4f97fa75e3c755b57fb257))

### ✨ Features | 新功能

- **core:** upgrade cli init, relax stylelint/eslint rules and bump v1.3.1 ([285c49b](https://github.com/myvn/codeStyle/commit/285c49b1f07707f7f998308d37f718e8d0af0d19))
- **init:** 支持 ESM versionrc、JSX/TSX 检查、版本识别强化与初始化事务回滚 ([89e8eb6](https://github.com/myvn/codeStyle/commit/89e8eb6677db00802636201148119d1fe208abe3))

## 1.3.1 (2026-09-16)

### Bug Fixes

- **stylelint:** 放行 SCSS `@extend` 类继承语法（`scss/at-extend-no-missing-placeholder: null`），放行空样式块（`block-no-empty: null`）
- **stylelint:** 内置 `ignoreFiles`，自动忽略 `**/assets/iconfont/**`、`**/public/**` 及压缩文件
- **eslint:** 允许 `// @ts-ignore` 注释（`@typescript-eslint/ban-ts-comment: off`）及 `{}` 类型（`@typescript-eslint/no-empty-object-type: off`）
- **eslint:** 放行无用表达式报错（`no-unused-expressions: off`），Flat Config 默认忽略 `**/assets/iconfont/**` 与 `**/public/**`，避免历史或第三方资源阻断提交

## 1.3.0 (2026-09-16)

### Features

- **init:** 智能识别工程类型（uni-app / Vue 3 / Node TS 基础库），按需分层生成配置
- **init:** ESLint 检测支持 peerDependencies，未配置项目默认优先采用现代 Flat Config (ESLint 9+)
- **init:** 无样式依赖的纯代码项目自动跳过 Stylelint 配置与任务挂载
- **init:** 内置 `.gitignore` 模板，项目缺失时自动生成，杜绝误暂存 `node_modules`
- **init:** 补齐 Stylelint 配套全量预设包及 `@commitlint/config-conventional` 到一键安装提示
- **init:** `lint-staged` 写入改为整块规范化覆盖，彻底消除规则重复执行
- **core:** 工具项目自身全面规范化，接入 ESLint 9 Flat Config 与 Husky 9 提交拦截

### Bug Fixes

- **eslint:** 修复 `eslintConfigPrettier` 顺序问题，置于配置末尾消除引号冲突
- **eslint:** 放行 CommonJS 配置文件（`*.config.js`、`.*rc.js`、`*.cjs`）中的 `require()` 语法
- **eslint:** 关闭 `indent` 与 `vue/html-indent`，缩进格式全权交由 Prettier 处理
- **eslint:** 关闭 `import-x/extensions` 强制扩展名规则，补齐 `**/*.vue` 文件匹配
- **stylelint:** 补齐宽松规则，放行现代伪类语法、选择器嵌套及层叠特异性限制
- **husky:** 移除已废弃的 `husky.sh` 引用，升级全面兼容 Husky 9
- **commitlint:** 重构 `guessCurrentScope`，提升跨平台路径及多文件暂存匹配精准度
- **pkg:** 全部 31 项 `peerDependencies` 补充 `peerDependenciesMeta` 为 `optional`

## 1.2.0 (2026-08-28)

### Features

- 一键安装命令带上版本号 a58ddf7
- 一键安装提示，输出包含 my-code-style 的完整安装命令 3916ddd
- 安装命令分行展示，避免终端截断 3d4ab9c
- 添加 --version / -v 查看版本命令 14d6605
- 添加 Less 专用 stylelint 配置，init 脚本自动选择 be34547

### Bug Fixes

- **eslint:** 修复 ESLint v8/v9 规则覆盖、解析器配置及脚手架生成逻辑 5b4e357
- peerDependencies 改用 ^ 范围，限制次版本号 b8deccd
- 修复 init 输出步骤号跳跃（1→3→4） 5248766
- 修复项目自身 ESLint 配置，添加 eslint.config.mjs 83f79a7
- 关闭 standard 带来的 style/quotes 冲突 0a21a6b
- 清理项目自身 init 脚本污染 c1b3b59

## [1.1.0] - 2026-07-29

### Breaking

- ESLint >= 9.0.0、@typescript-eslint >= 8.0.0
- eslint-config-prettier >= 10.1.8（修复 CVE-2025-54313）
- eslint-plugin-vue >= 10.0.0、husky >= 9.0.0、commitlint >= 19.0.0
- stylelint-config-recommended >= 16.0.0、lint-staged >= 16.0.0

### Fixes

- `eslint-config-standard` 移入 peerDependenciesMeta optional（仅支持 ESLint 8）

## [1.0.2] - 2026-07-29

### Fixes

- bin 文件名去 `.cjs` 扩展名（修复 npm 警告）
- gitattributes 补充 `.ps1` 和 `.cmd/.bat` CRLF 支持
- `style/quotes` 和 `style/semi` 关闭（与 @stylistic 兼容）

## [1.0.1] - 2026-07-28

### Fixes

- 清理 init 脚本污染，.prettierrc.cjs 改为相对路径

## [1.0.0] - 2026-07-28

### Features

- Less 专用 stylelint 配置（`src/stylelint/less.cjs`）
- Flat Config 支持（ESLint 9+）
