# my-code-style Bug 清单

> 整理日期：2026-09-18
> 基线版本：v1.4.0（commit `8fa8bb2`）
> 说明：P0–P2 均为实测复现确认；"已排除"节为验证后证伪的疑似项，无需处理。

## 修复状态（2026-09-18 更新）

本清单中的 P0 / P1 / P2 与文档漂移（BUG-001 ~ 009、DOC-001 ~ 002）已全部修复并补充回归测试；测试基线由 121 项增加到 **133 项（基础 59 / 集成 47 / legacy 27），全绿**。

第二轮修复（下表 BUG-010 ~ 016）追加 14 项回归测试，测试基线增至 **152 项（基础 70 / 集成 55 / legacy 27），全绿**；已在 Node 18.20.8 / 22.22.3 / 26.9.0 三个运行时实测通过，Flat Config 另在 ESLint 10.10.0 上实测通过。

第三轮修复（BUG-017 ~ 020）追加 16 项回归测试，测试基线增至 **168 项（基础 78 / 集成 55 / legacy 27 / Stylelint 17 共 8），全绿**；新增 `npm run test:stylelint17:setup` 隔离运行时，CI 矩阵增加 Node 24。

第四轮修复（BUG-021 ~ 022）追加 5 项回归测试，测试基线增至 **173 项（基础 79 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**；`release` / `release:push` 增加发布前防呆（`scripts/release-guard.cjs`），发布工作流增加两层 provenance 核验（发布日志自证 + registry 回查）。

第五轮修复（BUG-023）追加 1 项回归测试，测试基线增至 **174 项（基础 80 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**；cz 交互提示默认改为中文，`prompt.types` 与 `type-enum` 完全对齐。

文档补全（DOC-003）追加 1 项回归测试，测试基线增至 **175 项（基础 81 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**；README 新增《用 `pnpm cz` 提交（交互式）》使用手册，init 结尾指引给出入口。

第六轮修复（BUG-024）追加 2 项回归测试，测试基线增至 **177 项（基础 83 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**；init 打印的安装命令对含管道符或 `>=` 的版本范围自动加引号，可整段粘贴执行。

同轮顺带（用户反馈驱动的体验重构，非缺陷）：init 的输出整体步骤化为固定的六步（检测环境 → ESLint 入口 → 配置文件与 hooks → package.json → 依赖体检 → 接下来），`⚠` 只用于真问题、常规写入改用「覆盖/新建」行并给出小计，一键安装与对齐命令标注「可整段粘贴执行」；**dry-run 从「只预览到写入清单」扩展为全流程预览**（含依赖体检与安装命令）。回归见 `init-matrix.test.cjs`「init 输出按六步组织，dry-run 也完整预览依赖体检与下一步」。

同轮体验优化追加 1 项回归测试（六步输出），测试基线增至 **178 项（基础 84 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**。

第七轮修复（BUG-025 / BUG-026）追加 1 项回归测试，并了结 NIT-002、NIT-011 尾巴、把发布工具从 standard-version 迁移到 commit-and-tag-version，测试基线增至 **179 项（基础 85 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**。

第八轮修复（BUG-027）追加 1 项回归测试，并加固集成 runtime 的钉版与源码同步，测试基线增至 **180 项（基础 86 / 集成 59 / legacy 27 / Stylelint 17 共 8），全绿**。

### 第八轮修复：发布后工件复检揪出 npm 安装级 peer 冲突（2026-09-21）

触发场景：1.8.2 发布后的工件级复检——从 npm 实装、用 init 自产命令走完真实用户流程，再把全部 peer 范围与上游 latest 逐一比对，发现 8 个范围不含上游最新大版本，其中一条自相矛盾且 npm 直接拒装。

| 编号    | 严重度 | 问题                                                                                                                                                                                                                                                                                                                           | 修复                                                                                                                                                                                                                                                                        | 回归测试                                                                                   |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| BUG-027 | P1     | 声明 `eslint: ^8.57 \|\| ^9 \|\| ^10` 却声明 `@eslint/js: ^9`——ESLint 10 用户必然装到 @eslint/js 10，1.8.2 实测该组合被 npm **ERESOLVE 直接拒装**（optional peer 照样拦安装）。同族落后：@commitlint 两件套 ^19（上游 21）、eslint-import-resolver-typescript ^3（上游 4）、globals ^16（上游 17）、lint-staged ^16（上游 17） | 每项都先在独立 fixture 里用最新大版本**真装实测**（eslint 10 全家桶跑通 lint 与规则引擎、commitlint 21/20 双向校验、lint-staged 17 完整提交链），通过后才放宽；`commit-and-tag-version`（13 有 writer 回归）与 `typescript`（>7 超出 typescript-eslint 口径）**有意不放宽** | `config-contract.test.cjs`「peer 范围覆盖我们声明支持的上游大版本（校准防回退，BUG-027）」 |

顺带修复（同轮）：

