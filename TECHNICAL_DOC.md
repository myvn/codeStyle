# my-code-style 技术文档

## 一、方案概述

将前端项目的 **代码规范、格式化、Git 提交规范** 统一封装为一个 npm 包，通过 `require()` / `import` 配置继承 + CLI 脚手架初始化的方式，实现多项目配置复用。

**适用技术栈**：Vue 3 + TypeScript + uni-app（小程序）
**ESLint 版本**：v8 (.eslintrc.cjs) 和 v9 (Flat Config) 双格式支持
**样式预处理器**：SCSS 和 Less 双支持

---

## 二、实现原理

### 2.1 npm 包多入口导出

通过 `package.json` 的 `exports` 字段提供子路径导出：

#### ESLint v8 (.eslintrc.cjs 格式)

| 导出路径 | 实际文件 | 说明 |
|---------|---------|------|
| `my-code-style` | `src/eslint/uniapp.cjs` | 默认导出（uni-app 完整 ESLint 配置） |
| `my-code-style/eslint` | `src/eslint/base.cjs` | 基础 TypeScript ESLint 配置 |
| `my-code-style/eslint/vue3` | `src/eslint/vue3.cjs` | + Vue 3 规则 |
| `my-code-style/eslint/uniapp` | `src/eslint/uniapp.cjs` | + uni-app globals |

#### ESLint v9 (Flat Config 格式)

| 导出路径 | 实际文件 | 说明 |
|---------|---------|------|
| `my-code-style/eslint/flat` | `src/eslint/flat/base.mjs` | Flat Config 基础层（TS） |
| `my-code-style/eslint/flat/vue3` | `src/eslint/flat/vue3.mjs` | + Vue 3 规则 |
| `my-code-style/eslint/flat/uniapp` | `src/eslint/flat/uniapp.mjs` | + uni-app globals |

#### 其他配置

| 导出路径 | 实际文件 | 说明 |
|---------|---------|------|
| `my-code-style/prettier` | `src/prettier/index.cjs` | Prettier 格式化配置 |
| `my-code-style/stylelint` | `src/stylelint/index.cjs` | Stylelint CSS/SCSS/Less 配置 |
| `my-code-style/stylelint/less-override` | `src/stylelint/less-override.cjs` | Less 专用覆写配置 |
| `my-code-style/commitlint` | `src/commitlint/base.cjs` | Commitlint 提交规范 |
| `my-code-style/commitlint/scopes` | `src/commitlint/scopes.cjs` | 动态 scope 工具函数 |
| `my-code-style/versionrc` | `src/versionrc/index.cjs` | standard-version 版本号配置 |

### 2.2 配置链式继承

#### v8 格式（.cjs 文件）

ESLint 配置采用三层继承链，逐层 spread 覆盖：

```
base.cjs (TS 基础规则)
  └── vue3.cjs (继承 base，添加 plugin:vue/vue3-essential)
        └── uniapp.cjs (继承 vue3，添加 uni-app globals)
```

#### v9 格式（.mjs Flat Config 文件）

Flat Config 采用数组展开方式：

```
base.mjs (tseslint + import-x + prettier)
  └── vue3.mjs (...base + pluginVue.configs["flat/essential"])
        └── uniapp.mjs (...vue3 + uniappGlobals)
```

### 2.3 CLI 脚手架 (`bin/init.cjs`)

通过 `package.json` 的 `bin` 字段注册 `my-code-style-init` 命令，内置自动检测能力：

1. **检测 ESLint 版本** — 从项目 `package.json` 读取 eslint 版本号，决定生成 `.eslintrc.cjs`（v8）还是 `eslint.config.ts`（v9）
2. **检测 CSS 预处理器** — 检查 sass/less 依赖，决定 Stylelint 的 syntax 和 lint-staged 的文件匹配
3. **检测 uni-app 项目** — 检查 `@dcloudio/uni-app` 依赖，决定使用 uniapp 还是 vue3 配置
4. **生成配置文件** — 根据检测结果生成对应格式的配置文件
5. **注入 Git hooks** — 创建 `.husky/commit-msg` 和 `.husky/pre-commit`
6. **修改 package.json** — 注入 scripts + lint-staged
7. **peerDependencies 检查** — 提示缺失依赖
8. 支持 `--dry-run` 预览模式

### 2.3.1 生成文件说明

| 文件 | 作用 |
|------|------|
| `.prettierignore` | 排除二进制文件（图片、字体、APK 等），防止 Prettier 尝试格式化它们 |
| `.gitattributes` | 统一文本文件 EOL 为 LF，标记二进制文件不做 EOL 转换和 diff |

### 2.4 动态 Scope 生成

`commitlint/scopes.cjs` 通过以下方式实现智能 scope：

- **generateScopes**：`fs.readdirSync` 读取 `src/` 下一级目录名，去掉末尾 `s` 作为 scope 列表
- **guessCurrentScope**：执行 `git status --porcelain`，分析当前修改文件所在的 `src/` 子目录，自动填充默认 scope

---

## 三、技术栈与工具

