# 初始化链路：这两条命令到底做了什么

```bash
pnpm add -D my-code-style
npx my-code-style-init
```

本文件记录这两条命令的**实际行为**（在 pnpm 12.4.2 / Node 22 / macOS 上逐条实测），用于排查"为什么我的项目里出现/缺少某个文件"。

---

## 一、`pnpm add -D my-code-style`

### 1. 下载与落盘

| 步骤           | 实际结果                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| 取包           | 从 registry 下载 tarball；`npm pack` 25 个文件、约 26 KB                                                          |
| 包内容         | 由 `files` 白名单决定：`src/`、`bin/`、`README.md`、`CHANGELOG.md`，外加 npm 强制包含的 `package.json`、`LICENSE` |
| 运行时依赖     | **零**——`dependencies` 为空，包自身不装任何东西                                                                   |
| 落盘位置       | `node_modules/.pnpm/my-code-style@<version>/` + 顶层软链 `node_modules/my-code-style`                             |
| 可执行链接     | `node_modules/.bin/my-code-style-init` → `bin/init`（`package.json` 的 `bin` 字段）                               |
| 其他写入       | `package.json` 的 `devDependencies`、锁文件                                                                       |
| `prepare` 脚本 | **不执行**（registry/tarball 预构建包不跑 `prepare`，只有 git 依赖才需要本地构建）                                |

### 2. peerDependencies 全部是 optional

32 个 peer 在 `peerDependenciesMeta` 里逐个声明 `optional: true`，因此 **pnpm 一个都不会自动安装**。此时项目里只有一份"配置工厂"，还没有被配置的 ESLint / Prettier / Stylelint 本体。

> 对照：`typescript-eslint` 对 `typescript` 的 peer 是**非可选**的（`>=4.8.4 <6.1.0`），pnpm 会把它自动装到 `.pnpm/typescript@6.x`，顶层 `node_modules` 看不到。这也是 CLI 的缺失依赖提示必须列出 `typescript` 的原因。

---

## 二、`npx my-code-style-init`

`npx` 命中本地 `node_modules/.bin/my-code-style-init`（不联网下载），以 `node bin/init` 执行，**以当前工作目录为项目根**。

### 1. 参数解析与 preflight

- 支持 `--dry-run`、`--backup`、`--version|-v`、`--help|-h`；任何未知参数直接报错退出（`exitCode = 1`）。
- 校验 `package.json`：必须是 JSON 对象，且 `dependencies` / `devDependencies` / `peerDependencies` / `scripts` 必须是"值为字符串的对象"。不合法时**只读退出**，一个文件都不动。

### 2. 检测阶段