- **`./package.json` 导出**：消费者工具 `require("pkg/package.json")` 读版本此前会抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`（复检中实测发现）；README / TECHNICAL_DOC 导出表补行。
- **集成 runtime 钉版**：peer 校准后联合范围会被 npm 解析到最新大版本，破坏 runtime「最低支持版本」哲学（lint-staged 17 改过报错措辞导致 partial-staging 用例失败）；setup 现把联合范围的包全部钉回下限大版本。
- **测试基建缺陷**：npm 重装 runtime 会剪掉非依赖的 `my-code-style` 源码副本，而同步戳在 node_modules 之外、指纹未变时跳过重拷——「同一指纹下重装」后副本缺失、`require("my-code-style/*")` 全部失败。setup 装完即清同步戳，强制重拷。

校准 fixture 实测记录：eslint 10.11 + @eslint/js 10.0.1 + globals 17 + resolver 4（lint 加载、no-debugger 生效、`--fix` 归零、TS import 解析 ✓）；commitlint 21.2.3 与 20.5.3（合法放行 / 非法拦截 ✓）；lint-staged 17.5.1（prettier 按包配置自动修复 ✓）。

### 第七轮修复：versionrc 静默压优先级 + CHANGELOG 结构修复 + 发布工具迁移（2026-09-21）

触发场景：例行找茬。在一比一复刻用户项目的 fixture 里实测发现 `.versionrc` 陷阱；读 CHANGELOG 发现结构损坏；`npm run lint` 因 NIT-002 的修复而首次真正跑起来，立即抓出 2 个文件 15 处积欠。

| 编号    | 严重度 | 问题                                                                                                                                                                                                                                                                        | 修复                                                                                                                                                       | 回归测试                                                                     |
| ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| BUG-025 | P2     | 发布工具读配置的顺序是 `.versionrc` → `.versionrc.cjs` → `.versionrc.json` → `.versionrc.js`：存量无扩展名 `.versionrc`（或 `.json`）会**静默压过** init 生成的 `.versionrc.cjs`（standard-version 9.5 实测读到旧文件），init 对 `.versionrc.js` 会警告、对这两个却一声不吭 | init 检测到即警告「发布工具会优先读取它，本次生成的 .versionrc.cjs 不会生效；请把配置合并进来或删除旧文件」（`init-flow.md` 此前只写了现象，现在工具闭环） | `init-matrix.test.cjs`「检测到会压过 .versionrc.cjs 的旧配置文件时给出警告」 |
| BUG-026 | P1     | CHANGELOG 第 27 行有一个孤立的 `## [1.5.0]` 标题，后来追加的 1.7.2 / 1.7.1 / 1.7.0 段落全挂在它下面（读者会以为 1.5.0 包含 1.7.x 的变更）；真正的 1.5.0 内容在几十行之外另有一份——同一个版本两个段落、且全部错序                                                            | 删除孤立标题后版本序恢复单调（1.8.1 → 1.8.0 → 1.7.2 → … → 1.2.0，1.5.0 仅一份）；fixture 实测下一段紧随 header 插入、位置正确                              | —（历史数据修复，版本序人工核对）                                            |

顺带了结（同轮）：

- **NIT-002**：`devDependencies` 从 1 个补到 16 个（eslint 9 / typescript / typescript-eslint / prettier / flat base 全套 / commitlint 两件 / husky / lint-staged / czg / commit-and-tag-version，版本全部锚在包自己声明的 peer 范围内）。补完首跑 `npm run lint` 立即抓出 `demo-test/setup-legacy.cjs` 与 `demo-test/legacy/eslint8.test.cjs` 共 15 处 prettier/curly 积欠——正是"lint 从没在本仓跑过"的欠账，已全部修复。
- **NIT-011 尾巴**：`.idea/` 6 个文件移出 git 索引（本地文件保留；目录本就在 `.gitignore` 里，是加忽略之前提交进来的）。
- **NIT-004 关账**：`src/husky/*` 已是 init 实际读取的模板源（`readTemplate`），不再是死模板。

发布工具迁移（非缺陷，弃用依赖清理）：

- `standard-version` 自 2023 年起无人维护，且拖来 q、stringify-package、conventional-changelog-\* 全家桶等 10 个 deprecated 子依赖 → 迁移到社区维护分支 **commit-and-tag-version**，CLI 与 `.versionrc` 配置兼容。
- peer 钉 **`^12.0.0`，不收 13**：13.2.1 的 changelog writer 不应用 preset 的 `types` / `hidden`（fixture 实测：中文分组丢失、本应隐藏的类型也出现在 CHANGELOG，属上游重构回归）；12.7.3 分组与 hidden 均正常。
- 已知外观差异：版本标题由 standard-version 的 `### [x.y.z](compare-url)` 变为 catv 的 `## x.y.z (date)`（上游 preset 模板变化，`linkCompare` / `compareUrlFormat` 配置找不回链接样式，已接受）。
- 同步：`scripts.release` / `release:push`、`bin/init` 注入的脚本与缺失清单、`src/versionrc` 头注释、release-guard 提示措辞、五处文档；integration runtime 经 peerDependencies 自动跟随。
- 回归：`release.test.cjs` 两条发布用例改用 catv 二进制；反证断言改为格式无关（catv 的空段标题样式与 standard-version 不同，但「静默抬版 + 空 CHANGELOG」行为一致，release-guard 仍然必要）。

### 第六轮修复：init 安装命令对 shell 特殊字符加引号（2026-09-20）

触发场景：用户在新项目接入 1.8.0，把 init 输出的一键安装命令原样粘贴进终端——`stylelint` 的联合范围里两个版本段用管道符分隔，shell 把它当成了管道，命令被拦腰截断：前半段装了一部分包，管道符之后的 8 个 stylelint 配套包**全部静默丢失**。

| 编号    | 严重度 | 问题                                                                                                                                                                                                                                                                             | 修复                                                                                                                                                             | 回归测试                                                                                              |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| BUG-024 | P2     | `bin/init` 打印的两条安装命令（缺失清单的一键安装、体检的对齐命令）把 `name@range` 直接拼接：联合范围（两个版本段用管道符分隔）被 shell 当管道截断命令，实测丢掉其后的全部包；`>=` 范围里的 `>` 被 shell 当输出重定向，实测会在项目根创建名为 `=16.0.0` 的垃圾文件并改变安装语义 | 新增 `shellSafeSpec()`：规格含安全字符集（字母数字与 `@ / . _ ^ ~ -`）之外的任何字符时整体包一层双引号；两条命令的每个规格统一走它，输出可直接粘贴 bash/zsh 执行 | `init-matrix.test.cjs` 两个新用例：「一键安装命令对联合范围加引号」「对齐命令对两位数比较范围加引号」 |

