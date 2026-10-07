// Main process: a single window that switches between two modes.
//  - "wallpaper": behind the icons; mouse and keyboard input over the desktop
//    is forwarded to the board (src/main/input.js), like Wallpaper Engine
//  - "draw": regular fullscreen window, for drawing while other windows are open
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const { attachToDesktop, detachFromDesktop } = require("./desktop");
const { startDesktopInput, stopDesktopInput } = require("./input");
const { LANGUAGES, matchLanguage } = require("./i18n");

const ROOT = path.join(__dirname, "..", "..");

let win = null;
let tray = null;
let mode = "wallpaper";
let quitting = false;
let lang = null; // key of LANGUAGES, chosen in the tray "Language" submenu

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

// ---------------------------------------------------------------- settings

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");

const loadSettings = () => {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
  } catch {
    return {};
  }
};

const saveSettings = (changes) => {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), ...changes }, null, 2));
  } catch (err) {
    console.error("Failed to save settings", err);
  }
};

const t = () => LANGUAGES[lang];

// saved choice, otherwise the Windows display language (falls back to English)
const initialLanguage = () => {
  const saved = loadSettings().lang;
  if (LANGUAGES[saved]) return saved;
  return matchLanguage(app.getPreferredSystemLanguages()[0] ?? app.getLocale());
};

const setLanguage = (next) => {
  lang = next;
  saveSettings({ lang });
  tray?.setToolTip(t().tooltip);
  win?.webContents.send("lang", lang);
};

// ---------------------------------------------------------------- window

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
  win.loadFile(path.join(ROOT, "dist", "index.html"), { query: { lang } });
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

// On the installed app's first run: enable auto-start and explain how to open
// fullscreen.
// After that, respect whatever the user picks in the tray menu.
const firstRun = () => {
  const marker = path.join(app.getPath("userData"), "first-run-done");
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, new Date().toISOString());
  if (app.isPackaged) setStartup(true);
  tray.displayBalloon({
    title: t().runningTitle,
    content: t().runningBody,
  });
};

// built on every right-click, so it always reflects the current mode/language
const trayMenu = () =>
  Menu.buildFromTemplate([
    { label: mode === "draw" ? t().backToWallpaper : t().openFullscreen, click: toggle },
    { type: "separator" },
    {
      label: t().language,
      submenu: Object.entries(LANGUAGES).map(([code, { name }]) => ({
        label: name,
        type: "radio",
        checked: code === lang,
        click: () => setLanguage(code),
      })),
    },
    {
      label: t().startWithWindows,
      type: "checkbox",
      checked: startsWithWindows(),
      click: (item) => setStartup(item.checked),
    },
    { label: t().quit, click: () => app.quit() },
  ]);

app.whenReady().then(() => {
  lang = initialLanguage();
  createWindow();

  const icon = nativeImage.createFromPath(path.join(ROOT, "assets", "icon.png")).resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip(t().tooltip);
  tray.on("double-click", toggle);
  // Opened by hand instead of setContextMenu: when the icon is in the "hidden
  // icons" flyout, Electron's menu would open behind it. The short delay lets
  // the shell finish handling the click first (electron/electron#9797).
  tray.on("right-click", () => setTimeout(() => tray.popUpContextMenu(trayMenu()), 100));
  firstRun();

  ipcMain.on("toggle", toggle);
  startDesktopInput({
    getWin: () => win,
    enabled: () => !!win && mode === "wallpaper",
  });
  screen.on("display-metrics-changed", () => win && setMode(mode));
});

app.on("second-instance", () => win && setMode("draw"));
app.on("before-quit", () => (quitting = true));
app.on("will-quit", stopDesktopInput);
app.on("window-all-closed", () => {}); // keep running in the tray
