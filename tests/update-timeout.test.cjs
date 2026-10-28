const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/utils/withTimeout.ts"), "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const context = { exports: {}, setTimeout, clearTimeout };
vm.runInNewContext(compiled, context, { filename: "withTimeout.js" });
const { withTimeout } = context.exports;

test("a fast successful backend reply is returned", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 50), "ok");
});

test("a rejected backend reply still reports an error", async () => {
  await assert.rejects(
    withTimeout(Promise.reject(new Error("backend")), 50),
    error => error.message === "backend"
  );
});

test("an unresponsive Decky request times out and releases the UI", async () => {
  const neverResolves = new Promise(() => {});
  await assert.rejects(
    withTimeout(neverResolves, 15),
    error => error.name === "RequestTimeoutError"
  );
});

test("a response arriving after the timeout does not replace the failure", async () => {
  let resolveLate;
  const response = new Promise(resolve => { resolveLate = resolve; });
  const operation = withTimeout(response, 10);
  await assert.rejects(operation, error => error.name === "RequestTimeoutError");
  resolveLate("late");
  await Promise.resolve();
});
