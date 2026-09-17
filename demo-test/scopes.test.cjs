const { test } = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { project, root } = require("./helpers.cjs")
const modulePath = JSON.stringify(path.join(root, "src/commitlint/scopes.cjs"))

test("目录转 scope：单数转换、多目录去重、跳过文件", (t) => {
    const p = project(t, {
        "src/components/Button.vue": "", "src/utils/index.ts": "", "src/types/index.ts": "",
        "src/index.ts": "", "packages/components/Card.vue": "", "packages/pages/Home.vue": "",
    })
    const result = p.node(`const { generateScopes } = require(${modulePath}); console.log(JSON.stringify(generateScopes(["src", "packages", "missing"])))`)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout).sort(), ["component", "page", "types", "util"])
})

test("不存在源码目录时返回空 scope 列表", (t) => {
    const p = project(t)
    const result = p.node(`console.log(JSON.stringify(require(${modulePath}).generateScopes()))`)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), [])
})
