# Changelog

All notable changes to this project will be documented in this file.

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