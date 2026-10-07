const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wallpaper", {
  onMode: (cb) => ipcRenderer.on("mode", (_e, mode) => cb(mode)),
  onKey: (cb) => ipcRenderer.on("key", (_e, ev) => cb(ev)),
  onLang: (cb) => ipcRenderer.on("lang", (_e, lang) => cb(lang)),
  toggle: () => ipcRenderer.send("toggle"),
});