| 编号          | 修复方式                                                                                  | 回归测试                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| BUG-001 / 002 | `bin/init` 改为按 semver 区间求交集判断可安装的主版本（无新依赖）                         | `init-matrix.test.cjs`「ESLint 版本识别：范围语义」                                         |
| BUG-003       | 先匹配 `stylelint/less(及 less-override)` 再匹配 SCSS 入口，并识别 `postcss-less`         | `init-matrix.test.cjs`「存量 Less stylelint 配置不被误判」                                  |
| BUG-004       | `quotes` 的 `avoidEscape` 改为 `true`（v8 与 flat 共用规则同步）                          | `legacy/eslint8.test.cjs`「引号规则与 Prettier 一致」、`integration/lint.test.cjs` 同名用例 |
| BUG-005       | flat 自定义规则块移到 `eslint-config-prettier` 之后；并给 flat 的 nvue 覆写补 `semi: off` | `integration/lint.test.cjs`「curly 规则生效并可修复」「nvue 分号例外」                      |
| BUG-006       | `src/eslint/base.cjs` 补与 flat 对等的 `ignorePatterns`                                   | `legacy/eslint8.test.cjs`「忽略构建产物」                                                   |
| BUG-007       | 生成 manifest 时补 `name`（取目录名）/`version`                                           | `init-matrix.test.cjs`「生成的 manifest 含 name 与 version」                                |
| BUG-008       | `--backup` 备份 `package.json`；备份目录写入 `.gitignore`（幂等）                         | `init-matrix.test.cjs` 两个 `--backup` 用例                                                 |
| BUG-009       | 重写 `toSingular`：修正字符类、区分 `-s`/`-es`、补白名单；`generateScopes` 容忍路径非目录 | `scopes.test.cjs`「复数边界」「源码目录是文件时不抛异常」                                   |
| DOC-001 / 002 | 同步三处实现细节；测试计数更新为 58 / 47 / 27 / 132                                       | —                                                                                           |

已顺带修复的 NIT：NIT-001（补 `LICENSE`、`files` 收录 CHANGELOG）、NIT-003（`require.main` 保护）、NIT-004（husky hook body 改为读取 `src/husky/*`，消除漂移）、NIT-005 中的过期注释、NIT-006（`mock` scope 仅在存在 mock 目录时注入）、NIT-011 中的 `unpackage/`、缩进保留与根配置忽略 `.runtime`。

补充发现（初始化链路实测，已修复）：

| 编号    | 问题                                                                                                                                                                                      | 修复                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| NIT-013 | CLI 缺失依赖提示漏掉 `typescript`（`@typescript-eslint/parser` / `typescript-eslint` 的非可选 peer），安装命令与后续步骤硬编码 pnpm，npm 用户看到的是 `pnpm add` 与不可用的 `npm prepare` | 补 `typescript` peer 声明与体检项；按 lockfile/用户代理识别包管理器，输出 `pnpm | npm | yarn | bun`对应命令（npm 用`npm run prepare`）；pnpm 项目追加 `pnpm approve-builds`提示。回归见`init-matrix.test.cjs`「缺失依赖提示包含 typescript，并按包管理器给出可执行命令」 |

### 第三轮修复：peer 声明追上生态 + 依赖版本体检（2026-09-20）

触发场景：一个真实项目（Vue 3 + Vite + pnpm）装完本包后，`pnpm install` 打出一屏 `unmet peer`。逐条核对后确认：**部分是我们声明的版本范围落后于生态，部分是该项目自己的依赖跨批次拼装**，而 pnpm 只 WARN 不报错让问题长期静默。

| 编号    | 严重度 | 问题                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 修复                                                                                                                                                                                                                                                                                                                                                                   | 回归测试                                                                                                                                                               |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-017 | P2     | peer 范围停在写下的那天（2026-07-29）：`stylelint ^16.0.0`、`config-recommended ^17`、`recommended-scss ^16`、`recess-order ^5`。而生态把"支持 stylelint 17"的配置发成了下一个大版本号（`config-recommended 18` / `recommended-scss 17`，2026-01-15），`postcss-html 2` / `stylelint-config-html 2` / `recommended-vue 2` 在 7 月底跟上；`recess-order 7` 还把 `stylelint-order` 从依赖改成了 peer（我们连这个 peer 都没声明）。用户按"装最新"配置必然撞上滞后声明 | 放宽为 `stylelint ^16.24.0 \|\| ^17.0.0`、`config-recommended ^17 \|\| ^18`、`recommended-scss ^16 \|\| ^17`、`recess-order ^5 \|\| ^6 \|\| ^7`，新增可选 peer `stylelint-order ^6 \|\| ^7 \|\| ^8`；下限取 16.24.0（`recommended-scss 16.x` 的 peer 已到 ^16.24.0，写 16.23 会 ERESOLVE）                                                                             | `demo-test/stylelint17/stylelint17.test.cjs` 8 项（真实 stylelint 17 CLI + init 生成的配置：scss/less/混合、`--fix` 幂等、Vue 内嵌样式、`stylelint-order` peer）       |
| BUG-018 | P2     | `init` 只检查"依赖缺没缺"，不检查"装了的版本对不对"。于是 `postcss-html@1.8.1`（我们与 `stylelint-config-html@2` 都要 ^2）、`stylelint 16.26.1` 配 `config-recommended@18`（要 stylelint ^17）、`@typescript-eslint/parser 8.54.0` 配 `typescript-eslint 8.69.0` 这三类问题都不会被发现                                                                                                                                                                            | 新增版本体检 `checkInstalledVersions`：① 我们的 peer 范围 vs 实际安装版本（精确到 minor / patch，`vue-eslint-parser 10.2.0` 不满足 `^10.3.0` 也会被指出）；② 上游配置包自己的 peer（含 `stylelint-order` 这类易漏装的 peer）vs 实际安装；③ `typescript-eslint` 与 `@typescript-eslint/{parser,eslint-plugin}` 主次版本错位。三类都会给出按包管理器可执行的**对齐命令** | `init-matrix.test.cjs` 8 项：「已安装版本低于 peer 范围」「上游配置 peer 冲突」「缺少 stylelint-order」「parser 错位」「两位数主版本不跳过」「版本都匹配时不产生噪音」 |
| BUG-019 | P2     | 体检依赖的 `majorsForRange` 只枚举 0-12 主版本（当年只服务 ESLint 8/9/10），遇到 stylelint 16/17 直接返回 `null` → 整段体检**静默跳过**，等于白做。这个坑是写回归测试时才暴露出来的                                                                                                                                                                                                                                                                                | 新增 `satisfiesRange(range, version)`：用区间相交直接判断，不受主版本位数限制，也保留 minor / patch 精度；`majorsForRange` 行为保持不变（ESLint 版本识别依赖它）                                                                                                                                                                                                       | 同 BUG-018 的「两位数主版本（stylelint 17）不再被静默跳过」「minor 级错位也能发现」「16 线合法组合不误报」                                                             |
| BUG-020 | NIT    | `integration/lint.test.cjs` 用 `JSON.stringify(results)` 作为断言消息。stylelint 17 的 results 带 postcss Lexer 循环引用，`JSON.stringify` 先抛 `Converting circular structure to JSON`，把 3 个用例带崩——**测试自身成了兼容性验证的阻碍**，且这种失败与断言内容无关，极易被误读成"stylelint 17 不兼容"（本轮实测确认）                                                                                                                                            | 改为 `summarize(results)` 只摘出 `source` / `errored` / `warnings[rule,text,line]`，两个大版本都安全                                                                                                                                                                                                                                                                   | 集成套件「Stylelint 检查和修复：scss/less」「统一支持 SCSS、Less 及 Vue 内嵌双预处理」                                                                                 |

