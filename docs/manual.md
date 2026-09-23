# my-code-style 使用说明书

> 面向两类读者：**正在决定要不要接入的人**（第一~~三章），和**已经接入、正在用的人**（第四~~六章）。
> 文中的数字都来自隔离环境实测（pnpm 12.4.2 / Node 22 / macOS），复现方式见 [init-flow.md](init-flow.md)。

---

## 一、使用后的优点

一句话：接入前，代码格式、质量红线、提交信息、版本号是**每个人的个人习惯**；接入后，它们变成**仓库本身的属性**——写进配置文件、由 Git hooks 强制执行，任何人在任何机器、任何编辑器里得到同样的结果。

| 维度            | 接入前                                          | 接入后                                                          |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| 代码格式        | 各自编辑器配置，PR 里混入大量空格/引号/换行差异 | 全仓库统一：4 空格、无分号、双引号、行宽 100，Prettier 一次写死 |
| 检查入口        | 各人自己敲命令，标准不一                        | `pnpm lint` / `pnpm lint:fix` 一条命令，规则来自共享配置        |
| 提交闸门        | 靠自觉，问题在 CI 或评审时才发现                | pre-commit 自动修复暂存文件，**修不好的直接挡下提交**           |
| 提交信息        | 自由文本，历史无法机器解析                      | conventional commits 强校验（type/scope/subject/长度）          |
| 版本与日志      | 手工改版本号、手工写 CHANGELOG                  | `pnpm release` 依据 commit 类型自动推版本、生成 CHANGELOG       |
| CSS/样式        | 基本没人管（缺 stylelint）                      | SCSS/Less/Vue 内嵌样式一并检查与排序                            |
| 编辑器/系统差异 | 换行符、缩进、编码各自为政                      | `.editorconfig` + `.gitattributes` 钉死 EOL 与二进制标记        |
| 规则升级        | 每个项目各抄一份，改一处要改 N 处               | 升级一个依赖版本，全项目规则同步                                |
| 新人上手        | 靠口头传达"我们项目这么写"                      | 规则即文档，`pnpm cz` 引导提交，`lint-staged` 当场纠错          |

---

## 二、带来的福利、解决的问题

| 过去的问题         | 具体表现                                              | 接入后                                                                |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------- |
| 格式争论与评审噪音 | 评审里一半是空格、引号、分号                          | 交给工具，评审只谈逻辑                                                |
| "我这边好好的"     | 本地过、CI 挂；或反过来                               | 同一套规则 + 同一份配置，结果可复现                                   |
| 提交信息杂乱       | `update`、`fix bug`、`修改` 满天飞                    | commitlint 拦截；`pnpm cz` 交互式生成规范信息                         |
| CHANGELOG 靠人写   | 要么漏写，要么事后考古                                | `commit-and-tag-version` 按 feat/fix/perf 自动生成                    |
| scope 靠记忆       | 提交时不知道该填什么模块                              | 自动列出 `src/` 下的目录并**按暂存文件猜当前模块**                    |
| 样式代码无人管     | 非法属性、未知单位、选择器乱序                        | stylelint 接管，且已放行 uni-app 的 `rpx`/`page`/`::v-deep`           |
| 老项目升级无路     | 项目停在 ESLint 8，新项目用 9，配置分裂               | 同一份包同时支持 `.eslintrc.cjs`（v8）与 Flat Config（v9）            |
| 新项目从零配置     | 每次都要拼 ESLint+Prettier+Stylelint+husky+commitlint | `init` 一键生成 11 个文件 + 6 个脚本，可 `--dry-run` 预览             |
| 配置写错没人发现   | 规则冲突（如 `quotes` 与 Prettier 打架）长期潜伏      | 有 194 项自动化回归（含 ESLint 8/9/10、Stylelint 16/17 真实运行）守护 |
| 团队规范落不了地   | 文档写了没人看                                        | hook 在提交那一刻执行，默认路径就是正确路径                           |

---

## 三、量化收益与代价

| 项目           | 实测                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| 一次性初始化   | 约 300 ms（可 `--dry-run` 预览、`--backup` 留档、失败自动回滚）                                                   |
| 每次提交开销   | 空提交 6 ms → 带 hooks 约 **2.6 s**（2 个文件；文件越多越久）                                                     |
| 依赖体积       | devDependencies 增至 27 项；pnpm 虚拟 store 约 **512 个包 / 132 MB** `node_modules`（硬链接，实际磁盘占用小得多） |
| 需要接受的意见 | 4 空格缩进、无分号、双引号、conventional commits、行宽 100                                                        |

