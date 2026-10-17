const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { execFile } = require("child_process");

if (process.platform === "linux") {
  // Local pet window only. The setuid sandbox helper is often unavailable,
  // and transparent windows on Linux want a software path.
  app.commandLine.appendSwitch("no-sandbox");
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("enable-transparent-visuals");
}

let petWin = null;
let trailWin = null;
let tray = null;
let windowCache = { at: 0, list: [] };

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function iconPath(name) {
  return path.join(__dirname, "icons", name);
}

function displayUnion() {
  const displays = screen.getAllDisplays();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const display of displays) {
    minX = Math.min(minX, display.bounds.x);
    minY = Math.min(minY, display.bounds.y);
    maxX = Math.max(maxX, display.bounds.x + display.bounds.width);
    maxY = Math.max(maxY, display.bounds.y + display.bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function createPet() {
  const work = screen.getPrimaryDisplay().workArea;
  petWin = new BrowserWindow({
    width: 288,
    height: 312,
    x: work.x + 80,
    y: work.y + work.height - 320,
    title: "淇淇",
    icon: iconPath("icon.png"),
    transparent: true,
    frame: false,
    thickFrame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  petWin.setAlwaysOnTop(true, "screen-saver");
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWin.setIgnoreMouseEvents(true, { forward: true });
  petWin.webContents.setBackgroundThrottling(false);
  petWin.loadFile(path.join(__dirname, "renderer", "index.html"));
  petWin.once("ready-to-show", () => petWin.show());
  petWin.on("closed", () => {
    petWin = null;
  });
}

function createTrail() {
  const bounds = displayUnion();
  trailWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: "淇淇轨迹",
    transparent: true,
    frame: false,
    thickFrame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  trailWin.setIgnoreMouseEvents(true);
  trailWin.setAlwaysOnTop(true, "screen-saver");
  trailWin.webContents.setBackgroundThrottling(false);
  trailWin.loadFile(path.join(__dirname, "renderer", "trail.html"));
  trailWin.once("ready-to-show", () => trailWin.show());
  trailWin.on("closed", () => {
    trailWin = null;
  });
}

function layoutTrail() {
  if (!trailWin) return;
  const bounds = displayUnion();
  trailWin.setBounds(bounds);
}

function createTrayIcon() {
  try {
    const image = nativeImage.createFromPath(iconPath("tray.png"));
    if (image.isEmpty()) return;
    tray = new Tray(image);
    tray.setToolTip("淇淇");
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: "把淇淇叫回来",
        click: () => {
          if (petWin && !petWin.isDestroyed()) {
            petWin.show();
            petWin.webContents.send("qiqi:recenter");
          }
        },
      },
      { type: "separator" },
      { label: "退出", click: () => app.quit() },
    ]));
  } catch (error) {
    console.error("tray", error);
  }
}

function sanitizeBounds(bounds) {
  if (!bounds) return null;
  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every((value) => Number.isFinite(value))) return null;
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(80, Math.min(2400, Math.round(bounds.width))),
    height: Math.max(80, Math.min(1600, Math.round(bounds.height))),
  };
}

function fromPet(event) {
  return petWin && event.sender === petWin.webContents;
}

function usefulWindow(win, work) {
  if (!win.title || /淇淇/.test(win.title)) return false;
  if (win.width < 180 || win.height < 100) return false;
  if (win.width > work.width * 0.98 && win.height > work.height * 0.92) return false;
  if (win.y > work.y + work.height - 8) return false;
  return true;
}

function listLinuxWindows() {
  return new Promise((resolve) => {
    execFile("xdotool", ["search", "--onlyvisible", "--name", "."], { timeout: 2500 }, (error, stdout) => {
      if (error || !stdout) {
        resolve([]);
        return;
      }
      const ids = stdout.trim().split(/\s+/).filter(Boolean).slice(0, 24);
      if (!ids.length) {
        resolve([]);
        return;
      }
      const found = [];
      let pending = ids.length;
      ids.forEach((id) => {
        execFile("xdotool", ["getwindowgeometry", "--shell", id], { timeout: 1500 }, (geoError, geoOut) => {
          execFile("xdotool", ["getwindowname", id], { timeout: 1500 }, (nameError, nameOut) => {
            if (!geoError && geoOut) {
              const read = (key) => {
                const match = String(geoOut).match(new RegExp("^" + key + "=(-?\\d+)$", "m"));
                return match ? Number(match[1]) : null;
              };
              const x = read("X");
              const y = read("Y");
              const width = read("WIDTH");
              const height = read("HEIGHT");
              if (x != null && width && height) {
                found.push({
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                  title: String(nameOut || "").trim(),
                });
              }
            }
            pending -= 1;
            if (pending === 0) resolve(found);
          });
        });
      });
    });
  });
}