顺带调整（非 bug，属"声明范围两端都要有真实运行回归"）：

- 集成套件的隔离运行时**钉住 stylelint 16 线**（`stylelint 16.26.1` + `config-recommended ^17` + `recommended-scss ^16` + `recess-order ^5`），17 线由新增的 `demo-test/.runtime-sl17` 覆盖；此前两边都是"装最新"，等于只测一端。
- 低版本 Node（< 22.12，stylelint 17 生态 engines 下限）上，Stylelint 17 套件**整体跳过并说明原因**（setup 不安装、用例带 skip 标记），不会假装通过。
- CI 矩阵增加 Node 24（此前 18/20/22，24 已进 Active LTS 却未覆盖）。

### 第五轮修复：cz 交互提示中文化 + 类型列表补齐（2026-09-20）

触发场景：在真实项目里用 `pnpm cz` 提交，发现弹出的提示全是英文，且 `pnpm cz` 报 `No files added to staging!` —— 两条都追到了实处。

| 编号    | 严重度 | 问题                                                                                                                                                                                                                          | 修复                                                                                                                                                                          | 回归测试                                                                         |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| BUG-023 | P2     | `rules.type-enum` 允许 15 种提交类型，但 cz 的选择列表只有 14 种：`release` 只写在 type-enum 里，没进 `prompt.types` / `typesAppend`，用户在 `pnpm cz` 里根本选不到它（只能手写或用别名绕过）。两个清单各改各的，迟早继续漂移 | `prompt.types` 重写为与 `type-enum` 完全对应的 15 项（`wip` / `workflow` / `types` 并入列表，不再依赖 `typesAppend`），描述改中文；回归测试断言两个集合相等，任一侧漏项即失败 | `config-contract.test.cjs`「cz 交互提示为中文，且可选类型与 type-enum 一一对应」 |

顺带调整（非 bug，属默认体验）：

- cz-git 的 `prompt.messages` 全套改中文（类型、scope、描述、BREAKING CHANGE、ISSUE、确认提交），scope 列表的两个特殊选项由 `custom` / `empty` 改为「自定义 / 不填」。想改回英文或换成自己的措辞，在项目 `.commitlintrc.cjs` 的 `prompt.messages` 覆盖即可（见 `docs/manual.md` FAQ 15）。
- 提示库硬编码的三处灰字（`(Use arrow keys)`、`(Move up and down to reveal more choices)`、`[N more chars allowed]`）不在配置项里，无法翻译，FAQ 15 中已注明。
- 实测环境：czg 1.13.1（用户项目所用版本）与 1.14.0 均验证中文生效，并用 pty 跑完整条交互直到提交成功。

### 第四轮修复：发布链路防呆（2026-09-20）

触发场景：README《发布（维护者）》把 `npm run release` 与 `npm run release:push` 写成了"依次执行"。

| 编号    | 严重度 | 问题                                                                                                                                                                                                                                                                                                                             | 修复                                                                                                                                                                                                                                                                                                                                                   | 回归测试                                                                                                                                                                                                     |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BUG-021 | P1     | `release` 已经把 tag 打在 HEAD 上，紧接着再跑 `release:push` 时 **standard-version 不报错**，而是把版本号再抬一级、写出一个没有条目的空 CHANGELOG 段，并打出第二个 tag —— 等于多发一个空版本（npm 上不可撤销）。实测（9.5.0，tag 在 HEAD）：`bumping version in package.json from 1.0.0 to 1.0.1` + `### [1.0.1]` 空段，退出码 0 | 新增 `scripts/release-guard.cjs`，作为 `release` / `release:push` 的第一步：三项只读检查（在 git 工作区内、已跟踪文件无未提交改动、HEAD 无 `v*` tag），命中即中止并打印该执行的命令（推 tag 的那条）；未跟踪文件不拦截。README 改为推荐一条命令 `npm run release:push`，并写明两条不能连跑                                                             | `demo-test/integration/release.test.cjs` 三例：干净发布点放行（未跟踪文件不阻断）、已跟踪文件未提交时拦截、HEAD 已有 `v*` tag 时拦截（并反证 standard-version 在同一仓库会抬版并写出空 CHANGELOG）           |
| BUG-022 | P2     | 发布后回查 attestation 的防呆预算只有 30 秒（6 次 × 5 秒），而 registry 回传实测超过 2 分钟——1.7.2 的发布**确实带 provenance**（透明日志签名时间 06:47:57Z，publish 结束于 06:45:49Z），却在 06:46:25Z 被判「缺少 provenance」并标红，把成功的发布误报成失败                                                                     | 核验改成两层：① 发布步骤把 npm 输出落盘并断言 `Signed provenance statement`（真正生成 provenance 时 npm 必定打印，与 registry 延迟无关，libnpmpublish 10/11/12 文案一致），按退出码区分「发布失败」与「发布成功但没带证明」两种消息；② registry 回查给足耐心——前 6 次每 10 秒、之后每 30 秒，共约 5.5 分钟，每次打印 HTTP 状态码，参数可用环境变量覆盖 | `config-contract.test.cjs`「发布工作流保持 provenance 契约」：断言工作流保留 `--provenance`、无 `\|\| npm publish` 静默降级、保留发布日志自证、回查预算 ≥ 300s（把 `--provenance` 临时删掉可看到该用例失败） |

