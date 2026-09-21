// uni-app ESLint Flat Config — extends vue3 flat config, adds uni-app globals

import vue3Config from "./vue3.mjs"
import { uniappGlobals } from "./_shared.mjs"

export default [
    // Spread all Vue 3 configs
    ...vue3Config,

    // Add uni-app globals
    {
        // 覆盖 base 配置的全部语言文件（此前漏了 mjs/cjs/mts/cts/jsx/tsx，NIT-012）
        files: ["**/*.{vue,ts,js,mjs,cjs,mts,cts,jsx,tsx,nvue}"],
        languageOptions: {
            globals: uniappGlobals,
        },
    },
]
