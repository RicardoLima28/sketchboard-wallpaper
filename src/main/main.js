// Main process: a single window that switches between two modes.
//  - "wallpaper": behind the icons; mouse and keyboard input over the desktop
//    is forwarded to the board (src/main/input.js), like Wallpaper Engine
//  - "draw": regular fullscreen window, for drawing while other windows are open
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const { attachToDesktop, detachFromDesktop } = require("./desktop");
const { startDesktopInput, stopDesktopInput } = require("./input");

const HOTKEY = "Control+Alt+D";
const ROOT = path.join(__dirname, "..", "..");

let win = null;
let tray = null;
let mode = "wallpaper";
let quitting = false;

// when running from source (npm start), use separate data and lock so it
// doesn't interfere with the installed app
if (!app.isPackaged) app.setPath("userData", app.getPath("userData") + "-dev");
if (!app.requestSingleInstanceLock()) app.quit();

// Primary monitor rectangle in physical pixels, relative to the virtual screen
// (the WorkerW spans all monitors starting from the top-left corner).
const wallpaperRect = () => {
  const phys = (d) => screen.dipToScreenRect(null, d.bounds);
  const all = screen.getAllDisplays().map(phys);
  const originX = Math.min(...all.map((r) => r.x));
  const originY = Math.min(...all.map((r) => r.y));
  const main = phys(screen.getPrimaryDisplay());
  return { x: main.x - originX, y: main.y - originY, width: main.width, height: main.height };
};

const setMode = (next) => {
  mode = next;
  if (mode === "draw") {
    detachFromDesktop(win);
    win.setBounds(screen.getPrimaryDisplay().bounds);
    win.setAlwaysOnTop(true, "screen-saver");
    win.show();
    win.focus();
  } else {
    win.setAlwaysOnTop(false);
    // Chromium only composites the window after it has been shown once
    if (!win.isVisible()) win.showInactive();
    win.blur();
    if (!attachToDesktop(win, wallpaperRect())) console.error("Desktop layer not found");
  }
  win.webContents.send("mode", mode);
  refreshTray();
};

const toggle = () => setMode(mode === "draw" ? "wallpaper" : "draw");

const createWindow = () => {
  win = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    frame: false,
    thickFrame: false, // no invisible 8 px border around it
    show: false,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: "#ffffff",
    webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
  });
  win.loadFile(path.join(ROOT, "dist", "index.html"));
  win.webContents.once("did-finish-load", () => setMode("wallpaper"));
  // if Explorer restarts, the layer disappears and takes the window with it: recreate
  win.on("closed", () => {
    win = null;
    if (!quitting) setTimeout(createWindow, 2000);
  });
};

const startsWithWindows = () => app.getLoginItemSettings().openAtLogin;
const setStartup = (enabled) =>
  app.setLoginItemSettings({ openAtLogin: enabled, args: app.isPackaged ? [] : [app.getAppPath()] });

// On the installed app's first run: enable auto-start and show the hotkey.
// After that, respect whatever the user picks in the tray menu.
const firstRun = () => {
  const marker = path.join(app.getPath("userData"), "first-run-done");
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, new Date().toISOString());
  if (app.isPackaged) setStartup(true);
  refreshTray();
  tray.displayBalloon({
    title: "Sketchboard Wallpaper is running",
    content: `Draw right on your desktop. ${HOTKEY.replace("Control", "Ctrl")} opens the board in fullscreen.`,
  });
};

const refreshTray = () => {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: mode === "draw" ? "Back to wallpaper" : "Open fullscreen", accelerator: HOTKEY, click: toggle },
      { type: "separator" },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: startsWithWindows(),
        click: (item) => setStartup(item.checked),
      },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
};

app.whenReady().then(() => {
  createWindow();

  const icon = nativeImage.createFromPath(path.join(ROOT, "assets", "icon.png")).resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip(`Sketchboard Wallpaper (${HOTKEY} for fullscreen)`);
  tray.on("double-click", toggle);
  refreshTray();
  firstRun();

  if (!globalShortcut.register(HOTKEY, toggle)) console.error(`Hotkey ${HOTKEY} is already in use`);
  ipcMain.on("toggle", toggle);
  startDesktopInput({
    getWin: () => win,
    enabled: () => !!win && mode === "wallpaper",
    isHotkey: (vk, ctrl, alt) => vk === 0x44 && ctrl && alt, // Ctrl+Alt+D
  });
  screen.on("display-metrics-changed", () => win && setMode(mode));
});

app.on("second-instance", () => win && setMode("draw"));
app.on("before-quit", () => (quitting = true));
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopDesktopInput();
});
app.on("window-all-closed", () => {}); // keep running in the tray
