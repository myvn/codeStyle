# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2026-07-29

### Fixes

- **bin 文件名去扩展名**：`bin/init.cjs` → `bin/init`，修复 npm publish 警告
- **gitattributes 增强**：补充 `.ps1` 和 `.cmd/.bat` 的 CRLF 支持
- **@antfu/eslint-config 兼容说明**：文档化 `style/` 规则关闭原因

## [1.0.1] - 2026-07-28

### Fixes

- **关闭 standard style/quotes 冲突**：`@stylistic` 插件带来 `style/quotes` 与 base `quotes` 规则冲突，统一关闭 `style/quotes` 和 `style/semi`

## [1.0.0] - 2026-07-28

### Features

- **Less 专用 stylelint 配置**：新增 `src/stylelint/less.cjs`，不依赖 SCSS 包，init 脚本自动根据检测到的 CSS 预处理器选择对应配置
- **Flat Config 支持**：`src/eslint/flat/` 下提供 ESLint 9+ 配置（`base.mjs`、`vue3.mjs`、`uniapp.mjs`），init 脚本自动根据 ESLint 版本选择 eslintrc 或 flat 格式

### Fixes

- **关闭 standard style/quotes 冲突**：`@stylistic` 插件带来 `style/quotes` 与 base `quotes` 规则冲突，统一关闭 `style/quotes` 和 `style/semi`
- **清理 init 脚本污染**：`.prettierrc.cjs` 改为相对路径引用本地源码，移除 `package.json` 自依赖、lint-staged、prepare 脚本
- **项目自身 ESLint 配置**：添加 `eslint.config.mjs`（ESLint 10 需要 Flat Config）
- **导出路径**：`package.json` 添加 `./stylelint/less` 导出