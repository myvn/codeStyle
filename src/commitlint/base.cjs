// Commitlint base config (without project-specific dynamic scopes)
module.exports = {
    extends: ["@commitlint/config-conventional"],
    rules: {
        "body-leading-blank": [2, "always"],
        "footer-leading-blank": [1, "always"],
        "header-max-length": [2, "always", 108],
        "subject-empty": [2, "never"],
        "type-empty": [2, "never"],
        "subject-case": [0],
        "type-enum": [
            2,
            "always",
            [
                "feat",
                "fix",
                "perf",
                "style",
                "docs",
                "test",
                "refactor",
                "build",
                "ci",
                "chore",
                "revert",
                "wip",
                "workflow",
                "types",
                "release",
            ],
        ],
    },
    prompt: {
        alias: {
            f: "docs: fix typos",
            r: "docs: update README",
            s: "style: update code format",
            b: "build: bump dependencies",
            c: "chore: update config",
        },
        // czg 的交互提示（cz-git 的 prompt.messages）。默认中文，因为本包其余输出都是中文；
        // 想改回英文或换成自己的措辞，在你项目的 .commitlintrc.cjs 里覆盖 prompt.messages 即可。
        messages: {
            type: "选择你要提交的变更类型：",
            scope: "选择一个 SCOPE（可选，回车跳过）：",
            customScope: "输入自定义 SCOPE：",
            subject: "用一句话描述这次变更（祈使句）：\n",
            body: '补充详细描述（可选）。用 "|" 换行：\n',
            markBreaking: '是否包含 BREAKING CHANGE（标题加 "!"）（可选）？',
            breaking: '列出 BREAKING CHANGE（可选）。用 "|" 换行：\n',
            footerPrefixesSelect: "选择 ISSUES 类型（可选）：",
            customFooterPrefix: "输入 ISSUES 前缀：",
            footer: "列出受影响的 ISSUE，例如 #31、#34：\n",
            generatingByAI: "正在用 AI 生成描述…",
            generatedSelectByAI: "从 AI 生成的描述里选一个：",
            confirmCommit: "确认按上面的信息提交吗？",
        },
        // scope 列表里的两个特殊选项（默认是英文 custom / empty）
        customScopesAlias: "自定义",
        emptyScopesAlias: "不填",
        // 与 rules.type-enum 一一对应：type-enum 有的这里都要能选到，反之亦然
        // （此前 release 只写在 type-enum 里，czg 的选择列表里没有它；见回归测试）。
        types: [
            { value: "feat", name: "feat:     新功能", emoji: ":sparkles:" },
            { value: "fix", name: "fix:      修复缺陷", emoji: ":bug:" },
            { value: "docs", name: "docs:     仅文档变更", emoji: ":memo:" },
            { value: "style", name: "style:    不影响代码含义的格式调整", emoji: ":lipstick:" },
            {
                value: "refactor",
                name: "refactor: 既非修复缺陷也非新增功能的代码调整",
                emoji: ":recycle:",
            },
            { value: "perf", name: "perf:     性能优化", emoji: ":zap:" },
            { value: "test", name: "test:     补测试或修正既有测试", emoji: ":white_check_mark:" },
            {
                value: "build",
                name: "build:    影响构建系统或外部依赖的变更",
                emoji: ":package:",
            },
            { value: "ci", name: "ci:       CI 配置与脚本变更", emoji: ":ferris_wheel:" },
            { value: "chore", name: "chore:    其他不涉及 src 与测试的杂项", emoji: ":hammer:" },
            { value: "revert", name: "revert:   回滚此前的提交", emoji: ":rewind:" },
            { value: "wip", name: "wip:      开发中（临时提交）", emoji: ":construction:" },
            { value: "workflow", name: "workflow: 工作流改进", emoji: ":gear:" },
            { value: "types", name: "types:    类型定义文件变更", emoji: ":label:" },
            {
                value: "release",
                name: "release:  发布相关（版本号 / 变更日志）",
                emoji: ":bookmark:",
            },
        ],
    },
}