**边界（必须知道）**：

- hooks 是**软约束**：`git commit --no-verify` 可绕过，**CI 里仍需自行执行 `pnpm lint`**；
- 不做类型检查（`typescript-eslint` 为语法级，无 typed linting）、不跑测试、不碰业务代码、不替你安装 peer；
- 收益最大的是多人/多仓库团队、长期维护项目、Vue 3 / uni-app 工程；单人一次性脚本不值得付 132 MB 与每次提交 2.6 s 的成本。

---

## 四、怎么使用

### 前置条件

- Node ≥ 18；项目有合法 `package.json`；**已 `git init`**（husky 需要 git 仓库，否则 hook 不生效）。

### 接入四步

```bash
# 1. 安装配置包
pnpm add -D my-code-style            # npm: npm i -D my-code-style

# 2. 预览再初始化（init 会覆盖已存在的 .prettierrc.cjs / hooks 等）
npx my-code-style-init --dry-run
npx my-code-style-init                # 需要保留旧文件时加 --backup

# 3. 按 CLI 输出的缺失依赖清单安装 peer（会按你的包管理器生成命令，别漏 typescript）
pnpm add -D my-code-style \
  eslint@^9.0.0 typescript@^5.0.0 prettier@^3.0.0 ...   # 以 CLI 实际输出为准

# 4. 初始化 hooks 并首次检查
pnpm prepare                          # npm: npm run prepare；yarn: yarn prepare
pnpm lint
```

初始化前后可以对照 [init-flow.md](init-flow.md) 确认每一步的产出与覆盖范围。

### 日常命令

| 命令                          | 作用                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `pnpm lint` / `pnpm lint:fix` | 全量检查 / 自动修复                                     |
| `pnpm format`                 | Prettier 重写项目文件                                   |
| `pnpm cz`                     | 交互式生成规范提交信息（用法见下节）                    |
| `pnpm release`                | 生成版本号、CHANGELOG、提交与 tag（不等于 npm publish） |
| `git commit`                  | pre-commit 自动修复暂存文件，commit-msg 校验信息        |

### 用 `pnpm cz` 提交（交互式）

`pnpm cz` 就是 `czg`，**暂存区驱动**：先 `git add`，再跑命令；暂存区为空会直接报 `No files added to staging!` 退出（`--all` / `-a` 也不绕过）。

```bash
git add -A && pnpm cz
```

六步交互：**类型 → scope → 一句话描述 → 详细描述（可跳过）→ BREAKING CHANGE（可跳过）→ 关联 ISSUE（可跳过）→ 预览确认**。

- **类型**：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert` / `wip` / `workflow` / `types` / `release` 共 15 种，中文含义见 [README 的类型表](../README.md)。选择列表与 commitlint 的 `type-enum` 由回归测试保证一一对应，不会出现"规则允许但选不到"。
- **scope**：候选来自 `src/` 下的目录（自动转单数，如 `components` → `component`），默认值按**暂存文件**推断（改了 `src/api/` 默认就是 `api`）；可选「自定义」手填或「不填」跳过。
- **描述框右侧的字符数**是"还能写多少"，上限 = commitlint 的 `header-max-length`（108）减去 `类型(scope): ` 前缀，所以填完类型与 scope 后才是最终可用长度。
- **省键盘**：`pnpm cz :f`（预置别名直提：f/r/s/b/c）、`pnpm cz -r`（重放上一条消息）、`pnpm cz --help`（`emoji` / `break` / `ai` / `gpg` / `checkbox` 等模式，默认都不开启）。
- **校验与兜底**：提交时 `commit-msg` 钩子校验 type 是否在列、描述是否为空、标题是否超长；`Merge …` / `Revert …` 消息自动忽略；不想用交互也可 `git commit -m "feat(api): 说明"`（**冒号后要有空格**）。
- **换语言/措辞**：见 FAQ 15；**报错排查**：FAQ 8（冒号后的空格）与 FAQ 14（未暂存）。

### 不通过 init 的手动接入

```js
// eslint.config.mjs（Vue 3）
import vue3Config from "my-code-style/eslint/flat/vue3"
export default [...vue3Config, { rules: { "no-console": "warn" } }]
```

`.prettierrc.cjs` → `module.exports = require("my-code-style/prettier")`；样式 `.stylelintrc.cjs` → `require("my-code-style/stylelint")`（Less 用 `/less`）；提交与版本同理指向 `my-code-style/commitlint`、`my-code-style/versionrc`。自定义规则**放在数组后面**，否则会被共享配置覆盖。

### 升级

```bash
pnpm up -D my-code-style     # 规则与生成模板随包升级
npx my-code-style-init --dry-run   # 需要同步模板时先预览
```

CLI 生成的文件不会自动更新，升级后建议对已接入项目重跑 `--dry-run` 比对差异。

---

## 五、使用中遇到的问题（FAQ）

### 1. 只装了 `my-code-style`，`pnpm lint` 报找不到 eslint

peerDependencies 全部标了 optional，pnpm 不会自动安装。按 CLI 结尾输出的清单装全（**包括 `typescript`**，它是 `@typescript-eslint/parser` / `typescript-eslint` 的必需 peer，漏装会导致解析器起不来）。

### 2. `pnpm prepare` 输出 `.git can't be found`，hooks 不生效