### 第二轮修复：与 ESLint 10 / Flat Config 行为对齐（2026-09-18）

| 编号    | 严重度 | 问题                                                                                                                                                                                                                                                               | 修复                                                                                                                                                                                                            | 回归测试                                                                                                                                        |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-010 | P1     | Flat Config 完全没有 `eslint:recommended`：`tseslint.configs.recommended` 只带 46 条 TS 规则，`no-debugger` / `no-empty` / `no-cond-assign` / `no-constant-condition` / `no-fallthrough` / `no-unsafe-finally` 六个核心规则对 flat 用户静默失效（legacy 正常报错） | `src/eslint/flat/base.mjs` 引入 `@eslint/js` 的 `js.configs.recommended`，插在 `tseslint.configs.recommended` 之前                                                                                              | `integration/lint.test.cjs`「Flat Config 启用 eslint:recommended 核心规则：×6」                                                                 |
| BUG-011 | P1     | Prettier 选项三处硬编码副本（legacy `base.cjs`、legacy `.nvue` 覆写、flat `_shared.mjs`），规则内联 options 是整体替换而非合并，任何一处漏项都会让 `printWidth` / `useTabs` / `htmlWhitespaceSensitivity` 静默回落默认值                                           | 统一以 `src/prettier/index.cjs` 为唯一来源：legacy 与 flat 均 `require`/`import` 后解构；flat 新增 `nvuePrettierRules` 导出                                                                                     | `config-contract.test.cjs`「传统 ESLint 分层以 prettier 配置为唯一来源」、`integration`「Flat Config 与传统配置的 .nvue Prettier 例外完全一致」 |
| BUG-012 | P2     | `bin/init` 只检查项目根 `node_modules/eslint`，monorepo 里依赖被提升安装到工作区根时读不到实际版本，只能退回声明范围                                                                                                                                               | 新增 `findInstalledEslintMajor`：向上最多 8 层查找，仅采纳项目根或带 `package.json` / `pnpm-workspace.yaml` / `lerna.json` 的祖先（`packages/` 这类无 manifest 的中间层不会中断查找，无关上级目录也不会被误用） | `init-matrix.test.cjs`「monorepo 子目录向上读取工作区根已安装的版本」「不越过非工作区祖先目录」                                                 |
| BUG-013 | P2     | 支持的版本口径仍停在 ESLint 8 / 9：ESLint 10 被当成"超出声明范围"打印警告，`peerDependencies` 也不含 `^10`                                                                                                                                                         | 警告阈值改为 `> 10`，错误文案改为"仅支持 ESLint 8 / 9 / 10"，peer 改为 `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`                                                                                                       | `init-matrix.test.cjs`「ESLint 10 视为受支持版本，ESLint 11 才提示尚未声明支持」                                                                |
| BUG-014 | P2     | 无 `package.json` 时无法判断样式方案，却默认按 SCSS 处理，生成 `.stylelintrc.cjs` 并往 lint-staged 注入 stylelint 任务                                                                                                                                             | `detectCssPreprocessor` 无 manifest 时返回 `none`，跳过 stylelint 与相关任务                                                                                                                                    | `tests/init.test.cjs`「no manifest: does not guess a CSS preprocessor」                                                                         |
| BUG-015 | P2     | `src/commitlint/scopes.cjs` 的 `execSync` 未设 `maxBuffer`（默认 1MB），大仓库暂存区一旦超限即 ENOBUFS，scope 猜测整体退化为 `undefined`                                                                                                                           | 两处 `execSync` 统一加 `maxBuffer: 64MB`                                                                                                                                                                        | `scopes.test.cjs`「暂存文件输出超过默认 1MB 缓冲时不再失败」                                                                                    |
| BUG-016 | NIT    | `@eslint/eslintrc` 是无人引用的死 peer（此前已记为 NIT-005 的一部分，未落地）                                                                                                                                                                                      | 从 `peerDependencies` / `peerDependenciesMeta` 移除，peer 数 32 → 31                                                                                                                                            | `config-contract.test.cjs`「peerDependencies 覆盖 ESLint 8/9/10，无残留的 @eslint/eslintrc」                                                    |

本轮有意不动（需维护者权衡，非 bug）：

- `lint-staged@17`（engines node ≥ 22.22.1）与 `@commitlint/cli@21`（node ≥ 22.12.0）等主版本升级会把 Node 门槛抬到 ≥ 22，与当前 CI 矩阵（18 / 20 / 22）冲突，本轮不升。
- `@eslint/js` 的 peer 刻意保持 `^9.0.0`：`@eslint/js@10` 自身要求 Node ≥ 20.19，放宽会让 Node 18 用户装到不兼容版本（已实测 `@eslint/js@9.39.5` 与 ESLint 10 搭配正常）。
- `stylelint@17` 组合此前记为"装不上"，**该结论已作废**（配错了版本线）：支持 stylelint 17 的不是 `stylelint-config-recommended@17`（它确实锁 `stylelint ^16.23.0`），而是 `@18`。正确三元组是 `stylelint 17 ↔ config-recommended 18 ↔ recommended-scss 17`，配合 `postcss-html 2`、`stylelint-config-html 2`、`recommended-vue 2`、`stylelint-order 8` 可完整跑通（见 BUG-017，已实测 + 新增回归）。