function listWindows() {
  const work = screen.getPrimaryDisplay().workArea;
  const now = Date.now();
  if (now - windowCache.at < 1500) return Promise.resolve(windowCache.list);

  const finish = (list) => {
    const filtered = (list || []).filter((win) => usefulWindow(win, work));
    windowCache = { at: now, list: filtered };
    return filtered;
  };

  if (process.platform === "win32") {
    const script = path.join(__dirname, "native", "list-windows.ps1");
    return new Promise((resolve) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, String(process.pid)],
        { timeout: 4000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            resolve(finish([]));
            return;
          }
          const list = String(stdout).split(/\r?\n/).map((line) => {
            const parts = line.split("\t");
            if (parts.length < 5) return null;
            const title = parts.slice(4).join(" ").trim();
            return {
              x: Number(parts[0]),
              y: Number(parts[1]),
              width: Number(parts[2]),
              height: Number(parts[3]),
              title: title,
            };
          }).filter((win) => win && Number.isFinite(win.x) && win.width > 0);
          resolve(finish(list));
        }
      );
    });
  }

  if (process.platform === "linux") return listLinuxWindows().then(finish);
  return Promise.resolve(finish([]));
}

if (gotLock) app.on("second-instance", () => {
  if (petWin && !petWin.isDestroyed()) {
    petWin.show();
    petWin.webContents.send("qiqi:recenter");
  }
});

if (gotLock) {
  app.whenReady().then(() => {
    createTrayIcon();
    createPet();
    createTrail();
    screen.on("display-metrics-changed", layoutTrail);
  });
  app.on("window-all-closed", () => app.quit());
}

ipcMain.on("qiqi:work-area", (event, point) => {
  if (!fromPet(event)) return;
  const target = point && Number.isFinite(point.x) ? point : screen.getCursorScreenPoint();
  event.returnValue = screen.getDisplayNearestPoint(target).workArea;
});

ipcMain.on("qiqi:cursor", (event) => {
  if (!fromPet(event)) return;
  event.returnValue = screen.getCursorScreenPoint();
});

ipcMain.on("qiqi:get-bounds", (event) => {
  if (!fromPet(event)) return;
  event.returnValue = petWin ? petWin.getBounds() : null;
});

ipcMain.on("qiqi:bounds", (event, bounds) => {
  if (!fromPet(event) || !petWin) {
    event.returnValue = false;
    return;
  }
  const next = sanitizeBounds(bounds);
  if (!next) {
    event.returnValue = false;
    return;
  }
  const current = petWin.getBounds();
  if (current.width === next.width && current.height === next.height) {
    if (current.x !== next.x || current.y !== next.y) petWin.setPosition(next.x, next.y);
  } else {
    petWin.setBounds(next);
  }
  event.returnValue = true;
});

ipcMain.on("qiqi:ignore-mouse", (event, ignore) => {
  if (!fromPet(event) || !petWin) {
    event.returnValue = false;
    return;
  }
  if (ignore) petWin.setIgnoreMouseEvents(true, { forward: true });
  else petWin.setIgnoreMouseEvents(false);
  event.returnValue = true;
});

ipcMain.handle("qiqi:windows", (event) => {
  if (!fromPet(event)) return [];
  return listWindows();
});

ipcMain.on("qiqi:trail", (event, point) => {
  if (!fromPet(event) || !trailWin || !point) return;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const bounds = trailWin.getBounds();
  trailWin.webContents.send("qiqi:trail-point", {
    x: point.x - bounds.x,
    y: point.y - bounds.y,
  });
});

ipcMain.on("qiqi:laser", (event, laser) => {
  if (!fromPet(event) || !trailWin) return;
  if (!laser) {
    trailWin.webContents.send("qiqi:trail-laser", null);
    return;
  }
  const bounds = trailWin.getBounds();
  trailWin.webContents.send("qiqi:trail-laser", {
    x1: laser.x1 - bounds.x,
    y1: laser.y1 - bounds.y,
    x2: laser.x2 - bounds.x,
    y2: laser.y2 - bounds.y,
  });
});

ipcMain.on("qiqi:quit", (event) => {
  if (!fromPet(event)) return;
  app.quit();
});