### 3.1 核心工具链

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| ESLint | >= 9.0 | JS/TS 代码规范检查 |
| @typescript-eslint/parser | >= 8.0 | TypeScript AST 解析 |
| @typescript-eslint/eslint-plugin | >= 8.0 | TypeScript 规则集 |
| typescript-eslint | >= 8.0 | Flat Config 专用，提供 `tseslint.configs.recommended` |
| @eslint/js | >= 9.0 | Flat Config 专用，提供 `js.configs.recommended` |
| eslint-plugin-vue | >= 10.0 | Vue SFC 模板检查 |
| eslint-plugin-prettier | >= 5.2 | ESLint 内运行 Prettier |
| eslint-config-prettier | >= 10.1.8 | 关闭与 Prettier 冲突的规则（修复 CVE-2025-54313） |
| eslint-plugin-import | >= 2.0 | 模块导入路径检查（v8 格式） |
| eslint-plugin-import-x | >= 4.0 | 模块导入路径检查（Flat Config 专用 fork） |
| eslint-import-resolver-typescript | >= 3.0 | TS path alias 解析 |
| globals | >= 16.0 | Flat Config 环境声明（`globals.browser` 等） |
| Prettier | >= 3.0 | 代码格式化 |
| Stylelint | >= 16.0 | CSS/SCSS/Less 规范检查 |
| stylelint-config-recommended | >= 16.0 | 基础推荐规则 |
| stylelint-config-recommended-scss | >= 16.0 | SCSS 推荐规则 |
| stylelint-config-recommended-vue | >= 2.0 | Vue SFC `<style>` 检查 |
| stylelint-config-html | >= 1.0 | HTML/Vue 模板解析 |
| stylelint-config-recess-order | >= 5.0 | CSS 属性排序 |
| stylelint-prettier | >= 5.0 | Stylelint 内运行 Prettier |
| postcss-html | >= 1.0 | 解析 Vue `<style>` 块 |
| postcss-scss | >= 4.0 | 解析 SCSS 语法 |
| postcss-less | >= 6.0 | 解析 Less 语法 |
| Commitlint | >= 19.0 | Git commit message 校验 |
| Husky | >= 9.0 | Git hooks 管理 |
| lint-staged | >= 16.0 | 暂存文件过滤检查 |
| czg | >= 1.0 | 交互式 commit 提示 |
| standard-version | >= 9.0 | 自动版本号 + CHANGELOG |

### 3.2 Flat Config 关键替换

| v8 (.eslintrc.cjs) | v9 (Flat Config) |
|--------------------|------------------|
| `extends: ["eslint:recommended"]` | `js.configs.recommended` |
| `extends: ["plugin:@typescript-eslint/recommended"]` | `...tseslint.configs.recommended` |
| `extends: ["plugin:vue/vue3-essential"]` | `...pluginVue.configs["flat/essential"]` |
| `extends: ["plugin:prettier/recommended"]` | `eslintPluginPrettierRecommended` |
| `extends: ["prettier"]` | `eslintConfigPrettier`（放最后） |
| `extends: ["standard"]` | 不适用（flat 版尚未发布） |
| `plugins: ["import"]` | `import from "eslint-plugin-import-x"` |
| `env: { browser: true }` | `globals.browser`（`import from "globals"`） |
| `parserOptions` | `languageOptions.parserOptions` |
| `overrides` | 独立配置对象 + `files` 数组 |

### 3.3 编码规范

| 规则 | 配置 |
|------|------|
| 引号 | 双引号（允许模板字符串和转义） |
| 缩进 | 4 空格 |
| 分号 | 关闭（`.nvue` 文件除外） |
| 行宽 | 100 |
| 尾逗号 | 全部（JSON 除外） |
| 换行符 | LF |
| 末尾空行 | 是 |
| 尾部空白 | 自动裁剪（Markdown 除外） |

---

## 四、使用场景

### 场景 1：新项目初始化

```bash
pnpm add -D my-code-style
npx my-code-style-init
```

一条命令完成全套配置注入，自动检测 ESLint 版本和 CSS 预处理器。

### 场景 2：日常开发 — 代码检查与格式化

- **ESLint**：`eslint --cache --fix` 检查 `.ts/.vue/.js` 文件
- **Prettier**：`prettier --write` 格式化 `.html/.vue/.ts/.cjs/.json/.md`
- **规则特征**：双引号、4 空格、无分号（.nvue 除外）、行宽 100、尾逗号

### 场景 3：样式检查 — Stylelint

- 检查 `.vue/.css/.scss/.less/.html` 中的样式代码
- **小程序适配**：放行 `rpx` 单位、`page` 标签、`::v-deep` 伪类
- **Less 适配**：放行 `@` 变量、内置函数（darken/lighten/fade）、`::v-deep` 伪元素
- CSS 属性按 `recess-order` 自动排序
- 允许 `global`、`export` 等伪类

### 场景 4：Git 提交规范

| Hook | 触发时机 | 执行内容 |
|------|---------|---------|
| `pre-commit` | `git commit` 前 | `lint-staged` 仅检查暂存文件 |
| `commit-msg` | 提交信息写入前 | `commitlint` 校验 commit message 格式 |