初始化链路全过程见 [init-flow.md](init-flow.md)。

仍待维护者决策：NIT-002（补全 devDependencies 以便本仓库自测）、NIT-012 的规则分叉项、`.idea/` 是否继续入库；NIT-005 的 `@eslint/eslintrc` peerDep 已在第二轮移除（BUG-016），NIT-007 / 008 / 009 / 010 分别落地为 BUG-014 / BUG-015 / BUG-012 / BUG-013。

---

## 概览

| 严重度                           | 数量  | 编号              |
| -------------------------------- | ----- | ----------------- |
| P0（配错工程 / 初始化错误）      | 3     | BUG-001 ~ BUG-003 |
| P1（规则自相矛盾 / 静默失效）    | 3     | BUG-004 ~ BUG-006 |
| P2（CLI 数据安全 / 健壮性）      | 3     | BUG-007 ~ BUG-009 |
| 文档漂移                         | 2 处  | DOC-001 ~ DOC-002 |
| 小毛病 / 优化                    | 12 项 | NIT-001 ~ NIT-012 |
| 已验证排除                       | 5 项  | —                 |
| 第二轮 · P1（规则静默失效）      | 2     | BUG-010 ~ BUG-011 |
| 第二轮 · P2（健壮性 / 版本口径） | 4     | BUG-012 ~ BUG-015 |
| 第二轮 · NIT（清理死 peer）      | 1     | BUG-016           |
| 第三轮 · P2（peer 声明滞后生态） | 1     | BUG-017           |
| 第三轮 · P2（体检能力缺口）      | 1     | BUG-018           |
| 第三轮 · P2（静默失效）          | 1     | BUG-019           |
| 第三轮 · NIT（测试自身缺陷）     | 1     | BUG-020           |

---

## P0：会配错工程的

### BUG-001 — `eslint: "<9.0.0"` 被误判为 v9，生成错误的 Flat Config

- **位置**：`bin/init:153-154`（`detectEslintVersion`）
- **现象**：声明 `"<9.0.0"` 的项目，init 输出"检测到 ESLint 版本: 9"，生成 `eslint.config.mjs`。但该范围必然装到 v8，v8 读不了 Flat Config，`npm run lint` 直接失败。
- **复现**：
    ```bash
    mkdir t && cd t
    echo '{"name":"t","devDependencies":{"eslint":"<9.0.0"}}' > package.json
    node /path/to/bin/init   # 生成 eslint.config.mjs（错，应为 .eslintrc.cjs）
    ```
- **根因**：`isMajor9` 用 `/<\s*9/` 排除后落入 fallback `match(/(\d+)/)`，取到首个数字 `9`。凡"只写上限不写 8"的范围（`<9`、`<9.0.0`）全中招。
- **修复建议**：`<9` / `<=8.x` 判 8；长期建议引入 `semver` 判断区间是否与 9 相交，替代正则猜测。
- **状态**：✅ 已修复（semver 区间求交集；回归见 `demo-test/init-matrix.test.cjs`「ESLint 版本识别：范围语义」）

### BUG-002 — `eslint: ">=8.0.0"` 被误判为 v8，生成 legacy `.eslintrc.cjs`

- **位置**：`bin/init:153`（`detectEslintVersion`）
- **现象**：声明 `">=8.0.0"` → 检测为 8 → 生成 `.eslintrc.cjs`。但 npm 实际会装到最新 v9，v9 默认读不了 `.eslintrc.*`。
- **复现**：同 BUG-001，把版本换成 `>=8.0.0`，观察到生成 `.eslintrc.cjs`。
- **根因**：开口向上的范围按"含 8"判 8，而 `*` 却默认走 9，前后矛盾。另外连字符范围 `8.x - 9.x` 也未像 `||` 那样处理，fallback 取首数字判 8，同样错误。
- **修复建议**：无上界范围（`>=8`、`>8`）判 9，与已有 `||` 双版本逻辑一致；连字符范围按 `||` 同等对待。
- **状态**：✅ 已修复（无上界区间优先取 9；连字符区间按区间语义处理）

### BUG-003 — 存量 Less 项目 `.stylelintrc.cjs` 被误判 SCSS 并覆盖

- **位置**：`bin/init:233-234`（`detectCssPreprocessor` 回退分支）
- **现象**：已有 `require("my-code-style/stylelint/less")`、且无 sass/less 依赖的项目，检测为 `scss`，原 Less 配置被覆写成 SCSS 入口，lint-staged 样式分组同步变错。
- **复现**：
    ```bash
    echo '{"name":"t","devDependencies":{"vue":"^3.0.0","eslint":"^9.0.0"}}' > package.json
    printf 'module.exports = require("my-code-style/stylelint/less")\n' > .stylelintrc.cjs
    node /path/to/bin/init   # 检测为 scss，文件被覆写
    ```
- **根因**：`content.includes("my-code-style/stylelint")` 是 Less 入口的子串，Less require 也命中"含 scss"分支。
- **修复建议**：先判断 `my-code-style/stylelint/less`（及 `less-override`），或用带闭合引号的精确匹配。
- **状态**：✅ 已修复（新增「存量 Less stylelint 配置不被误判为 SCSS 并覆盖」用例）

---

## P1：规则自相矛盾 / 静默失效

### BUG-004 — v8 下 `quotes: avoidEscape:false` 与 Prettier 冲突，产生修不掉的报错

