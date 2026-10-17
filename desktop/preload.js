const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qiqiDesktop", {
  kind: "electron",
  getWorkArea: (point) => ipcRenderer.sendSync("qiqi:work-area", point || null),
  getCursor: () => ipcRenderer.sendSync("qiqi:cursor"),
  setBounds: (bounds) => ipcRenderer.sendSync("qiqi:bounds", bounds),
  getBounds: () => ipcRenderer.sendSync("qiqi:get-bounds"),
  setIgnoreMouse: (ignore) => ipcRenderer.sendSync("qiqi:ignore-mouse", !!ignore),
  listWindows: () => ipcRenderer.invoke("qiqi:windows"),
  setLaser: (laser) => ipcRenderer.send("qiqi:laser", laser),
  addTrail: (point) => ipcRenderer.send("qiqi:trail", point),
  quit: () => ipcRenderer.send("qiqi:quit"),
  onRecenter: (callback) => {
    ipcRenderer.on("qiqi:recenter", () => callback());
  },
});

contextBridge.exposeInMainWorld("qiqiTrail", {
  onPoint: (callback) => {
    ipcRenderer.on("qiqi:trail-point", (_event, point) => callback(point));
  },
  onLaser: (callback) => {
    ipcRenderer.on("qiqi:trail-laser", (_event, laser) => callback(laser));
  },
});
