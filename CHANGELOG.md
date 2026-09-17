# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## Unreleased

### Bug Fixes

- **eslint8:** 支持范围明确为 ^8.57.0 || ^9.0.0；修正 Vue 插件 10 的传统预设名，补齐 CommonJS require 与 nvue 模块脚本/分号覆写。
- **init:** 传统 lint 脚本显式指定 JS/TS 及对应组件扩展名，避免目录扫描漏检；依赖提示按配置格式推荐 ESLint 主版本。

- **lint-staged:** 改为互斥文件组内串行执行，补齐 nvue，移除提交任务共享 ESLint 缓存；Stylelint 显式解析 nvue 内嵌样式。

- **init:** 写入前校验参数和 package.json，保护已有 ESLint 配置并拦截版本/格式冲突；补全 Less 的 stylelint-config-html 依赖提示。
- **deps:** Vue parser 更新到 ^10.3.0，postcss-html / stylelint-config-html 更新到 ^2.0.0，修复当前预设依赖冲突。
- **commitlint:** 移除包含 init 即跳过校验的宽泛过滤；初始化提交也应遵循 Conventional Commits。
- **commitlint:** 重构 `guessCurrentScope`，严格只从 Git 暂存区（staged）提取修改，未暂存与未跟踪文件不影响判定；多目录采用频次投票策略确定主 scope，并覆盖重命名、删除（含目录全删）、多源码目录、中文及空格路径。
- **stylelint:** 默认配置兼容混合 Less 语法，放行与 Less 冲突的 `scss/operator-*` 及 `scss/no-global-function-names`，实现对 SCSS、Less 及 Vue 内嵌双样式的统一检查与修复。
- **init:** 识别同时使用 Sass 与 Less 的混合项目（both），lint-staged 生成 `**/*.{html,css,scss,less}` 统一串行任务组，并在缺失依赖时同时提示安装 `postcss-scss` 与 `postcss-less`。
- **eslint:** Flat Vue 配置完整匹配根目录及嵌套 .nvue，支持模块脚本和 TypeScript parser。
- **prettier:** .nvue 显式使用 Vue parser 并保留分号约定。

### Tests

- 增加 CLI、配置契约、暂存区 scope 判定、混合预处理器及隔离工具链测试，共 101 项通过；不代表全量或跨平台覆盖。

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