- **位置**：`src/eslint/base.cjs:45`
- **现象**：Prettier 会把 `'say "hi"'` 保持单引号（转义最少），而 `quotes: ["error","double",{avoidEscape:false}]` 坚持要双引号。`--fix` 跑多少遍都残留 `Strings must use doublequote`，prettier-clean 的代码永远过不了 lint（ESLint 8.57 + prettier 3 + plugin-prettier 5 + config-prettier 10 实测）。
- **根因**：`rules` 优先级高于 `extends` 中的 `eslint-config-prettier`，`quotes` 在 v8 下实际生效且与 Prettier 转义策略相悖。
- **修复建议**：`avoidEscape` 改 `true`（与 Prettier 一致），或删除 `quotes` 让 Prettier 全权负责；同步修改 README"特性"中对 `avoidEscape: false` 的宣传。
- **状态**：✅ 已修复（`avoidEscape: true`；v8 与 flat 各补一条用例）

### BUG-005 — Flat Config 下 `curly: all` 被静默关闭，v8/v9 行为分叉

- **位置**：`src/eslint/flat/base.mjs:73,97,100`（排序：自定义 rules → recommended → configPrettier）
- **现象**：`if (x) y();`（无大括号）在 flat 下不报警，v8 下报警。`semi/quotes/comma-dangle` 等同样被关，但 Prettier 可兜底；唯独 `curly` 无替代，是真实规则丢失。
- **根因**：`eslint-plugin-prettier/recommended` 与尾部 `eslint-config-prettier` 均含 `curly: off`（已解包 v10 源码确认），且排在自定义 rules 之后（参见 prettier/eslint-config-prettier#341 同类问题）。
- **修复建议**：把自定义 rules 块移到 `eslintConfigPrettier` 之后，或在末尾追加单独重开 `curly` 的配置块。
- **状态**：✅ 已修复（规则块后置，实测 braceless-if 报警且 `--fix` 补全大括号）

### BUG-006 — v8 配置缺 `ignorePatterns`，`npm run lint` 会扫描 `dist/`

- **位置**：`src/eslint/base.cjs`（全文件无 ignore 配置）
- **现象**：flat 版有 `ignores: [dist, coverage, public…]`，v8 版没有；v8 默认只忽略 `node_modules`，构建产物报错会污染 lint 结果。
- **修复建议**：给 `base.cjs` 加与 flat 对等的 `ignorePatterns`。
- **状态**：✅ 已修复（补 `ignorePatterns`，实测 `eslint .` 跳过 `dist/`、`coverage/`、`*.min.js`）

---

## P2：CLI 数据安全 / 健壮性

### BUG-007 — 无 `package.json` 时 init 生成缺 `name` 的非法 manifest

- **位置**：`bin/init` → `modifyPackageJson`
- **现象**：空目录跑 init，生成的 `package.json` 只有 `scripts` + `lint-staged`，无 `name`/`version`，后续 `npm install` 警告甚至失败。
- **复现**：空目录执行 `node /path/to/bin/init`，查看 `package.json`。
- **修复建议**：补 `name: path.basename(PROJECT_ROOT)`，以及 `private: true`、`version: "1.0.0"`。
- **状态**：✅ 已修复（`name` 取目录名、`version` 默认 `1.0.0`）

### BUG-008 — `--backup` 不备份 `package.json`，但 lint-staged 会被整体覆盖

- **位置**：`bin/init` 备份循环（仅覆盖 `files` + `hooks`）
- **现象**：用户自定义的 lint-staged（如 `*.custom` 分组）一跑 init 就被删（现有测试即如此断言），而 `--backup` 救不回它。
- **修复建议**：备份列表加上 `package.json`；备份目录 `.my-code-style-backup/` 自动追加进 `.gitignore`（否则备份会被提交，还会被 `eslint .` 扫到）。
- **状态**：✅ 已修复（备份含 `package.json`，`.my-code-style-backup/` 幂等写入 `.gitignore`）

### BUG-009 — `toSingular` 切烂常用目录名（18 个常见名烂 10 个）

- **位置**：`src/commitlint/scopes.cjs:35-54`
- **现象**（实测）：`interfaces→interfac`、`cases→cas`、`databases→databas`、`devices→devic`、`courses→cours`、`prizes→priz`、`caches→cach`、`houses→hous`、`news→new`、`series→sery`。这些错误 scope 会直接出现在 czg 提交选项里。
- **根因**：① `/[ch|sh]/` 写成字符组（含多余 `|`），`interfaces/devices` 被误切；② `*ses` 结尾不分词干一律去 `es`（`cases→cas`，应为 `case`）；③ `nonPluralEndingInS` 豁免检查排在 `ies/es` 规则之后，`series/news` 到不了豁免。
- **修复建议**：字符组改 `(?:ch|sh)`；仅当词干以 s/x/z/ch/sh 结尾时才去 `es`（`classes→class` ✓，`cases→case` ✓）；豁免名单前移并追加 `news/series` 等。
- **状态**：✅ 已修复（`toSingular` 重写；新增 24 个常见目录名断言 + 路径非目录健壮性用例）

---

## 文档漂移

### DOC-001 — `TECHNICAL_DOC.md` 与实现不一致（3 处）

1. `lint:fix` 写的是 `npm run lint -- --fix`，代码实际生成 `${lintCommand} --fix`（`bin/init:716`）；且用户自定义 `lint` 后两者会脱节。
2. v8 preset 写 `plugin:vue/vue3-essential`，代码实际是 `plugin:vue/essential`（代码是对的，见 demo-test/README 记载的切换原因）。
3. `.nvue sourceType: script`，vue 层代码实际是 `module`（`module` 是对的，否则 nvue 内 `import` 无法通过）。

### DOC-003 — `cz` 命令没有使用手册（只有零散 FAQ）

