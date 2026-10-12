#!/usr/bin/env node
/**
 * 麦麦消消乐 · 无头冒烟测试（47 项）
 * 用法：node tests/smoke.js
 * 原理：从 ../index.html 提取 <script> 游戏代码，打桩 DOM 后与 tests/assertions.js
 *       中的断言一起 eval 执行——保证测试对象就是仓库里的真实代码。
 */
const fs = require("fs");
const path = require("path");

/* ===== DOM / 浏览器 API 打桩 ===== */
const __elems = {};
function fakeEl(){
  return {
    innerHTML:"", textContent:"", style:{}, dataset:{}, disabled:false,
    classList:{add(){},remove(){},contains(){return false}},
    appendChild(){}, addEventListener(){}, insertBefore(){}, remove(){},
    querySelector(){return null;}, querySelectorAll(){return []},
  };
}
global.document = {
  getElementById: id => (__elems[id] = __elems[id] || fakeEl()),
  querySelector: () => fakeEl(),
  querySelectorAll: () => [],
  createElement: () => fakeEl(),
};
global.window = { addEventListener(){} };
global.localStorage = { getItem: () => null, setItem(){} };
global.navigator = {};

/* ===== 读取并提取游戏代码 ===== */
const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if(!m){
  console.error("FAIL | 未在 index.html 中找到 <script> 块");
  process.exit(2);
}
const gameJs = m[1];
const assertions = fs.readFileSync(path.join(__dirname, "assertions.js"), "utf8");

/* ===== 执行：游戏代码 + 断言（同一作用域）===== */
try{
  eval(gameJs + "\n" + assertions);
}catch(e){
  console.error("TEST CRASH:", e);
  process.exit(2);
}