husky 必须在 git 仓库内执行。先 `git init`，再 `pnpm prepare`；验证：`git config core.hooksPath` 应输出 `.husky/_`。

### 3. 装依赖时报 `ERR_PNPM_IGNORED_BUILDS`（如 `unrs-resolver`）

pnpm 10+ 默认拦截依赖的构建脚本，不是初始化失败。执行 `pnpm approve-builds` 选择允许后重新安装。

### 4. `eslint` 声明成 `>=8.0.0` 却生成了 Flat Config，v8 项目读不了

无上界的范围（`>=8`、`^8 || ^9`）npm 实际会装到 9，CLI 因此按 Flat Config 生成。若确定留在 8，请把范围收紧到 `<9`（如 `~8.57.0`），重跑 init。

### 5. 重复执行 init 后，我改过的 `.prettierrc.cjs` / hooks 被覆盖了

设计如此：除 ESLint 入口与已存在的 `.gitignore` 外，目标文件一律覆盖。请用 `--dry-run` 先看清单，用 `--backup` 留档（备份目录 `.my-code-style-backup/` 内含 `package.json`，并会自动写入 `.gitignore`）。

### 6. 我自定义的 `lint-staged` 分组消失了

`lint-staged` 是**整体替换**（避免残留失效分组），自定义分组需从备份恢复后手动合并。

### 7. 提交时提示 lint 错误、提交失败

- 能自动修的（格式、可修规则）lint-staged 会改文件并重新加入本次提交，再看一次 `git status` 即可；
- 修不了的（语法错误、非法 CSS 属性、重复属性）会阻止提交，需手动改；
- 紧急绕过用 `git commit --no-verify`，但**请在 CI 用 `pnpm lint` 兜底**，否则规范形同虚设。

### 8. commit message 被拒：`type may not be empty` / `subject may not be empty`

提交信息必须符合 conventional commits（`feat(scope): 描述`），注意**冒号后必须有空格**：`fix:(修复)Merge …` 这种写法会让 commitlint 切不出类型与描述，于是同时报 `type-empty` 与 `subject-empty`（**两条错误其实是同一个原因**）。

```bash
git commit -m "fix: 合入 codeStyle 配置（Merge branch 'arena/01a0b214-codestyle'）"   # ✔
git commit -m "fix:(修复)Merge branch 'arena/01a0b214-codestyle'"                      # ✖（冒号后没空格）
```

用 `pnpm cz` 交互式生成最稳；header 上限 108 字符。另外 `git merge` 自动生成的 `Merge branch '…'` 消息会被 commitlint 内置忽略，所以合并分支不用手写消息。

### 9. stylelint 提示 `rpx` 单位 / `page` 选择器未知

本包已在小程序场景放行这些单位与标签；若仍报错，通常是项目装了另一份 stylelint 配置或自行覆盖了 `unit-no-unknown`。

### 10. 提交后却看到"文件被修改过"

lint-staged 在提交前自动修复并**重新暂存**了内容，属于预期行为；工作区与索引是一致的。

### 11. 老项目已有 `.eslintrc.*`，init 直接拒绝执行

当 ESLint 版本与配置格式冲突（v9 + 仅 legacy 配置，或 v8 + flat 配置）时，CLI 会**只读退出**，要求先迁移或明确版本。若确有旧配置想保留，确认版本后再重跑。

### 12. `pnpm release` 生成了版本提交与 tag，但我想发布到 npm

`release` 只负责版本、CHANGELOG、提交与 tag；发布需另执行 `npm publish`。

### 13. 装完之后 pnpm 打了一屏 `unmet peer` 警告，要不要处理

先分清是谁在报：

