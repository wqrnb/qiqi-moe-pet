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
  if (action.row == null) {
    assert.ok(action.sequence && action.sequence.stem, id + " needs a sequence");
    assert.ok(action.fallback, id + " needs a spritesheet fallback");
    return;
  }
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

assert.strictEqual(catalog.frameFileName("qiqi_chase", 1), "qiqi_chase_01.png");
assert.strictEqual(catalog.frameFileName("qiqi_chase", 8), "qiqi_chase_08.png");
assert.strictEqual(catalog.clipUrl("qiqi_chase", 8), "../../assets/actions/qiqi_chase_08.png");
assert.strictEqual(catalog.acceptSequence(1), false);
assert.strictEqual(catalog.acceptSequence(3), false);
assert.strictEqual(catalog.acceptSequence(4), true);
assert.strictEqual(catalog.acceptSequence(8), true);
assert.ok(catalog.sequenceStems().indexOf("qiqi_chase") >= 0);
assert.ok(catalog.sequenceStems().indexOf("qiqi_chase_left") >= 0);
assert.ok(catalog.sequenceStems().indexOf("qiqi_taskbar_right") >= 0);
assert.ok(catalog.sequenceStems().indexOf("qiqi_parachute") >= 0);
assert.ok(catalog.sequenceStems().indexOf("qiqi_read") >= 0);

const none = new Set();
assert.deepStrictEqual(catalog.resolvePlayback("chase", 1, none), { id: "walkRight", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("chase", -1, none), { id: "walkLeft", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("perch", 1, none), { id: "settle", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("parachute", 1, none), { id: "fall", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("gremlin", 1, none), { id: "notice", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("read", 1, none), { id: "review", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("sleep", 1, none), { id: "sleep", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("walk", 1, none), { id: "walkRight", stem: null, mirror: false });

const chaseOnly = new Set(["qiqi_chase"]);
assert.deepStrictEqual(catalog.resolvePlayback("chase", 1, chaseOnly), { id: "chase", stem: "qiqi_chase", mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("chase", -1, chaseOnly), { id: "chase", stem: "qiqi_chase", mirror: true });
const chaseLeft = new Set(["qiqi_chase_left", "qiqi_chase"]);
assert.deepStrictEqual(catalog.resolvePlayback("chase", -1, chaseLeft), { id: "chase", stem: "qiqi_chase_left", mirror: false });
const chaseLeftOnly = new Set(["qiqi_chase_left"]);
assert.deepStrictEqual(catalog.resolvePlayback("chase", 1, chaseLeftOnly), { id: "walkRight", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("chase", -1, chaseLeftOnly), { id: "chase", stem: "qiqi_chase_left", mirror: false });
const taskbarRight = new Set(["qiqi_taskbar_right"]);
assert.deepStrictEqual(catalog.resolvePlayback("walk", 1, taskbarRight), { id: "walkRight", stem: null, mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("taskbarWalk", 1, taskbarRight), { id: "taskbarWalk", stem: "qiqi_taskbar_right", mirror: false });
assert.deepStrictEqual(catalog.resolvePlayback("taskbarWalk", -1, none), { id: "walkLeft", stem: null, mirror: false });
const taskbarClip = new Set(["qiqi_taskbar"]);
assert.deepStrictEqual(catalog.resolvePlayback("taskbarWalk", -1, taskbarClip), { id: "taskbarWalk", stem: "qiqi_taskbar", mirror: true });
const sleepClip = new Set(["qiqi_sleep"]);
assert.deepStrictEqual(catalog.resolvePlayback("sleep", 1, sleepClip), { id: "sleep", stem: "qiqi_sleep", mirror: false });

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