| 检测项       | 规则                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint 版本  | ① 已安装的 `node_modules/eslint/package.json` 实际版本优先；② 否则把声明的 semver 区间求交集，判断能装到哪些主版本——同时含 8 和 9（如 `>=8.0.0`、`^8.57.0 \|\| ^9.0.0`）时按 9 处理；③ `<9.0.0` 只能装 8，走 legacy；④ 未声明则"默认最新 (9+) → flat" |
| 项目类型     | `@dcloudio/uni-app`/`uni-app` → uniapp；`vue` → vue；否则 base                                                                                                                                                                                        |
| CSS 预处理器 | sass/less 依赖优先；其次看已有 `.stylelintrc.cjs/.js` 内容（`my-code-style/stylelint/less`、`postcss-less` → less）；非 Vue 项目无样式 → `none`（跳过 stylelint）                                                                                     |
| 包管理器     | lockfile 优先（`pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `package-lock.json`），其次 `npm_config_user_agent`；都判断不出时按 pnpm 输出提示                                                                                                       |

### 3. 冲突拦截（只读退出）

- `eslint` 声明版本 < 8 → 拒绝；
- 版本与已有配置格式冲突（v9 + 仅 `.eslintrc.*`，或 v8 + `eslint.config.*`）→ 拒绝；
- 检测到 legacy 配置但无法确定版本 → 要求先声明版本或迁移。

### 4. 生成清单

| 文件                                     | 说明                                                          |
| ---------------------------------------- | ------------------------------------------------------------- |
| `eslint.config.mjs` 或 `.eslintrc.cjs`   | 二选一；若已存在任一格式的配置则**保留已有、不生成入口**      |
| `.prettierrc.cjs`、`.prettierignore`     | 指向 `my-code-style/prettier`                                 |
| `.stylelintrc.cjs`                       | 仅当 CSS 预处理器非 `none`                                    |
| `.commitlintrc.cjs`                      | 动态 scope（`generateScopes("src")` + `guessCurrentScope()`） |
| `.versionrc.js` / `.versionrc.cjs`       | ESM 项目（`type: module`）用 `.cjs`                           |
| `.editorconfig`、`.gitattributes`        | 模板文件                                                      |
| `.gitignore`                             | **仅当不存在时创建**                                          |
| `.husky/commit-msg`、`.husky/pre-commit` | 内容取自 `src/husky/*`，写入后 `chmod 755`                    |

**已存在的文件一律覆盖**（除 ESLint 入口与 `.gitignore`）——这就是 `--dry-run` / `--backup` 存在的理由。

### 5. 写入与回滚

1. 先对全部目标文件做内存快照；
2. 写入配置与 hooks；
3. 修改 `package.json`：
    - `scripts` **合并**（用户已有的同名脚本不被覆盖）；
    - 缺失的 `name`（取目录名并规范化）/`version` 自动补齐；
    - `lint-staged` **整体替换**（避免残留失效分组）；
    - 保留原文件的缩进风格（2 空格项目不会被重排成 4 空格）；
4. `--backup` 时：把将被覆盖的文件（含 `package.json`）复制到 `.my-code-style-backup/`，并把该目录追加进 `.gitignore`（幂等）；
5. 任一步抛错 → 按快照回滚全部文件、hooks 与 `package.json`，并删除本次新建的空 `.husky/`。

### 6. 收尾

比对 `peerDependencies` 与项目实际依赖，先做**版本体检**再列缺失项。体检查三类：① 已安装版本是否落在本包声明的 peer 范围内（精确到 minor / patch）；② 上游配置包自己的 peer 是否被满足（例如 `stylelint-config-recommended@18` 要求 `stylelint ^17`、`recess-order 7` 需要 `stylelint-order`）；③ `typescript-eslint` 与 `@typescript-eslint/parser`、`@typescript-eslint/eslint-plugin` 是否同一版本。命中时逐条打印原因，并给出一条可复制的**对齐命令**（`pnpm add -D …` / `npm i -D …`），也可以选择把上游配置包降到与现有版本匹配的大版本。

然后列出缺失项并给出一条**按当前包管理器生成**的安装命令（`pnpm add -D` / `npm i -D` / `yarn add -D` / `bun add -d`），随后打印下一步（安装 peer → 初始化 husky → `cz` 提交）。pnpm 项目额外提示 `pnpm approve-builds`（pnpm 10+ 默认拦截依赖构建脚本，如 `unrs-resolver`）。

---

## 三、初始化之后（三个必要动作）

| 动作                                       | 说明                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 安装 peerDependencies                      | 按 CLI 输出的命令执行。**不要漏掉 `typescript`**，它是 `@typescript-eslint/parser` / `typescript-eslint` 的非可选 peer                                                                                                          |
| `pnpm prepare`（npm 用 `npm run prepare`） | husky 把 `git config core.hooksPath` 设为 `.husky/_`。**必须在 git 仓库内执行**，否则只输出 `.git can't be found` 且不生效                                                                                                      |
| `pnpm cz` / `git commit`                   | commit-msg 走 commitlint，pre-commit 走 lint-staged（按文件分组串行 `prettier --write` → `eslint --fix` → `stylelint --fix`）。`pnpm cz` 由暂存区驱动，**先 `git add`**；六步交互与 15 种类型见本包 README《用 `pnpm cz` 提交》 |

---

## 四、常见坑

1. **`.husky/*` 存在不等于 hook 生效**：需要 `husky` 初始化过且目录位于 git 仓库根。
2. **重复运行 init**：ESLint 入口会保留，但 `.prettierrc.cjs`、hooks 等会被重新覆盖——用 `--dry-run` 预览，用 `--backup` 留档。
3. **pnpm 10+ 的 `ERR_PNPM_IGNORED_BUILDS`**：安装 peer 时可能出现（`unrs-resolver` 等需要构建许可），执行 `pnpm approve-builds` 后重装即可，不是初始化失败。
4. **`eslint` 声明为开口区间**（如 `>=8.0.0`）：npm 实际会装 9，所以 CLI 按 flat 生成；若确实要留在 8，请把范围收紧到 `<9`。
5. **`init` 会改写 `package.json`**：`lint-staged` 是整体替换，自定义分组请提前备份（`--backup` 已包含 `package.json`）。
6. **`.versionrc` / `.versionrc.json`**：已存在的这两个文件会被 standard-version 优先读取（`.cjs`/`.js` 优先级更低），init 不会删除它们。

---

## 五、相关实现与测试

| 位置                                                                                                                                                                                  | 内容                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bin/init`                                                                                                                                                                            | CLI 本体（检测、生成、回滚、peer 体检）                                                        |
| `src/prettier/index.cjs` 等                                                                                                                                                           | 生成文件里 `require("my-code-style/...")` 指向的真实配置                                       |
| `src/husky/*`                                                                                                                                                                         | hook 模板，CLI 直接读取，避免内容漂移                                                          |
| `demo-test/init-matrix.test.cjs`                                                                                                                                                      | 检测矩阵、包管理器提示、`--backup`、回滚                                                       |
| `demo-test/integration/*.test.cjs`（23 个文件：lint / commit-chain-* / empty-commit-guard / error-recovery* / embedded-style* / partial-staging* / git-edge-* / git-mv-rm / release） | Flat Config 真实运行、提交链与 Git 边界；`_runtime.cjs` 负责加锁同步隔离环境源码并惰性加载依赖 |
| `demo-test/legacy/eslint8.test.cjs`                                                                                                                                                   | ESLint 8 传统格式真实运行                                                                      |

实测命令记录见本文件；如需复现，可在空目录执行 `npx my-code-style-init --dry-run` 观察检测结果。
