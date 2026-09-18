const { test } = require("node:test")
const assert = require("node:assert/strict")
const { commitProject } = require("./_runtime.cjs")

const style = "scss"

test(`完整提交链：JS/TS/Vue/nvue/CSS/${style} 自动修复及二次复检`, (t) => {
    const p = commitProject(t, style)
    const samples = {
        "src/中文 空格/demo file.js": "const value='hello';console.log(value);\n",
        "src/demo.ts": "const count:number=1;console.log(count);\n",
        "src/Demo.vue":
            '<template><view>Hello</view></template><script setup lang="ts">const count:number=1;console.log(count);</script><style>.demo{color:red;}</style>',
        "src/pages/Demo.nvue":
            '<template><view>Hello</view></template><script setup lang="ts">uni.showToast({title:"Hello"});</script><style>.demo{color:red;}</style>',
        "src/styles/main.css": ".demo{color:red;}\n",
        ...(style === "both"
            ? {
                  "src/styles/main.scss": "$color:red;.demo{color:$color;}\n",
                  "src/styles/main.less": "@color:red;.demo{color:@color;}\n",
                  "src/Mixed.vue":
                      '<template><view /></template><style lang="scss">$c:red;.s{color:$c;}</style><style lang="less">@c:blue;.l{color:@c;}</style>',
              }
            : {
                  [`src/styles/main.${style}`]:
                      style === "less"
                          ? "@color:red;.demo{color:@color;}\n"
                          : "$color:red;.demo{color:$color;}\n",
              }),
    }
    for (const [name, content] of Object.entries(samples)) p.write(name, content)
    p.git("add", "--", "src")
    const result = p.commit()
    assert.equal(result.status, 0, result.stdout + result.stderr)
    for (const [name, original] of Object.entries(samples)) {
        const committed = p.git("show", `HEAD:${name}`)
        assert.notEqual(committed, original, `${name} must actually be formatted`)
        assert.equal(p.read(name), committed)
    }
    assert.equal(p.git("diff", "--", "src"), "")
    assert.equal(p.git("diff", "--cached"), "")
    // Re-stage the same malformed originals; fix should reproduce HEAD,
    // and lint-staged must prevent an empty commit rather than drift output.
    const head = p.git("rev-parse", "HEAD")
    for (const [name, content] of Object.entries(samples)) p.write(name, content)
    p.git("add", "--", "src")
    const again = p.commit()
    assert.notEqual(again.status, 0)
    assert.match(again.stdout + again.stderr, /empty (?:git )?commit/i)
    assert.equal(p.git("rev-parse", "HEAD"), head)
})
