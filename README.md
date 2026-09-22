# my-code-style

Lint/Format/Git 配置工程化 npm 包。适用于 Vue 3 + TypeScript + uni-app 项目及纯 Node/TS 基础工程。

支持 ESLint v8 (.eslintrc.cjs) 和 ESLint v9 (Flat Config) 双格式，支持 SCSS 和 Less 样式检查。

## 项目文档

> 随 npm 包发布的只有本 README 与 `CHANGELOG.md`；下面其余文档在仓库里（`docs/` 与 `TECHNICAL_DOC.md` 未列入 `files` 白名单），装包后在 `node_modules/my-code-style/README.md` 能看到的就是本文件。

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

### 用 `pnpm cz` 提交（交互式）

`czg` 由**暂存区驱动**——没有暂存文件会直接报 `No files added to staging!` 并退出，所以顺序是先 `git add` 再 `pnpm cz`：

```bash
git add -A
pnpm cz                 # = czg；npm 项目：npm run cz
```

六步交互，**除类型外每一步都能直接回车跳过**：

| 步骤 | 界面            | 说明                                                                                                                                                         |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | 选择类型        | 15 种（见下表），支持输入关键字过滤                                                                                                                          |
| 2    | 选择 scope      | 候选来自 `src/` 下的目录（自动转单数：`components` → `component`）；默认值按**暂存文件**推断，改了 `src/api/` 默认就是 `api`；也可选「自定义」手填或「不填」 |
| 3    | 一句话描述      | 右侧 `[N more chars allowed]` 是还能写多少字符，已扣除 `类型(scope): ` 前缀——上限就是 commitlint 的 `header-max-length`（本配置 108）                        |
| 4    | 详细描述        | 可选，写多行时用管道符分隔                                                                                                                                   |
| 5    | BREAKING CHANGE | 可选                                                                                                                                                         |
| 6    | 关联 ISSUE      | 可选（如 `#31, #34`），最后预览并确认 Y/n                                                                                                                    |

| 类型       | 含义                               | 类型       | 含义                          |
| ---------- | ---------------------------------- | ---------- | ----------------------------- |
| `feat`     | 新功能                             | `build`    | 影响构建系统或外部依赖的变更  |
| `fix`      | 修复缺陷                           | `ci`       | CI 配置与脚本变更             |
| `docs`     | 仅文档变更                         | `chore`    | 其他不涉及 src 与测试的杂项   |
| `style`    | 不影响代码含义的格式调整           | `revert`   | 回滚此前的提交                |
| `refactor` | 既非修复缺陷也非新增功能的代码调整 | `wip`      | 开发中（临时提交）            |
| `perf`     | 性能优化                           | `workflow` | 工作流改进                    |
| `test`     | 补测试或修正既有测试               | `types`    | 类型定义文件变更              |
|            |                                    | `release`  | 发布相关（版本号 / 变更日志） |

省键盘的写法：

