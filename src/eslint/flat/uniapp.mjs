// uni-app ESLint Flat Config — extends vue3 flat config, adds uni-app globals

import vue3Config from "./vue3.mjs"
import { uniappGlobals } from "./_shared.mjs"

export default [
    // Spread all Vue 3 configs
    ...vue3Config,

    // Add uni-app globals
    {
        files: ["**/*.{vue,ts,js,nvue}"],
        languageOptions: {
            globals: uniappGlobals,
        },
    },
]
