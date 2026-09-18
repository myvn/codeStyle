#!/usr/bin/env node
"use strict"

/**
 * 快速统计测试用例数（不执行用例体）。
 *
 * 原理：把 `node:test` 的注册函数替换为计数器后加载测试文件——文件顶层的
 * test(...)（含循环/矩阵生成的用例）都会登记，但用例体与断言完全不执行。
 * 输出：stdout 打印一个整数。
 *
 * 用法：node scripts/count-tests.cjs <测试文件...>
 */

const path = require("node:path")
const Module = require("node:module")

const files = process.argv.slice(2)

let count = 0
const register = () => {
    count += 1
}
// 兼容 test.skip / test.todo / test.only 等变体
const stub = Object.assign(register, {
    skip: register,
    todo: register,
    only: register,
    fails: register,
    before: () => {},
    after: () => {},
    beforeEach: () => {},
    afterEach: () => {},
    describe: Object.assign(() => {}, { skip: () => {}, todo: () => {}, only: () => {} }),
    it: register,
    suite: () => {},
})

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "node:test" || request === "test") {
        return { ...stub, test: stub, default: stub }
    }
    return originalLoad.call(this, request, parent, isMain)
}

let failed = false
for (const file of files) {
    try {
        require(path.resolve(file))
    } catch (error) {
        // 计数失败不应影响测试本身：输出 0 让调用方退回"无总数"模式
        process.stderr.write(`count-tests: ${file} 加载失败：${error.message}\n`)
        failed = true
        break
    }
}

Module._load = originalLoad
process.stdout.write(failed ? "0" : String(count))
