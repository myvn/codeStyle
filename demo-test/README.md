# 工具验证 Demo

使用当前仓库源码验证 my-code-style，不需要下载已发布的 npm 包。

## 运行

在仓库根目录执行（Node.js >=18）：

```bash
npm run test:demo  # 仅 demo-test 场景
npm test           # demo 场景 + tests/ 中的严重 Bug 回归
# 单独运行某一组
node --test demo-test/init-matrix.test.cjs
node --test demo-test/config-contract.test.cjs
node --test demo-test/scopes.test.cjs
```

这些测试仅使用 Node 内置模块，无须先安装第三方依赖。

## 文件和覆盖范围

| 文件                     | 内容                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| fixtures/projects.json   | 可扩展的消费工程参数：基础 TS、Vue+SCSS、Vue+Less、uni-app、ESLint 8、Vue 默认样式、Sass/Less 共存 |
| init-matrix.test.cjs     | 检查生成的入口、样式分支、hooks、scripts、lint-staged、重复初始化与 peerDependencies 检测          |
| config-contract.test.cjs | 公共 exports 解析；Prettier、传统 ESLint、Stylelint、Commitlint、versionrc 配置结构和关键约定      |
| scopes.test.cjs          | 源目录扫描、单数转换、去重、跳过普通文件和缺失目录                                                 |
| helpers.cjs              | 创建临时工程、运行当前 CLI、读取生成结果、测试结束清理                                             |
| ../tests/init.test.cjs   | 原有 23 项安全回归：无效 manifest、参数校验、已有配置保护、格式冲突、dry-run 等                    |

## 如何添加场景

在 `fixtures/projects.json` 添加一项，矩阵测试会自动运行，例如：

```json
{
    "name": "my-vue-less-project",
    "dependencies": { "eslint": "^9.0.0", "vue": "^3.0.0", "less": "^4.0.0" },
    "entry": "my-code-style/eslint/flat/vue3",
    "style": "my-code-style/stylelint/less"
}
```

`style: null` 表示应跳过 Stylelint；`legacy: true` 表示应生成 `.eslintrc.cjs`。
依赖字符串是用于检测的测试输入，不代表这些依赖已经安装。

## 安全边界

- CLI 仅在操作系统临时目录中执行，不覆盖本仓库配置。
- 每个测试独立目录，结束后自动清理；不要在 demo-test 目录手动执行 init。
- 不执行安装、Git 提交、版本发布或远程请求。
- npm 发布白名单没有包含此目录，测试文件不会成为包运行时内容。

## 当前验证状态

基础测试 83 项全部通过；现代工具链测试 59 项、ESLint 8 测试 27 项、Stylelint 17 测试 8 项全部通过，合计 **177 项、0 TODO**（`scripts/test-all.cjs` 提供分类统计、实时进度与总条数）。此前的 Less 依赖提示遗漏、Commitlint init 绕过和 nvue 解析错误均已修复，原 TODO 断言已成为强制回归检查。

上述 `npm test` 只验证 CLI 与配置契约；真实工具集成测试单独运行，见下文。未统计行/分支覆盖率，不代表所有功能都已覆盖。

## 真实工具链集成测试

```bash
npm run test:integration:setup
npm run test:integration
npm run test:legacy:setup # test:all 还需要独立 ESLint 8 环境
npm run test:stylelint17:setup # Stylelint 17 生态（stylelint 17 + config-recommended 18 + postcss-html 2）
npm run test:stylelint17       # Stylelint 17 兼容性回归
npm run test:all  # 基础回归 + ESLint 9 集成 + ESLint 8 集成 + Stylelint 17，结束时输出分类统计与总条数
```

依赖安装到被 Git 忽略的 `demo-test/.runtime/`，不改根项目依赖或锁文件。首次安装需要网络。执行测试时将当前源码复制到隔离环境的 `node_modules/my-code-style`，因此测试的不是 npm 上的旧版工具。不要并行运行多份集成测试命令，它们共享这一隔离环境。

### 依赖兼容性修复

- `vue-eslint-parser` 调整为 `^10.3.0`，匹配 ESLint Vue 插件 10 的要求。
- `postcss-html`、`stylelint-config-html` 调整为 `^2.0.0`，匹配 Vue 样式预设 2 的要求。
- Less 缺失依赖安装提示补充 `stylelint-config-html`。

2026-09-16，在 Node v22.22.3 下，已在全新临时目录以正常 `npm install --ignore-scripts` 安装，并通过 `npm ls --depth=0`。未使用 `--force` 或 `--legacy-peer-deps`；诊断绕过安装模式已移除。

集成依赖精确安装结果保留于本地 `.runtime/package-lock.json`，当前未提交该锁文件，不同时间解析的版本可能变化。此结果不代表 Node 18 或其他系统上的兼容性已验证。

### 本次实测（正常依赖安装）

