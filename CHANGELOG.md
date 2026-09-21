## 变更日志

## [1.8.2](https://github.com/myvn/codeStyle/compare/v1.8.1...v1.8.2) (2026-09-21)


### 🐛 Bug Fixes | Bug 修复

* versionrc 静默压优先级警告 + CHANGELOG 结构修复 + 发布工具迁移 catv@12 ([d1b8abf](https://github.com/myvn/codeStyle/commit/d1b8abfcccb595c33d4b9490e87b0599fe37b6bc))

### [1.8.1](https://github.com/myvn/codeStyle/compare/v1.8.0...v1.8.1) (2026-09-20)


### 🐛 Bug Fixes | Bug 修复

* **init:** 安装命令里的版本范围加引号，粘贴不再被 shell 截断 ([9abaf1d](https://github.com/myvn/codeStyle/commit/9abaf1d76ea3aff05f0d26d11a43e8661ed6221a))


### ✨ Features | 新功能

* **init:** 输出步骤化为固定六步，dry-run 全流程预览 ([f14ca47](https://github.com/myvn/codeStyle/commit/f14ca47449b7d3e8f9a381b6e145e99232586886))

## [1.8.0](https://github.com/myvn/codeStyle/compare/v1.7.2...v1.8.0) (2026-09-20)

### ✨ Features | 新功能

- **commitlint:** cz 交互提示改中文，类型列表与 type-enum 对齐 ([2462c92](https://github.com/myvn/codeStyle/commit/2462c92ff85cee06e67ddcd039593fede2a217ff))

### 🐛 Bug Fixes | Bug 修复

- **publish:** provenance 核验改成两层，30 秒预算不再把成功的发布误判成失败 ([5b83f4e](https://github.com/myvn/codeStyle/commit/5b83f4e996fcbd1573813945a20a92b46e339396))
- **publish:** 增强 provenance 校验与日志自证，同步文档与发布流程 ([ba6db63](https://github.com/myvn/codeStyle/commit/ba6db63dce8144f53ad2be9c49278ff67b924518))
- **修复:** Merge branch 'arena/01a0b214-codestyle' ([7c024dc](https://github.com/myvn/codeStyle/commit/7c024dce1bc1ef9d7fc9ef03b74f936b87a4704a))

### [1.7.2](https://github.com/myvn/codeStyle/compare/v1.7.1...v1.7.2) (2026-09-20)

### 🐛 Bug Fixes | Bug 修复

- **publish:** 恢复 --provenance —— 1.7.1 因此丢了 npm 页面的绿勾 ([df8e379](https://github.com/myvn/codeStyle/commit/df8e37978df62265e11454050cb1afce6b003dbf))
- **release:** 发布前防呆，拦住 "tag 已在 HEAD" 时多发一个空版本 ([9da41a8](https://github.com/myvn/codeStyle/commit/9da41a88fdf275e29576daa03a350a6ac780d566))

### [1.7.1](https://github.com/myvn/codeStyle/compare/v1.7.0...v1.7.1) (2026-09-20)

## [1.7.0](https://github.com/myvn/codeStyle/compare/v1.6.1...v1.7.0) (2026-09-20)

### 🐛 Bug Fixes | Bug 修复

- **deps:** stylelint 生态 peer 放宽到 16/17 两条线，并补 Stylelint 17 运行时回归 ([a230edc](https://github.com/myvn/codeStyle/commit/a230edcae73d2b935977567b8f082aaaa74dc938))

### ✨ Features | 新功能

- **init:** 依赖版本体检 —— 已装但版本不匹配、上游配置 peer 冲突、parser 错位 ([2820834](https://github.com/myvn/codeStyle/commit/2820834bc3062900724132f7b29c2581eace13e8))
- **init:** 版本体检精确到 minor —— 只比主版本会漏掉 10.2.0 vs ^10.3.0 ([d13629c](https://github.com/myvn/codeStyle/commit/d13629c947575109ed3319854ab902e5caada145))

### [1.6.1](https://github.com/myvn/codeStyle/compare/v1.6.0...v1.6.1) (2026-09-18)

## [1.6.0](https://github.com/myvn/codeStyle/compare/v1.4.0...v1.6.0) (2026-09-18)

### 🐛 Bug Fixes | Bug 修复

- 修复 ESLint 版本/样式检测误判、规则冲突与 scope 生成缺陷 ([033967b](https://github.com/myvn/codeStyle/commit/033967b0efadbb705bdafe5d4dfc34dbc90578c2))
- 修复 Flat Config 缺 eslint:recommended、Prettier 选项漂移等 7 类问题 ([e4533bb](https://github.com/myvn/codeStyle/commit/e4533bbdaf5752146289a2b4e044ce59658c9453))

### ✨ Features | 新功能

- **diagnose:** ⑤ 拆分排队来源：纯 git 链膨胀 vs 完整链膨胀 vs 错峰启动 ([5caa437](https://github.com/myvn/codeStyle/commit/5caa4372d6ebbc52e19ec771b65d9a0edf041d63))
- **diagnose:** 增加 ⑤ 并发压力段，量"单个耗时被并发放大多少倍" ([df060d5](https://github.com/myvn/codeStyle/commit/df060d56cecfa7f3b830864cc01082ee14583662))
- **diagnose:** 对照 fixture 落在仓库内 vs 系统临时目录 ([7ea7fdc](https://github.com/myvn/codeStyle/commit/7ea7fdc6f913dcad1e76fb110241f875a204c341))
- **diagnose:** 新增 npm run diagnose，定位"一次提交到底花在哪" ([61dbfdb](https://github.com/myvn/codeStyle/commit/61dbfdb99813384097cf2f243b31d20c84695cbd))
- **init:** 补全 peer 体检并按包管理器输出命令，新增初始化链路文档 ([0396198](https://github.com/myvn/codeStyle/commit/03961983be3a6f8cda96d4047450e7595ffefb97))
- **sweep:** 新增 --suite 过滤与 npm run sweep，给本机找最佳并发 ([d65254d](https://github.com/myvn/codeStyle/commit/d65254d1c9ef3277fbc23dc87bb6285d5ef3829c))

## [1.5.0](https://github.com/myvn/codeStyle/compare/v1.4.0...v1.5.0) (2026-09-18)

### 🐛 Bug Fixes | Bug 修复

- 修复 ESLint 版本/样式检测误判、规则冲突与 scope 生成缺陷 ([033967b](https://github.com/myvn/codeStyle/commit/033967b0efadbb705bdafe5d4dfc34dbc90578c2))
- 修复 Flat Config 缺 eslint:recommended、Prettier 选项漂移等 7 类问题 ([e4533bb](https://github.com/myvn/codeStyle/commit/e4533bbdaf5752146289a2b4e044ce59658c9453))

### ✨ Features | 新功能

- **diagnose:** ⑤ 拆分排队来源：纯 git 链膨胀 vs 完整链膨胀 vs 错峰启动 ([5caa437](https://github.com/myvn/codeStyle/commit/5caa4372d6ebbc52e19ec771b65d9a0edf041d63))
- **diagnose:** 增加 ⑤ 并发压力段，量"单个耗时被并发放大多少倍" ([df060d5](https://github.com/myvn/codeStyle/commit/df060d56cecfa7f3b830864cc01082ee14583662))
- **diagnose:** 对照 fixture 落在仓库内 vs 系统临时目录 ([7ea7fdc](https://github.com/myvn/codeStyle/commit/7ea7fdc6f913dcad1e76fb110241f875a204c341))
- **diagnose:** 新增 npm run diagnose，定位"一次提交到底花在哪" ([61dbfdb](https://github.com/myvn/codeStyle/commit/61dbfdb99813384097cf2f243b31d20c84695cbd))
- **init:** 补全 peer 体检并按包管理器输出命令，新增初始化链路文档 ([0396198](https://github.com/myvn/codeStyle/commit/03961983be3a6f8cda96d4047450e7595ffefb97))
- **sweep:** 新增 --suite 过滤与 npm run sweep，给本机找最佳并发 ([d65254d](https://github.com/myvn/codeStyle/commit/d65254d1c9ef3277fbc23dc87bb6285d5ef3829c))

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
