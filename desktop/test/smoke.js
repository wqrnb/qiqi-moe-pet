const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("no-sandbox");
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("enable-transparent-visuals");

const outDir = process.env.QIQI_SMOKE_DIR || "/tmp/qiqi-smoke";
fs.mkdirSync(outDir, { recursive: true });

function fail(message) {
  console.error("SMOKE FAIL:", message);
  app.exit(1);
  throw new Error(message);
}

async function shot(win, name) {
  const image = await win.capturePage();
  const file = path.join(outDir, name);
  fs.writeFileSync(file, image.toPNG());
  return file;
}

app.whenReady().then(async () => {
  const errors = [];
  const preview = new BrowserWindow({
    width: 1180,
    height: 760,
    show: true,
    webPreferences: { sandbox: false, contextIsolation: true },
  });
  preview.webContents.on("console-message", (_event, _level, message) => {
    if (/error|Error|精灵图没有/i.test(message)) errors.push(message);
  });
  preview.webContents.on("did-fail-load", (_e, code, desc) => errors.push(desc + " " + code));
  await preview.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  await preview.webContents.executeJavaScript("localStorage.removeItem('qiqi-desktop-settings-v1')");
  await preview.reload();
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const walking = await preview.webContents.executeJavaScript(`(() => {
    const canvas = document.getElementById("sprite");
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 24) opaque += 1;
    return {
      mode: document.documentElement.className,
      status: document.getElementById("status").textContent,
      speech: document.getElementById("speech").textContent,
      opaque,
    };
  })()`);
  await shot(preview, "walk.png");

  await preview.webContents.executeJavaScript(`(() => {
    const canvas = document.getElementById("sprite");
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent("pointerdown", {
      button: 2, bubbles: true, clientX: rect.left + 40, clientY: rect.top + 40,
    }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const menu = await preview.webContents.executeJavaScript(`(() => {
    const menu = document.getElementById("menu");
    return { hidden: menu.hidden, text: menu.innerText };
  })()`);
  await shot(preview, "menu.png");

  await preview.webContents.executeJavaScript(`(() => {
    const button = document.querySelector("#menu button[data-toggle='matrix']");
    button.click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const matrix = await preview.webContents.executeJavaScript(`(() => {
    const button = document.querySelector("#menu button[data-toggle='matrix']");
    const canvas = document.getElementById("sprite");
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let green = 0;
    let pink = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] < 40) continue;
      if (data[i + 1] > data[i] + 20 && data[i + 1] > 80) green += 1;
      if (data[i] > data[i + 2] + 20 && data[i] > 120) pink += 1;
    }
    return { pressed: button.getAttribute("aria-pressed"), green, pink };
  })()`);
  await shot(preview, "matrix.png");

  await preview.webContents.executeJavaScript(`(() => {
    const canvas = document.getElementById("sprite");
    const rect = canvas.getBoundingClientRect();
    const down = { bubbles: true, button: 0, pointerId: 1, clientX: rect.left + 80, clientY: rect.top + 120 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", down));
    canvas.dispatchEvent(new PointerEvent("pointermove", Object.assign({}, down, { clientX: rect.left + 160, clientY: rect.top + 80 })));
    canvas.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, down, { clientX: rect.left + 160, clientY: rect.top + 80 })));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const trail = await preview.webContents.executeJavaScript(`(() => {
    const canvas = document.getElementById("trail-layer");
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let marks = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 20) marks += 1;
    return { marks, speech: document.getElementById("speech").textContent };
  })()`);
  await shot(preview, "trail.png");

  const scoreWin = new BrowserWindow({
    width: 1100,
    height: 800,
    show: true,
    webPreferences: { sandbox: false, contextIsolation: true },
  });
  await scoreWin.loadFile(path.join(__dirname, "..", "..", "index.html"));
  await scoreWin.webContents.executeJavaScript("localStorage.removeItem('qiqi-moe-total-v1')");
  await scoreWin.reload();
  await new Promise((resolve) => setTimeout(resolve, 400));
  const score = await scoreWin.webContents.executeJavaScript(`(() => {
    document.getElementById("headHit").click();
    document.getElementById("headHit").click();
    return {
      total: document.getElementById("scoreTotal").textContent,
      reward: document.getElementById("rewardValue").textContent,
      action: document.getElementById("actionName").textContent,
      link: !!document.querySelector("a.desktop-link"),
    };
  })()`);
  await shot(scoreWin, "score.png");

  const report = { walking, menu, matrix, trail, score, errors };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const problems = [];
  if (walking.mode !== "preview") problems.push("mode " + walking.mode);
  if (walking.opaque < 80) problems.push("sprite not drawn " + walking.opaque);
  if (!/走|待|挥|睡|坐|看/.test(walking.status)) problems.push("status " + walking.status);
  if (menu.hidden) problems.push("menu hidden");
  if (!menu.text.includes("任务栏散步") || !menu.text.includes("小捣蛋模式") || !menu.text.includes("矩阵滤镜")) {
    problems.push("menu text missing");
  }
  if (!menu.text.includes("关") || menu.text.indexOf("小捣蛋") < 0) problems.push("gremlin label");
  if (matrix.pressed !== "true") problems.push("matrix not on");
  if (matrix.green < 10) problems.push("matrix glyphs " + matrix.green);
  if (trail.marks < 5) problems.push("trail marks " + trail.marks);
  if (score.total === "0") problems.push("score stayed 0");
  if (!score.link) problems.push("desktop link missing");
  if (errors.length) problems.push(errors.join(" | "));
  if (problems.length) fail(problems.join("; "));
  console.log("SMOKE OK");
  app.exit(0);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
