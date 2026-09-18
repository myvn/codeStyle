# my-code-style Bug 清单

> 整理日期：2026-09-18
> 基线版本：v1.4.0（commit `8fa8bb2`）
> 说明：P0–P2 均为实测复现确认；"已排除"节为验证后证伪的疑似项，无需处理。

## 修复状态（2026-09-18 更新）

本清单中的 P0 / P1 / P2 与文档漂移（BUG-001 ~ 009、DOC-001 ~ 002）已全部修复并补充回归测试；测试基线由 121 项增加到 **132 项（基础 58 / 集成 47 / legacy 27），全绿**。

| 编号          | 修复方式                                                                                  | 回归测试                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| BUG-001 / 002 | `bin/init` 改为按 semver 区间求交集判断可安装的主版本（无新依赖）                         | `init-matrix.test.cjs`「ESLint 版本识别：范围语义」                                              |
| BUG-003       | 先匹配 `stylelint/less(及 less-override)` 再匹配 SCSS 入口，并识别 `postcss-less`         | `init-matrix.test.cjs`「存量 Less stylelint 配置不被误判」                                       |
| BUG-004       | `quotes` 的 `avoidEscape` 改为 `true`（v8 与 flat 共用规则同步）                          | `legacy/eslint8.test.cjs`「引号规则与 Prettier 一致」、`integration/toolchain.test.cjs` 同名用例 |
| BUG-005       | flat 自定义规则块移到 `eslint-config-prettier` 之后；并给 flat 的 nvue 覆写补 `semi: off` | `integration/toolchain.test.cjs`「curly 规则生效并可修复」「nvue 分号例外」                      |
| BUG-006       | `src/eslint/base.cjs` 补与 flat 对等的 `ignorePatterns`                                   | `legacy/eslint8.test.cjs`「忽略构建产物」                                                        |
| BUG-007       | 生成 manifest 时补 `name`（取目录名）/`version`                                           | `init-matrix.test.cjs`「生成的 manifest 含 name 与 version」                                     |
| BUG-008       | `--backup` 备份 `package.json`；备份目录写入 `.gitignore`（幂等）                         | `init-matrix.test.cjs` 两个 `--backup` 用例                                                      |
| BUG-009       | 重写 `toSingular`：修正字符类、区分 `-s`/`-es`、补白名单；`generateScopes` 容忍路径非目录 | `scopes.test.cjs`「复数边界」「源码目录是文件时不抛异常」                                        |
| DOC-001 / 002 | 同步三处实现细节；测试计数更新为 58 / 47 / 27 / 132                                       | —                                                                                                |

已顺带修复的 NIT：NIT-001（补 `LICENSE`、`files` 收录 CHANGELOG）、NIT-003（`require.main` 保护）、NIT-004（husky hook body 改为读取 `src/husky/*`，消除漂移）、NIT-005 中的过期注释、NIT-006（`mock` scope 仅在存在 mock 目录时注入）、NIT-011 中的 `unpackage/`、缩进保留与根配置忽略 `.runtime`。

仍待维护者决策：NIT-002（补全 devDependencies 以便本仓库自测）、NIT-005 的 `@eslint/eslintrc` peerDep 移除、NIT-007/008/009/010/012、`.idea/` 是否继续入库。

---

## 概览

| 严重度                        | 数量  | 编号              |
| ----------------------------- | ----- | ----------------- |
| P0（配错工程 / 初始化错误）   | 3     | BUG-001 ~ BUG-003 |
| P1（规则自相矛盾 / 静默失效） | 3     | BUG-004 ~ BUG-006 |
| P2（CLI 数据安全 / 健壮性）   | 3     | BUG-007 ~ BUG-009 |
| 文档漂移                      | 2 处  | DOC-001 ~ DOC-002 |
| 小毛病 / 优化                 | 12 项 | NIT-001 ~ NIT-012 |
| 已验证排除                    | 5 项  | —                 |

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

### DOC-002 — `demo-test/README.md` 测试计数与覆盖说明过期

- "40/34/17/91 项"已过期，实际为 52/44/25/121（主 README 正确）。
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
| NIT-007 | 无 manifest 空目录默认走 scss（`detectCssPreprocessor` 无 pkg 返回 `"scss"`），会凭空装一堆 stylelint 依赖                                                                                                                                               | `bin/init`                                    |
| NIT-008 | `generateScopes` 在 `src` 是文件时抛 ENOTDIR，直接 crash commitlint；`getStagedFiles` 默认 1MB maxBuffer，大仓库可能取不到暂存区                                                                                                                         | `src/commitlint/scopes.cjs:78` 附近           |
| NIT-009 | monorepo 子包 `workspace:*` + 根 ESLint 8 会误判 flat（installed-version 查找不向上遍历）                                                                                                                                                                | `bin/init:detectEslintVersion`                |
| NIT-010 | peer 范围未覆盖 ESLint 10，但检测逻辑把 10 判为 flat（需验证后放行或明确拒绝）                                                                                                                                                                           | `package.json` peerDeps                       |
| NIT-011 | `.gitignore` 模板缺 `unpackage/`（uni-app 构建产物）；`modifyPackageJson` 全文件重排为 4 空格（2 空格项目被重排）；根 `eslint.config.mjs` 未忽略 `demo-test/.runtime*`；`.idea/` 被提交                                                                  | 多处                                          |
| NIT-012 | nvue 的 prettier 覆写只有 `{parser, semi}`，其余选项依赖磁盘 `.prettierrc`（v8/v9 一致，属潜在隐患）；flat uniapp globals 的 `files` 漏了 jsx/tsx/mjs/cjs 等（`no-undef: off` 下无害）；`import-x/extensions: off` 与 v8 `import/extensions: error` 分叉 | `src/eslint/*`                                |

---

## 已验证排除（无需处理）

1. **"Flat 下显式 prettier 选项被 recommended 覆盖"** —— 不成立。ESLint flat 的 rule 合并规则是"后项仅有 severity 时保留前项 options"（`flat-config-schema.js`），显式选项有效，与 v8 一致。
2. **"v8 顶层 `parser: vue-eslint-parser` 解析不了 `.ts`"** —— 实测规则正常生效，无需改 overrides 限定。
3. **"`.versionrc.cjs` 不被 standard-version 读取"** —— 解包 v9.5.0 确认支持，且 `.cjs` 优先级高于 `.versionrc.js`，存量旧文件不会反压。残留小提示：已存在的 `.versionrc`/`.versionrc.json` 会压过新生成文件，init 碰到时最好 warn 一下。
4. **"`.prettierignore` 二进制名单不全导致 `prettier --write .` 炸"** —— prettier v3 目录模式自动跳过未知后缀，名单只影响显式传参/编辑器场景，可暂缓。
5. **`style/*: off` 引用了没装的插件** —— severity 为 off 的未知规则不会报错（legacy CI 本来就这么过的），只是死代码，可顺手删。
