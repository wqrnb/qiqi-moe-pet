const assert = require("assert");
const fs = require("fs");
const path = require("path");
const catalog = require("../renderer/catalog.js");

const empty = new Set(catalog.EMPTY_CELLS.map(function (cell) {
  return cell[0] + ":" + cell[1];
}));

assert.strictEqual(catalog.SHEET.columns, 8);
assert.strictEqual(catalog.SHEET.rows, 11);
assert.strictEqual(catalog.SHEET.frameWidth, 192);
assert.strictEqual(catalog.SHEET.frameHeight, 208);

Object.keys(catalog.ACTIONS).forEach(function (id) {
  const action = catalog.ACTIONS[id];
  assert.strictEqual(action.id, id);
  assert.ok(action.label, id + " needs a label");
  if (action.src) return;
  assert.ok(action.row >= 0 && action.row < catalog.SHEET.rows, id);
  assert.ok(action.frames && action.frames.length > 0, id);
  action.frames.forEach(function (frame) {
    assert.ok(frame >= 0 && frame < catalog.SHEET.columns, id + " frame " + frame);
    assert.ok(!empty.has(action.row + ":" + frame), id + " points at an empty cell " + action.row + ":" + frame);
  });
  assert.ok(catalog.actionDuration(action) > 0, id);
});

assert.deepStrictEqual(
  ["idle", "wave", "jump", "wait", "review", "walkRight", "walkLeft", "sit", "sleep"].map(function (id) {
    return catalog.ACTIONS[id].row;
  }),
  [0, 3, 4, 6, 8, 1, 2, 5, 10]
);
assert.strictEqual(catalog.locomotionAction(-8), "walkLeft");
assert.strictEqual(catalog.locomotionAction(8), "walkRight");
assert.strictEqual(catalog.locomotionAction(0), "walkRight");
assert.strictEqual(catalog.actionDuration(catalog.ACTIONS.wave), 700);
assert.strictEqual(catalog.ACTIONS.settle.next, "sit");
assert.deepStrictEqual(catalog.ACTIONS.fall.frames, [2]);

const root = path.join(__dirname, "..", "..");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(page.includes("./assets/qiqi-spritesheet.webp"));
assert.ok(page.includes("qiqi-moe-total-v1"));
assert.ok(page.includes('id="scoreTotal"'));
assert.ok(page.includes("function hit()"));
assert.ok(fs.existsSync(path.join(root, "assets", "qiqi-spritesheet.webp")));

const plugins = fs.readFileSync(path.join(__dirname, "..", "renderer", "plugins.js"), "utf8");
assert.ok(/id:\s*"gremlin"[\s\S]*?defaultEnabled:\s*false/.test(plugins));
assert.ok(/id:\s*"matrix"[\s\S]*?defaultEnabled:\s*false/.test(plugins));
assert.ok(/id:\s*"trail"[\s\S]*?defaultEnabled:\s*true/.test(plugins));
assert.ok(/id:\s*"taskbar"[\s\S]*?defaultEnabled:\s*true/.test(plugins));

const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
assert.ok(main.includes("transparent: true"));
assert.ok(main.includes("alwaysOnTop: true"));
assert.ok(main.includes("list-windows.ps1"));

console.log("catalog ok:", Object.keys(catalog.ACTIONS).length, "actions");