- **现象**：`pnpm cz` 是本包交付的核心入口之一（init 会自动加 `cz: czg` 脚本、写 `.commitlintrc.cjs` 的 prompt 配置），但文档里只在 README 的常见问题里出现 3 次、manual 的「日常命令」表里占 1 行，**没有任何一处讲清楚怎么用**：六步交互、15 种类型、scope 从哪来、哪些字段能跳过、字符上限怎么算、有哪些省键盘写法（`:别名` / `-r`）。
- **后果**：用户只能在错误的提示信息里反推用法（实测中先撞上 `No files added to staging!`，再撞上 `fix:(修复)…` 的 `type/subject may not be empty`）。
- **修复**：README 新增《用 `pnpm cz` 提交（交互式）》（六步表 + 15 类型表 + 省键盘写法表 + 校验规则）；`docs/manual.md` 对应小节（仓库内文档，指向随包发布的 README；`docs/` 不在 `files` 白名单里）；`docs/project-overview.html` 的「常用脚本」补全 cz 行并说明类型/scope/字符数规则；`docs/init-flow.md` 的 cz 行补「先 `git add`」与入口；`bin/init` 结尾指引加一行（先 `git add` + 指向 README 手册）。
- **回归测试**：`demo-test/init-matrix.test.cjs`「初始化结尾指引把 cz 用法说清楚（先 git add + 指到 README 手册）」。

### DOC-002 — `demo-test/README.md` 测试计数与覆盖说明过期

- "40/34/17/91 项"已过期（主 README 当时为 52/44/25/121）；本次修复后统一更新为 58/47/27/132。
- "尚未覆盖"中 JSX/TSX、ESM standard-version 实际已覆盖。

---

## 小毛病 / 优化项

| 编号    | 内容                                                                                                                                                                                                                                                     | 位置/备注                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| NIT-001 | 缺 `LICENSE` 文件（`package.json` 声明 MIT）；`files` 白名单未收 CHANGELOG                                                                                                                                                                               | 根目录                                        |
| NIT-002 | `devDependencies` 只有 standard-version：新 clone 无法 `npm run lint`，自家 pre-commit 也会因缺依赖挡住贡献者提交                                                                                                                                        | `package.json`                                |
| NIT-003 | `main()` 无 `require.main` 保护，`require("bin/init")` 会直接执行初始化                                                                                                                                                                                  | `bin/init` 末尾                               |
| NIT-004 | `src/husky/*` 是死模板（init 内硬编码了同样内容），早晚漂移                                                                                                                                                                                              | `src/husky/` vs `bin/init`                    |
| NIT-005 | `@eslint/eslintrc` 是死 peerDep；`flat/base.mjs:30` 的 "via FlatCompat" 注释也是 stale 的（根本没用 FlatCompat）                                                                                                                                         | `package.json`、`src/eslint/flat/base.mjs:30` |
| NIT-006 | 生成的 commitlintrc 硬编码 `"mock"` scope，无 mock 目录的项目会出现幽灵选项                                                                                                                                                                              | `bin/init:322`                                |
| NIT-007 | 无 manifest 空目录默认走 scss（`detectCssPreprocessor` 无 pkg 返回 `"scss"`），会凭空装一堆 stylelint 依赖                                                                                                                                               | `bin/init`                                    | **已修复 → BUG-014** |
| NIT-008 | `generateScopes` 在 `src` 是文件时抛 ENOTDIR，直接 crash commitlint；`getStagedFiles` 默认 1MB maxBuffer，大仓库可能取不到暂存区                                                                                                                         | `src/commitlint/scopes.cjs:78` 附近           | **已修复 → BUG-015** |
| NIT-009 | monorepo 子包 `workspace:*` + 根 ESLint 8 会误判 flat（installed-version 查找不向上遍历）                                                                                                                                                                | `bin/init:detectEslintVersion`                | **已修复 → BUG-012** |
| NIT-010 | peer 范围未覆盖 ESLint 10，但检测逻辑把 10 判为 flat（需验证后放行或明确拒绝）                                                                                                                                                                           | `package.json` peerDeps                       | **已修复 → BUG-013** |
| NIT-011 | `.gitignore` 模板缺 `unpackage/`（uni-app 构建产物）；`modifyPackageJson` 全文件重排为 4 空格（2 空格项目被重排）；根 `eslint.config.mjs` 未忽略 `demo-test/.runtime*`；`.idea/` 被提交                                                                  | 多处                                          |
| NIT-012 | nvue 的 prettier 覆写只有 `{parser, semi}`，其余选项依赖磁盘 `.prettierrc`（v8/v9 一致，属潜在隐患）；flat uniapp globals 的 `files` 漏了 jsx/tsx/mjs/cjs 等（`no-undef: off` 下无害）；`import-x/extensions: off` 与 v8 `import/extensions: error` 分叉 | `src/eslint/*`                                |

---

## 已验证排除（无需处理）

1. **"Flat 下显式 prettier 选项被 recommended 覆盖"** —— 不成立。ESLint flat 的 rule 合并规则是"后项仅有 severity 时保留前项 options"（`flat-config-schema.js`），显式选项有效，与 v8 一致。
2. **"v8 顶层 `parser: vue-eslint-parser` 解析不了 `.ts`"** —— 实测规则正常生效，无需改 overrides 限定。
3. **"`.versionrc.cjs` 不被 standard-version 读取"** —— 解包 v9.5.0 确认支持，且 `.cjs` 优先级高于 `.versionrc.js`，存量旧文件不会反压。残留小提示：已存在的 `.versionrc`/`.versionrc.json` 会压过新生成文件，init 碰到时最好 warn 一下。
4. **"`.prettierignore` 二进制名单不全导致 `prettier --write .` 炸"** —— prettier v3 目录模式自动跳过未知后缀，名单只影响显式传参/编辑器场景，可暂缓。
5. **`style/*: off` 引用了没装的插件** —— severity 为 off 的未知规则不会报错（legacy CI 本来就这么过的），只是死代码，可顺手删。