| 场景                                                                             | 结果     |
| -------------------------------------------------------------------------------- | -------- |
| Prettier JS / TS / JSON 格式化与幂等性                                           | 3 项通过 |
| ESLint 基础 TS / Vue / uni-app 正常代码                                          | 3 项通过 |
| ESLint 错误格式识别、自动修复和二次检查                                          | 通过     |
| ESLint TS 语法错误识别                                                           | 通过     |
| Stylelint SCSS / Less 修复、复检和非法属性报错                                   | 2 项通过 |
| Commitlint 正常提交、非法 type、超长标题                                         | 通过     |
| 真实 Husky commit-msg hook 拒绝非法提交、允许合法提交                            | 通过     |
| 含 init 的非法提交不再绕过验证                                                   | 通过     |
| 嵌套 .nvue 模板解析                                                              | 通过     |
| 根目录 / 嵌套 nvue：TS setup、import、uni globals、格式化复检                    | 2 项通过 |
| Flat Config：`curly` 生效并可自动补全大括号、引号与 Prettier 一致、nvue 分号例外 | 3 项通过 |
| nvue 错误脚本被拒绝                                                              | 通过     |
| 规范初始化提交允许，非规范 init 文本拒绝                                         | 通过     |

Husky 测试仅在 `.runtime` 内临时 Git 仓库创建本地空提交，设置测试身份并禁用签名，不影响工作仓库，不推送远程。为单独验证 commit-msg，测试明确清空临时仓库的 pre-commit hook；该用例只验证 commit-msg；后续完整链路用例保留两个 hooks，实际验证 lint-staged。它也要求本机已安装 Git，并允许运行 hooks。

### 尚未覆盖

- 更多 Vue/nvue 语法边界（nvue 任务匹配与分号例外已覆盖）；
- standard-version 的发布标签与远程推送；
- Node 18/20、Windows 等环境矩阵；
- 代码行/分支覆盖率统计。

## 完整提交链路回归（本套件共 59 项，其中完整提交链 7 项 + 空提交守卫 1 项 + 发布防呆 4 项）

运行 `npm run test:integration`（包含规则测试及完整 Git 提交链路），或 `npm run test:all`。

集成套件按"一条提交链一个文件"拆成 23 个文件（`lint` / `commit-chain-{scss,less,both}` /
`error-recovery` / `error-recovery-style` / `embedded-style` / `partial-staging` /
`git-edge` / `git-mv-rm` / `release`），公共引导在 `integration/_runtime.cjs` 里：它负责把
当前源码同步进隔离环境，保证 `node --test` 并行执行多个文件时只同步一次、不会读到写了
一半的文件（指纹 + 目录锁），并惰性加载 `prettier` / `eslint`。
每个文件跑的都是独立临时 Git 仓库，所以文件级并行是安全的；拆细是为了让多核机器上
墙钟时间等于"最慢的那一个文件"而不是所有提交链的总和。
`npm run test:all` 会逐个列出这些文件里的每条用例（✓/✗ + 耗时），加 `--quiet` 只看汇总。

```bash
npm run test:integration                       # 走运行器：文件级并行 + 进度 + 最慢文件定位
npm run test:integration -- --concurrency=4    # 手动指定文件级并发（默认按核数/内存自动算，封顶 8）
npm run test:integration -- --profile          # 列出每个测试文件的耗时
npm run test:all -- --parallel                 # 四套件再叠一层并行
```

### 执行策略

CLI 生成的 lint-staged 配置使用互斥文件分组，每个文件只归属一个任务数组。数组内任务串行，不同文件组可以并行：

| 文件组                                      | 执行顺序                                    |
| ------------------------------------------- | ------------------------------------------- |
| Vue / nvue                                  | Prettier → ESLint → Stylelint（启用样式时） |
| JS / TS / JSX / TSX / CJS / MJS / MTS / CTS | Prettier → ESLint                           |
| HTML / CSS / 所选 SCSS 或 Less              | Prettier → Stylelint（启用样式时）          |
| JSON / JSON5 / Markdown / YAML              | Prettier                                    |

提交任务不再使用 ESLint 的共享磁盘缓存，避免并发组同时写 `.eslintcache`。匹配 JSX/TSX 不代表已验证其 parser 和规则兼容性。样式分支仍沿用单一 SCSS/Less 检测策略，不代表混合预处理器的全部文件均覆盖。

### 已验证

- SCSS、Less 两类项目保留真实 pre-commit + commit-msg hooks；JS、TS、Vue、nvue、CSS 和预处理器文件自动修复后成功提交。
- 中文、空格路径正常传递给工具。
- 重新暂存同样的错误格式，修复仍得到相同内容，空提交被拦截。
- JS/TS/Vue/nvue 语法错误以及 CSS/SCSS/Less 非法属性阻止提交；已经执行的格式化修改被回滚。
- Vue/nvue 内嵌样式非法属性由 Stylelint 拦截。
- 部分暂存成功时，提交包含修复后的暂存内容，未暂存修改和未跟踪文件不进入提交。
- 检查失败时，HEAD、暂存区、工作区恢复为提交前状态。
- 未暂存补丁与格式化结果冲突时安全退出，验证原始内容被保留；此时需要用户自行拆分修改或调整暂存范围，不能保证任意部分暂存都自动成功。
- 代码检查通过后，非法 commit message 仍被 commitlint 拦截。commit-msg 失败并不保证撤销此前成功的 pre-commit 修复。
- 用实际 glob 匹配验证支持的扩展名只命中一个任务组。

