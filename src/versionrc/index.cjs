// standard-version config
module.exports = {
    header: "## 变更日志\n",
    types: [
        { type: "feat", section: "✨ Features | 新功能" },
        { type: "fix", section: "🐛 Bug Fixes | Bug 修复" },
    ],
    skip: {
        bump: false,
        changelog: false,
        commit: false,
        tag: false,
    },
}