| 写法                              | 作用                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm cz :f`                      | 用预置别名直接提交：`f`=`docs: fix typos`、`r`=`docs: update README`、`s`=`style: update code format`、`b`=`build: bump dependencies`、`c`=`chore: update config` |
| `pnpm cz -r`                      | 重放上一条提交信息（改完文件再提交同样的说明）                                                                                                                    |
| `pnpm cz --help`                  | 其他模式：`emoji` / `break` / `ai` / `gpg` / `checkbox`（默认都不开启）                                                                                           |
| `git commit -m "feat(api): 说明"` | 不用交互也行，但**冒号后必须有空格**，否则报 `type may not be empty` + `subject may not be empty`                                                                 |

提交时 `commit-msg` 钩子会用同一份 commitlint 配置复核：type 必须是上表 15 种之一、描述不能为空、标题 ≤ 108 字符；`Merge branch …` / `Revert …` 这类消息自动忽略。想换提示语言或措辞，见下方常见问题。

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
| `my-code-style/versionrc`               | commit-and-tag-version 配置   |
| `my-code-style/package.json`            | 包元数据（工具读取版本用）    |

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
- **ESM 兼容的自动版本发布**：支持 CommonJS（`.versionrc.js`）与 ESM（`.versionrc.cjs`）工程无缝对接 commit-and-tag-version（standard-version 的社区维护分支），一键版本递增与 CHANGELOG 生成。peer 范围有意钉在 `^12`：13.x 的 writer 存在回归且要求搭配新 preset 组合，稳定性待观察后再放宽（旧项目遗留的 `release: standard-version` 会在 init 时被自动纠偏）

## 常见问题（使用中遇到的问题）

| 现象                                                                 | 原因                                                                           | 处理                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 只装了 `my-code-style`，`pnpm lint` 报找不到 eslint                  | peerDependencies 全部是 optional，不会自动安装                                 | 按 CLI 结尾输出的清单装全，**别漏 `typescript`**（`@typescript-eslint/parser` / `typescript-eslint` 的必需 peer）                                                                                                                                       |
| `pnpm prepare` 输出 `.git can't be found`，hooks 不生效              | husky 必须在 git 仓库内执行                                                    | 先 `git init`、再 `pnpm prepare`；验证 `git config core.hooksPath` 输出 `.husky/_`                                                                                                                                                                      |
| 安装依赖报 `ERR_PNPM_IGNORED_BUILDS`（如 `unrs-resolver`）           | pnpm 10+ 默认拦截依赖的构建脚本                                                | 执行 `pnpm approve-builds` 后重新安装，不是初始化失败                                                                                                                                                                                                   |
| `eslint` 声明 `>=8.0.0` 却生成了 Flat Config                         | 无上界范围 npm 实际会装 9，CLI 按 9 生成                                       | 确定留在 8 就把范围收紧到 `<9`（如 `~8.57.0`）后重跑 init                                                                                                                                                                                               |
| 重复 init 后，改过的 `.prettierrc.cjs` / hooks 被覆盖                | 除 ESLint 入口与已存在的 `.gitignore` 外，目标文件一律覆盖                     | 先用 `--dry-run` 看清单、用 `--backup` 留档（备份含 `package.json`，目录会自动写入 `.gitignore`）                                                                                                                                                       |
| 自定义 `lint-staged` 分组消失                                        | `lint-staged` 为整体替换，避免残留失效分组                                     | 从 `.my-code-style-backup/package.json` 恢复后手动合并                                                                                                                                                                                                  |
| 提交时 lint 报错、提交失败                                           | 修不了的错误（语法错误、非法 CSS 属性）会阻止提交                              | 按提示修复；紧急情况可用 `git commit --no-verify`，但请在 **CI 用 `pnpm lint` 兜底**                                                                                                                                                                    |
| 提交信息被拒（`type may not be empty` / `subject may not be empty`） | 提交信息需符合 conventional commits，`类型(范围): 描述` 的**冒号后必须有空格** | 先看冒号后面有没有空格（`fix:(修复)…` 会被判成 type 与 subject 双空）；用 `pnpm cz` 交互式生成；header 上限 108 字符                                                                                                                                    |
| `pnpm cz` 报 `No files added to staging!`                            | czg 由暂存区驱动：没有暂存文件就不启动（`--all` / `-a` 也不绕过）              | 先 `git add -A` 再 `pnpm cz`；scope 候选与默认值也是按暂存区推断的                                                                                                                                                                                      |
| 想让 `pnpm cz` 的提示换成英文/自己的措辞                             | 提示语来自 `prompt.messages`，本包默认中文                                     | 在项目的 `.commitlintrc.cjs` 里覆盖 `prompt.messages`（标题）与 `prompt.types`（类型描述）；scope 列表里的「自定义 / 不填」对应 `customScopesAlias` / `emptyScopesAlias`                                                                                |
| 老项目已有 `.eslintrc.*`，init 只读退出                              | ESLint 版本与配置格式冲突时 CLI 拒绝写入                                       | 先确认/迁移版本，再重跑 init                                                                                                                                                                                                                            |
| `pnpm release` 之后如何发布                                          | `release` 只生成版本、CHANGELOG、提交与 tag                                    | 另行执行 `npm publish`                                                                                                                                                                                                                                  |
| 装完看到一片 `unmet peer` 警告，要不要管                             | npm 遇到不满足的 peer 会直接 ERESOLVE 拒装，pnpm 只打印 WARN 就装完            | 先看警告来自谁：`unmet peer … from my-code-style` 说明版本声明没跟上，先升级本包；来自别的包（如 `postcss-html@1.8.1` 却要 `^2`）按提示对齐。重跑 `init` 会主动体检（范围精确到 minor，例如 `vue-eslint-parser 10.2.0` 不满足 `^10.3.0`）并打印对齐命令 |
| `stylelint` 该用 16 还是 17                                          | 两条线都支持：`stylelint ^16.24.0 \|\| ^17.0.0`                                | 16 线（`stylelint-config-recommended@17`）兼容面最广；17 线要 stylelint 17 + `config-recommended@18` + `recommended-scss@17` + `stylelint-order@7/8`，且 Node ≥ 22.12。两条线都有真实运行回归（集成套件跑 16 线，Stylelint 17 套件跑 17 线）            |

