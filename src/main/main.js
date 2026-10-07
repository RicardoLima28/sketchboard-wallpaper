// Processo principal: uma única janela que alterna entre dois modos.
//  - "wallpaper": atrás dos ícones; mouse e teclado sobre a área de trabalho
//    são repassados ao quadro (src/main/input.js), como no Wallpaper Engine
//  - "draw": janela normal em tela cheia, para desenhar com janelas abertas
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

// rodando pelo código (npm start), usa dados e trava próprios para não
// interferir no app instalado
if (!app.isPackaged) app.setPath("userData", app.getPath("userData") + "-dev");
if (!app.requestSingleInstanceLock()) app.quit();

// Retângulo do monitor principal em pixels físicos, relativo à tela virtual
// (a WorkerW cobre todos os monitores a partir do canto superior esquerdo).
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
    // o Chromium só compõe a janela depois de ela ter sido mostrada uma vez
    if (!win.isVisible()) win.showInactive();
    win.blur();
    if (!attachToDesktop(win, wallpaperRect())) console.error("Camada da área de trabalho não encontrada");
  }
  win.webContents.send("mode", mode);
  refreshTray();
};

const toggle = () => setMode(mode === "draw" ? "wallpaper" : "draw");

const createWindow = () => {
  win = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    frame: false,
    thickFrame: false, // sem a moldura invisível de 8 px ao redor
    show: false,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: "#ffffff",
    webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
  });
  win.loadFile(path.join(ROOT, "dist", "index.html"));
  win.webContents.once("did-finish-load", () => setMode("wallpaper"));
  // se o Explorer reiniciar, a camada some e leva a janela junto: recria
  win.on("closed", () => {
    win = null;
    if (!quitting) setTimeout(createWindow, 2000);
  });
};

const startsWithWindows = () => app.getLoginItemSettings().openAtLogin;
const setStartup = (enabled) =>
  app.setLoginItemSettings({ openAtLogin: enabled, args: app.isPackaged ? [] : [app.getAppPath()] });

// Na primeira execução do app instalado: liga o início automático e
// mostra o atalho. Depois disso, respeita o que o usuário escolher na bandeja.
const firstRun = () => {
  const marker = path.join(app.getPath("userData"), "first-run-done");
  if (fs.existsSync(marker)) return;
  fs.writeFileSync(marker, new Date().toISOString());
  if (app.isPackaged) setStartup(true);
  refreshTray();
  tray.displayBalloon({
    title: "Sketchboard Wallpaper está ativo",
    content: `Desenhe direto na área de trabalho. ${HOTKEY.replace("Control", "Ctrl")} abre o quadro em tela cheia.`,
  });
};

const refreshTray = () => {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: mode === "draw" ? "Voltar ao papel de parede" : "Abrir em tela cheia", accelerator: HOTKEY, click: toggle },
      { type: "separator" },
      {
        label: "Iniciar com o Windows",
        type: "checkbox",
        checked: startsWithWindows(),
        click: (item) => setStartup(item.checked),
      },
      { label: "Sair", click: () => app.quit() },
    ]),
  );
};

app.whenReady().then(() => {
  createWindow();

  const icon = nativeImage.createFromPath(path.join(ROOT, "assets", "icon.png")).resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip(`Sketchboard Wallpaper (${HOTKEY} para tela cheia)`);
  tray.on("double-click", toggle);
  refreshTray();
  firstRun();

  if (!globalShortcut.register(HOTKEY, toggle)) console.error(`Atalho ${HOTKEY} já está em uso`);
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
app.on("window-all-closed", () => {}); // continua rodando na bandeja
