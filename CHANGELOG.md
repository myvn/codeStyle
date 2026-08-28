# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.2.0 (2026-08-28)


### Features

* 一键安装命令带上版本号 a58ddf7
* 一键安装提示，输出包含 my-code-style 的完整安装命令 3916ddd
* 安装命令分行展示，避免终端截断 3d4ab9c
* 添加 --version / -v 查看版本命令 14d6605
* 添加 Less 专用 stylelint 配置，init 脚本自动选择 be34547


### Bug Fixes

* **eslint:** 修复 ESLint v8/v9 规则覆盖、解析器配置及脚手架生成逻辑 5b4e357
* peerDependencies 改用 ^ 范围，限制次版本号 b8deccd
* 修复 init 输出步骤号跳跃（1→3→4） 5248766
* 修复项目自身 ESLint 配置，添加 eslint.config.mjs 83f79a7
* 关闭 standard 带来的 style/quotes 冲突 0a21a6b
* 清理项目自身 init 脚本污染 c1b3b59

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