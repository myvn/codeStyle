// uni-app ESLint config — extends Vue 3, adds uni-app globals and rules
const vue3 = require("./vue3.cjs")

module.exports = {
    ...vue3,
    extends: vue3.extends,
    globals: {
        $t: true,
        uni: true,
        UniApp: true,
        wx: true,
        WechatMiniprogram: true,
        getCurrentPages: true,
        UniHelper: true,
        Page: true,
        App: true,
        NodeJS: true,
    },
    rules: {
        ...vue3.rules,
    },
}