完整 FAQ（含更多场景与解释）见 [docs/manual.md](docs/manual.md#五使用中遇到的问题faq)。

## 测试套件

```bash
npm run test:all               # 全量运行 189 项：用例明细 + 分类统计 + 最慢文件定位
npm run diagnose               # 换机器后先跑它：进程 / git / 文件系统 / hooks 各占多少
npm run sweep                  # 给本机找最佳文件级并发（扫 integration 套件）
npm test                       # 只跑基础 CLI 与配置矩阵（88 项）
npm run test:integration:setup # 安装现代化隔离依赖运行环境
npm run test:integration       # Flat Config、真实 Husky 及提交链路测试（65 项）
npm run test:legacy:setup      # 安装 ESLint 8 隔离运行环境
npm run test:legacy            # ESLint 8.57.0 兼容性回归测试（27 项）
npm run test:stylelint17:setup # 安装 Stylelint 17 隔离运行环境
npm run test:stylelint17       # Stylelint 17 生态兼容性回归（8 项）
```

`npm run test:all` 由 `scripts/test-all.cjs` 驱动，输出**套件 → 用例 → 汇总**三层：
每个大类下面列出它的每条用例（✓/✗/○ + 耗时），最后给出分类统计与总条数。

```text
  my-code-style 测试套件

  ▶ [1/4] 基础 CLI 与配置矩阵  （共 88 项，5 文件 · 3 文件并发（自动：2 核 / 内存 4G））
      ✓ 运行器 TAP 解析：统计通过与失败、SKIP 与每用例耗时 · 7ms
      ✓ cz 交互提示为中文，且可选类型与 type-enum 一一对应 · 1ms
      ✓ peer 范围覆盖我们声明支持的上游大版本（校准防回退，BUG-027） · 0ms
      ✓ 一键安装命令对含 || 的版本范围加引号，可整段粘贴执行 · 40ms
      ✓ 初始化结尾指引把 cz 用法说清楚（先 git add + 指到 README 手册） · 80ms
      …
     ✓ 通过 88  ·  3.6s   · 最慢文件 init-matrix.test.cjs 3.4s

  ▶ [2/4] 现代工具链与提交链  （共 65 项，24 文件 · 3 文件并发（自动：2 核 / 内存 4G））
      ✓ 完整提交链：JS/TS/Vue/nvue/CSS/less 自动修复及二次复检 · 10.4s
      ✓ 发布防呆：HEAD 已有 v* tag 时拦截（此时 release 工具会静默抬版并写出空 CHANGELOG） · 609ms
      …
     ✓ 通过 65  ·  45.3s   · 最慢文件 commit-chain-both.test.cjs 12.4s

  ▶ [3/4] ESLint 8 兼容性  （共 27 项，1 文件 · 3 文件并发（自动：2 核 / 内存 4G））
      ✓ 独立运行 ESLint 8 支持下限而非 ESLint 9 · 1ms
      ✓ ESLint 8 base：实际 CLI 加载生成配置并接受正常文件 · 1.3s
      …
     ✓ 通过 27  ·  18.3s

  ▶ [4/4] Stylelint 17 兼容性  （共 9 项，1 文件 · 3 文件并发（自动：2 核 / 内存 4G））
      ✓ 隔离环境装的是 stylelint 17（不是 16） · 2ms
      ✓ 生成的 .stylelintrc.cjs 在 stylelint 17 下可加载并放过正常 SCSS · 700ms
      …
     ✓ 通过 9  ·  8.2s

  ──────────────────────────────────────────────────────
  套件                      通过    失败    跳过    用时
  ──────────────────────────────────────────────────────
  基础 CLI 与配置矩阵         88       0       -    3.6s
  现代工具链与提交链          65       0       -   45.3s
  ESLint 8 兼容性             27       0       -   18.7s
  Stylelint 17 兼容性          9       0       -    8.2s
  ──────────────────────────────────────────────────────
  合计                       189       0       -   76.9s
  ──────────────────────────────────────────────────────

  ⏱ 最慢文件：eslint8.test.cjs 18.0s · commit-chain-less.test.cjs 11.4s · commit-chain-both.test.cjs 11.3s

  ✅ 全部通过：189/189 项，用时 76.9s
```

终端里每个套件下方还有一条实时进度条（`██████░░░░ 38/66  失败 0  4.0s`）。附加参数：

| 参数                     | 作用                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `-- --quiet`             | 只看套件结论与汇总表，不列用例明细（长输出时用）           |
| `-- --parallel`          | 强制四个套件同时跑（核数 ≥ 8 时默认已自动开启）            |
| `-- --serial`            | 强制串行（CI 形态，输出顺序最稳定）                        |
| `-- --jobs=2`            | 配合并行限制同时运行的套件数，其余排队（面板显示"等待中"） |
| `-- --suite=base,legacy` | 只跑指定套件（base / integration / legacy，逗号分隔）      |
| `-- --concurrency=4`     | 覆盖套件内文件级并发（默认按核数与内存自动算，封顶 8）     |
| `-- --verbose`           | 展开每个套件的原始 TAP 输出（排查单条用例）                |
| `-- --profile`           | 额外列出每个测试文件的耗时（定位集成套件瓶颈时用）         |
| `-- --no-count`          | 跳过预统计，进度条退化为"已完成 N 项"                      |
| `-- --progress`          | 在非 TTY（CI 日志）中也强制刷新进度行                      |

### 并行跑更快

测试用例之间不用同一份目录：基础套件只用临时目录，集成套件用 `demo-test/.runtime`，
ESLint 8 套件用 `demo-test/.runtime-legacy`，所以两层并行都是安全的。**核数 ≥ 8 的机器
会自动开启套件级并行**（想固定成 CI 那种串行输出用 `--serial`）：

想给本机定一个更合适的并发数，跑 `npm run sweep`：它会把 integration 套件在 auto/1/2/4/6/8/12/16/24 各跑一次，直接给出最快的那一档（并发越高越慢就说明瓶颈在进程启动而非 CPU）。

换了机器发现某个套件特别慢？先跑 `npm run diagnose`：它会把「进程启动 / npx 开销 / git / 文件系统 / 一次真实提交的 hooks」逐项列出来，直接指出时间花在哪一层。

```bash
npm run test:all                  # 16 核机器：自动并行，墙钟 ≈ 最慢的那套
npm run test:all -- --serial      # 强制串行
npm run test:all -- --parallel    # 低核机器上强制并行
npm run test:all -- --profile     # 看每个测试文件耗时，定位瓶颈
```

两层并行的实现：

- **文件级**：集成套件按"一条提交链一个文件"拆成 23 个测试文件，**由运行器自己按文件
  调度**（每个文件一个 `node --test` 进程），不依赖 Node 的 `--test` 默认并发值——
  同一个文件内的用例仍然串行（真实 git 仓库不能并行改），文件之间才是并发的。
- **套件级**：四个套件再并行，互不共享目录（基础只碰系统临时目录，集成用
  `demo-test/.runtime`，ESLint 8 用 `.runtime-legacy`，Stylelint 17 用 `.runtime-sl17`）。

因为每个文件里跑的都是真实 `git commit`（单次 0.5–3.9s），墙钟由**最慢的那个文件**
决定，所以文件尽量拆到"一个文件一次提交"。每个套件跑完会直接告诉你最慢文件是谁，
汇总区再给一次全局 `⏱ 最慢文件`：

| integration 子文件（23 个）                              | 单文件耗时（2 核、串行） | 内容                                    |
| -------------------------------------------------------- | ------------------------ | --------------------------------------- |
| `commit-chain-{scss,less,both}`                          | 2.7–3.3s                 | 三种预处理器的完整提交链（各 1 次提交） |
| `empty-commit-guard`                                     | 2.7s                     | 空提交守卫（重复暂存不得产生漂移提交）  |
| `git-mv-rm`                                              | 3.2s                     | `git mv` / `git rm` 走 lint-staged      |
| `embedded-style-{vue,nvue,mixed-less}`                   | 1.9–2.0s                 | Vue/nvue 内嵌样式错误拦截               |
| `git-edge-{first-commit,stash}`                          | 2.1s / 1.7s              | 首次提交、用户 stash 保留               |
| `partial-staging{,-unstaged,-invalid-message,-conflict}` | 0.5–1.7s                 | 部分暂存与冲突恢复                      |
| `error-recovery-{css,scss,less,js,ts,vue,nvue}`          | 0.5–1.4s                 | 不可修复错误的回滚                      |
| `lint`                                                   | 3.9s                     | 32 条规则与格式化行为（无提交链）       |
| `release`                                                | 0.8s                     | commit-and-tag-version                  |

两层并发都要控制规模，所以默认并发不交给 Node 猜，而是运行器自己算——**核数 × 1.5
（至少 核数 - 1），再乘内存上限，最后封顶 8**（16 核机器实测：4/6/8/12/16/24 并发对应
20.3/18.7/19.0/19.2/18.9/19.1s，6–8 之后加并发只会让每个文件变慢；要更多用
`--concurrency` 覆盖）：实测一条真实提交链（`git` + `npx` + `eslint` +
`prettier`）峰值 RSS 约 0.8GB，运行器留 30% 内存给系统，避免并发过多的小内存机器被
并发 git/npx 撑到 OOM（进程被 SIGKILL）；文件数多于并发数时，**用例少的文件（多半是同
一条重链）优先开跑**，避免长任务被排进最后一波、墙钟再多乘一倍。

实测（2 核沙箱，沙箱内存 4G，所以自动并发是 3）——下表是引入 hook 优化那次的对照运行（当时 168 项）：

| 运行方式                                                                    | 墙钟时间                                    |
| --------------------------------------------------------------------------- | ------------------------------------------- |
| 串行套件 + 文件级并发 1（CI 旧形态）                                        | 62.4s（hook 改造前同配置 70.3s）            |
| 串行套件 + 自动并发 3（默认）                                               | 47.2s（hook 改造前同配置 51.8s）            |
| `--parallel` 四套件 + 自动并发 3                                            | 43.0s（hook 改造前同配置 46.6s）            |
| `node --test demo-test/integration/*.test.cjs`（Node 自己调度，等同旧命令） | 43.7s（只看集成套件那一段）                 |
| `npm run test:integration`（运行器调度，自动并发 3）                        | 30.6s（只看集成套件那一段）                 |
| 串行套件 + 文件级并发 23（全部一波）                                        | ✗ 3.8G 内存沙箱被 OOM 压垮（19 项 SIGKILL） |

同机复测（189 项，同一台 2 核沙箱连续跑；绝对秒数随机器负载波动，相对关系稳定）：串行套件 + 文件级并发 1 = 84.4s、默认自动并发 3 = 76.9s、`npm run test:integration` = 45.3s（其余口径为早前基线实测，相对关系稳定）。

（2 核沙箱里并行收益被 CPU 争抢吃掉大半，`--concurrency=1` 时单个文件只要 0.7–4.2s；
16 核机器上集成套件那段 ≈ 最慢子文件，即"一次真实提交"的量级。）
生成的 hook 优先直连本地 bin（husky 已把 `node_modules/.bin` 放进 PATH），
找不到时才退回 `npx --no-install`——每次提交因此少起两个 npm CLI（实测每个 hook
省 130–185ms），提交链从 3.3s 降到 2.8s。集成 fixture 同样用环境变量传 git 身份
（`GIT_AUTHOR_*` / `GIT_CONFIG_COUNT`）代替 4 次 `git config`。

`demo-test/integration/_runtime.cjs` 用「指纹 + 目录锁」保证并发启动时只同步一次
隔离环境源码，不会读到写了一半的文件；`prettier` / `eslint` 以 getter 惰性加载，
只做提交链的 8 个文件不再为它们付启动开销。

未安装隔离运行环境时，对应套件会明确标记"未运行"并给出 setup 命令，退出码为 1（不会假装全绿）。

## 发布（维护者）

一条命令发布（升版本 → 更新 CHANGELOG → 提交 → 打 tag → 推送，推 tag 即触发发布工作流）：

```bash
npm run release:push
```

也可以拆成两步：`npm run release` 只做到打 tag，之后用 `git push --follow-tags origin <分支>` 手动推送。

> ⚠️ **别把两条命令连起来跑**：`release` 已经把 tag 打在 HEAD 上了，紧接着跑 `release:push`，发布工具 **不会报错**，而是把版本号再抬一级、写出一个没有条目的空 CHANGELOG 并打出第二个 tag —— 等于多发一个空版本（npm 上不可撤销）。
>
> 两条命令的第一步都是 `scripts/release-guard.cjs` 发布前防呆，命中下面两种情况会直接中止并打印该执行的命令：HEAD 上已经有 `v*` tag（说明这一版已生成，只差推送）、已跟踪文件还有未提交改动（会被卷进版本提交）。未跟踪文件不拦截。

`.github/workflows/publish.yml` 只接受 **`v*` tag** 触发（`workflow_dispatch` 会先校验 ref，分支上手动触发直接失败），并且在测试全绿 + `npm pack --dry-run` 通过后才发布；发布步骤失败即失败，不做静默降级。

### 发布后的 provenance 自动核验（npm 页面上的绿勾）

绿勾 = 该版本带 provenance 证明。工作流用两层核验保证它不会悄悄消失：

1. **发布当场自证**（不等 registry）：npm 真正生成 provenance 时必定打印
   `Signed provenance statement with source and build information from GitHub Actions`，
   工作流把这行当硬断言——没有就当场失败标红。1.7.1 正是漏了 `--provenance`，日志里没有这行、
   流程却全绿，只有 npm 页面少一个勾。
2. **registry 侧回查**：轮询 `https://registry.npmjs.org/-/npm/v1/attestations/my-code-style@<version>`，
   前 6 次每 10 秒、之后每 30 秒，共约 5.5 分钟。**这里的耐心是必需的**：1.7.2 的 attestation
   在发布后约 2 分钟才可查（透明日志签名时间 06:47:57Z，而 publish 结束于 06:45:49Z），
   30 秒的预算会把一次成功的发布误判成失败。

等待参数可用环境变量覆盖（`MAX_ATTEMPTS` / `FAST_ATTEMPTS` / `RETRY_FAST` / `RETRY_SLOW`），便于本地复现这套轮询逻辑。

### 发布凭据（推荐切到 Trusted Publishing）

工作流默认按 **npm Trusted Publishing（OIDC）→ `NPM_TOKEN`** 的顺序取凭据：`NPM_TOKEN` secret 存在时用 token，删掉后**无需改代码**自动改走 OIDC。切换步骤：

1. 打开 `https://www.npmjs.com/package/my-code-style/access` → Trusted Publisher → GitHub Actions，填：
    - Organization or user：`myvn`
    - Repository：`codeStyle`
    - Workflow filename：`publish.yml`（大小写与 `.yml` 后缀都要精确匹配）
    - Environment：`npm-publish`（与本仓库 Environments 里的名字一致）
2. 仓库 Settings → Environments → `npm-publish` 添加 **required reviewers**（发布前人工批准；不配则该环境无保护）。
3. 在 GitHub 仓库 Settings → Secrets 删除 `NPM_TOKEN`，并到 npm 账号下吊销对应 token。

OIDC 要求发布环境是 GitHub-hosted runner + `id-token: write` + npm CLI ≥ 11.5.1（工作流用 Node 24 自带），因此 `setup-node` **刻意不写 `registry-url`**——那会生成带 `_authToken` 的 `.npmrc`，让 npm 以为认证已就绪而跳过 OIDC。

工作流里的 action 固定在大版本号上（`actions/checkout@v7` / `actions/setup-node@v7` / `softprops/action-gh-release@v3`），它们都已迁到 **Node 24 运行时**——GitHub 已弃用 Actions 的 Node 20 运行时，停留在 `@v4` 会在每次运行时报 `Node.js 20 is deprecated` 告警。自托管 runner 需 ≥ **v2.327.1**。

## License

MIT