- `unmet peer … from my-code-style`：是我们声明的版本范围没覆盖你装的版本，**先升级本包**（新版会放宽范围）；升级后仍报就是真不兼容，按提示对齐；
- 来自别的包（例如 `postcss-html@1.8.1` 却要 `^2.0.0`、`stylelint@16.26.1` 却要 `^17.0.0`）：**按提示对齐**。npm 遇到这种情况会直接 `ERESOLVE` 拒装，pnpm 只打印 WARN 就装完，所以“装上了”不代表能跑。

重跑一次 `init` 可以主动体检：它会检查「已安装版本是否落在声明范围内（精确到 minor，`10.2.0` 不满足 `^10.3.0` 也会被指出）」「上游配置文件自己的 peer 是否满足（含 `stylelint-order` 这类容易漏装的 peer）」「`typescript-eslint` 与 `@typescript-eslint/parser`、`eslint-plugin` 是否同一版本」，并给出按包管理器可执行的**对齐命令**。

### 14. `pnpm cz` 报 `No files added to staging! Did you forget to run `git add` ?`

czg 是**暂存区驱动**的：暂存区为空就直接退出（退出码 1），`czg --all` / `czg -a` 都不绕过这个检查——这是 commitizen 家族的既有行为，不是配置问题。

```bash
git add -A        # 或 git add <改动文件>
pnpm cz
```

先 `git add` 不只是"让它肯启动"：我们的 `.commitlintrc.cjs` 里 `guessCurrentScope()` 读暂存区推断 scope 默认值，`generateScopes("src")` 提供候选列表，所以暂存之后弹出的 scope 才是对的。

### 15. `pnpm cz` 的提示能改成中文吗（或改回英文）

可以，提示语是 cz-git 的 `prompt.messages`，本包**默认就是中文**（类型描述、scope、描述输入、BREAKING CHANGE、确认提交等全部中文；scope 列表里的两个特殊选项显示为「自定义 / 不填」）。想换语言或措辞，在你项目的 `.commitlintrc.cjs` 里覆盖即可（`...base.prompt` 之后写自己的值）：

```js
module.exports = {
    ...base,
    prompt: {
        ...base.prompt,
        messages: { type: "Select the type of change:" /* … */ },
        types: [{ value: "feat", name: "feat:     A new feature", emoji: ":sparkles:" }],
    },
}
```

两类东西**改不了**：`(Use arrow keys)`、`(Move up and down to reveal more choices)`、`[103 more chars allowed]` 这类灰色小字由 czg 内置的提示库硬编码，不在配置项里。

### 16. `stylelint` 用 16 还是 17

两条线都支持，我们声明的范围是 `stylelint ^16.24.0 || ^17.0.0`：

| 线    | 需要的配套                                                                                          | 适用                 |
| ----- | --------------------------------------------------------------------------------------------------- | -------------------- |
| 16 线 | `stylelint-config-recommended@17`、`recommended-scss@16`、`recess-order@5/6`                        | 存量项目、Node 18/20 |
| 17 线 | `stylelint@17`、`config-recommended@18`、`recommended-scss@17`、`stylelint-order@7/8`、Node ≥ 22.12 | 新项目、Node 22.12+  |

混淆点在于**版本号是错位的**：支持 stylelint 17 的配置不是 `stylelint-config-recommended@17`（它的 peer 还锁 `stylelint ^16.23.0`），而是 `@18`。两条线都有真实运行回归：集成套件跑 16 线（`demo-test/setup-integration.cjs` 固定），Stylelint 17 套件跑 17 线（`demo-test/stylelint17/`）。

---

## 六、它不做什么

- 不做类型检查、不跑测试、不做代码审查；
- 不改业务代码，除 lint-staged 的自动修复外不会重写你的文件；
- 不管理远程仓库、不自动发布；
- 不保证 `--no-verify` 之外还能挡住所有不合规提交（CI 是最后一道闸门）。

---

## 七、相关文档

| 文档                                           | 内容                                               |
| ---------------------------------------------- | -------------------------------------------------- |
| [README.md](../README.md)                      | 快速开始、脚本、常见问题速查                       |
| [init-flow.md](init-flow.md)                   | 两条命令的逐步行为、检测规则、回滚与备份语义       |
| [TECHNICAL_DOC.md](../TECHNICAL_DOC.md)        | 配置分层、导出入口、规则细节                       |
| [project-overview.html](project-overview.html) | 单文件技术全景（含使用价值章节），可离线阅读与打印 |
| [bug-list.md](bug-list.md)                     | 历次审计发现与修复记录                             |