尚未覆盖所有 Git 边界，包括重命名/删除、已有用户 stash、子模块、嵌套 lint-staged 配置、首次无 HEAD 的提交，以及不同 OS/Node 版本。现有 scope 猜测未在此批修改。

### 旧项目升级

本次修改的是 CLI 生成模板，已接入项目不会自动更新自己的 package.json。请备份后手动更新 lint-staged 分组，或审查 `init --dry-run` 再初始化；初始化仍可能覆盖其他配置/hooks，不能直接无备份运行。

## ESLint 8 / 传统 Vue 兼容回归

```bash
npm run test:legacy:setup
npm run test:legacy
```

`setup-legacy.cjs` 安装到被忽略的 `.runtime-legacy/`，固定 ESLint 8 支持下限 **8.57.0**；不与 `.runtime/` 的 ESLint 9 共用依赖。安装不使用 `--force` 或 `--legacy-peer-deps`。测试每次复制当前源码，在独立消费工程中执行 CLI 生成传统配置，并实际调用 ESLint 8 API 和命令行。

27 项覆盖：

- 确认运行的是 ESLint 8.57.0；
- 基础 TS、Vue、uni-app 的正常代码、格式修复及幂等复检、错误脚本拒绝（9 项）；
- 根目录与嵌套 nvue：TS setup、模块 import、uni globals、分号例外（2 项）；
- CommonJS 配置文件 require 合法使用；
- 生成的 lint 脚本确实遍历 TS、Vue、nvue 并拒绝错误代码（3 项）；
- Vue essential 的重复属性规则实际生效；
- 引号规则与 Prettier 一致（含双引号的字符串不再产生不可修复错误）；
- 生成的 lint 脚本忽略 `dist/`、`coverage/` 等构建产物。

修复前真实复现 `plugin:vue/vue3-essential` 无法加载；现在使用 Vue 插件 10 的 `plugin:vue/essential`。同时修复传统 nvue 覆写、CommonJS require 规则，以及目录 lint 的扩展名漏检。

依赖声明允许 `eslint ^8.57.0 || ^9.0.0`，CLI 的缺失依赖命令仍按选定格式推荐单一主版本，避免打印带 shell `||` 的安装参数。ESLint 8 已 EOL，兼容测试不意味着建议新项目继续使用它。Node/OS 矩阵和 ESLint 8 的完整 Husky 提交链仍未测试（完整提交链在 ESLint 9 环境验证）。

## Stylelint 17 生态兼容回归

```bash
npm run test:stylelint17:setup   # 安装到被忽略的 .runtime-sl17/
npm run test:stylelint17
```

**为什么单独有一套**：我们在 `peerDependencies` 里声明了 `stylelint ^16.24.0 || ^17.0.0`
（以及 `stylelint-config-recommended ^17||^18`、`recommended-scss ^16||^17`、
`recess-order ^5||^6||^7`、可选 `stylelint-order ^6||^7||^8`）。声明支持就必须真的跑，
而 stylelint 17 时代整条配置链都换了主版本（config-recommended 18、recommended-scss 17、
postcss-html 2、stylelint-order 8）。

这个运行时装的正是 17 线，8 项用例用**真实 stylelint 17 CLI** 加载 init 生成的
`.stylelintrc.cjs`，覆盖：

- 隔离环境确实是 stylelint 17（不是 16）；配置包分别是 18 / postcss-html 2；
- 正常 SCSS 通过、非法属性（`property-no-unknown`）被拦；
- `--fix` 生效且幂等（第二次不再改动文件）；
- Vue 单文件内嵌 SCSS 被检查；
- Less 工程走 `my-code-style/stylelint/less` 分支配置；
- 混合 SCSS + Less 工程两种文件都能检查；
- `stylelint-order`（recess-order 7 的 peer）可用，位置属性顺序错误会被报出。

stylelint 17 生态要求 Node ≥ 22.12（`postcss-html@2` / `stylelint-config-html@2` /
`recommended-vue@2` 的 engines），所以这套用例在更低的 Node 上会**整体跳过并说明原因**，
不会假装通过；setup 也不会尝试安装。

同时，集成套件固定在 stylelint **16 线**（`demo-test/setup-integration.cjs` 里显式钉住
`stylelint 16.26.1 + config-recommended ^17 + recommended-scss ^16 + recess-order ^5`），
这样声明范围的**两端**都有真实运行回归，而不是只测最新那一端。
