const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const compiled = ts.transpileModule(fs.readFileSync("src/core/fileProperties.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const moduleExports = {};
new Function("exports", compiled)(moduleExports);

test("file properties show extension, exact bytes and modification date", () => {
  const { fileProperties } = moduleExports;
  const props = fileProperties({ name: "mod.loader.zip", path: "/home/deck/mod.loader.zip",
    size: 1548, modified: 1700000000, directory: false, symlink: false });
  assert.equal(props.find(x => x.label === "Nazwa").description, "mod.loader.zip");
  assert.equal(props.find(x => x.label === "Rozszerzenie").description, ".zip");
  assert.ok(props.find(x => x.label === "Rozmiar").description.replace(/\\s/g, "").includes("1548B"));
  assert.equal(props.find(x => x.label === "Ścieżka").description, "/home/deck/mod.loader.zip");
  assert.notEqual(props.find(x => x.label === "Data modyfikacji").description, "Brak danych");
});

test("folders are not recursively measured; dotfiles have no extension", () => {
  const { fileProperties, fileExtension } = moduleExports;
  assert.equal(fileExtension(".bashrc"), null);
  assert.equal(fileExtension("archive.7z"), ".7z");
  assert.equal(fileExtension("notes."), null);
  const props = fileProperties({ name: "mods", path: "/home/deck/mods",
    size: null, modified: 1700000000, directory: true, symlink: false });
  assert.equal(props.find(x => x.label === "Typ").description, "Folder");
  assert.match(props.find(x => x.label === "Rozmiar").description, /Nieobliczony/);
  assert.ok(!props.some(x => x.label === "Rozszerzenie"));
});