**提交流程**：

```bash
# 使用 czg 交互式提交
pnpm cz

# 或手动提交（需符合 Conventional Commits）
git commit -m "feat(user): add login page"
```

支持的 type：`feat`、`fix`、`perf`、`style`、`docs`、`test`、`refactor`、`build`、`ci`、`chore`、`revert`、`wip`、`workflow`、`types`、`release`

Scope 可从 `src/` 目录自动扫描生成，并智能猜测当前修改的模块。

### 场景 5：版本发布

```bash
pnpm release
```

根据 commit type 自动：
1. 递增版本号（遵循语义化版本）
2. 生成分类 CHANGELOG（`feat` → ✨ Features，`fix` → 🐛 Bug Fixes）
3. 打 git tag

### 场景 6：配置覆盖/定制

```js
// .eslintrc.cjs — 继承后按需覆盖
const base = require("my-code-style/eslint/uniapp")
module.exports = {
    ...base,
    rules: {
        ...base.rules,
        "no-console": "warn",
    },
}
```

```ts
// eslint.config.ts — Flat Config 覆盖
import uniappConfig from "my-code-style/eslint/flat/uniapp"

export default [
    ...uniappConfig,
    {
        rules: {
            "no-console": "warn",
        },
    },
]
```

### 场景 7：uni-app 小程序开发

- **Globals 注入**：`uni`、`UniApp`、`wx`、`WechatMiniprogram`、`getCurrentPages`、`Page`、`App`、`UniHelper`、`$t`、`NodeJS`
- **.nvue 特殊处理**：开启分号、`sourceType: "script"`
- **Stylelint 放行**：`rpx` 单位、`page` 标签、`::v-deep` / `v-deep` / `deep` / `global` / `export` 伪类

---

## 五、架构分层

```
┌─────────────────────────────────────────────────────┐
│  消费层（目标项目）                                    │
│  .eslintrc.cjs / eslint.config.ts / .prettierrc.cjs  │
│  通过 require/import 从 "my-code-style/xxx" 引用      │
├─────────────────────────────────────────────────────┤
│  CLI 脚手架层  (bin/init.cjs)                        │
│  自动检测 ESLint 版本 + CSS 预处理器 + uni-app        │
│  生成对应格式的配置 + 注入 Husky hooks + 修改 pkg     │
├─────────────────────────────────────────────────────┤
│  配置导出层  (package.json exports)                   │
│  v8: eslint/eslint.vue3/eslint.uniapp (CommonJS)     │
│  v9: eslint/flat/eslint/flat/vue3 (ESM .mjs)         │
│  stylelint + stylelint/less-override                  │
│  prettier / commitlint / versionrc                    │
├─────────────────────────────────────────────────────┤
│  配置实现层  (src/)                                   │
│  v8: base.cjs → vue3.cjs → uniapp.cjs (链式继承)      │
│  v9: base.mjs → vue3.mjs → uniapp.mjs (数组展开)       │
│  stylelint: SCSS + Less 双支持                        │
├─────────────────────────────────────────────────────┤
│  工具层  (peerDependencies)                           │
│  ESLint / Prettier / Stylelint / Husky / ...          │
└─────────────────────────────────────────────────────┘
```

---

## 六、lint-staged 配置

初始化后自动注入到 `package.json`，根据 CSS 预处理器动态调整样式文件匹配：

```json
{
    "lint-staged": {
        "**/*.{html,vue,ts,cjs,json,md}": ["prettier --write"],
        "**/*.{vue,js,ts,jsx,tsx}": ["eslint --cache --fix"],
        // SCSS 项目
        "**/*.{vue,css,scss,html}": ["stylelint --fix"]
        // Less 项目则为 "**/*.{vue,css,less,html}"
    }
}
```

同一文件可能匹配多条规则，lint-staged 会并行执行所有匹配的命令。

---

## 七、package.json 脚本

初始化后注入的命令：

| 脚本 | 命令 | 说明 |
|------|------|------|
| `prepare` | `husky install` | 安装 Husky hooks（`pnpm install` 后自动执行） |
| `release` | `standard-version` | 发布新版本 + 生成 CHANGELOG |
| `cz` | `czg` | 交互式 commit 提示工具 |

---

## 八、多项目接入矩阵

| 项目 | ESLint 版本 | CSS | 接入方式 |
|------|------------|-----|---------|
| **speedy-travel** (uni-app) | v8 (.eslintrc.cjs) | SCSS | 无需改动，现有 `.eslintrc.cjs` 已匹配 |
| **speedy-travel-v7-h5** | v9 (eslint.config.ts) | 无 | `npx my-code-style-init` → 生成 eslint.config.ts，跳过 stylelint |
| **fengbo-front** | v8 + @antfu | Less | 保留 @antfu ESLint；init → 生成 .stylelintrc.cjs（含 Less） |
| **新项目** | 自动检测 | 自动检测 | `npx my-code-style-init` 全自动 |
