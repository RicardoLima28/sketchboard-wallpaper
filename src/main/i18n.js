// UI translations. Shared by the main process (tray menu, notification) and
// the renderer (Excalidraw language and the "Back to wallpaper" button).
//  - name: shown in the tray "Language" submenu, in its own language
//  - excalidraw: the langCode passed to Excalidraw
const LANGUAGES = {
  en: {
    name: "English",
    excalidraw: "en",
    openFullscreen: "Open fullscreen",
    backToWallpaper: "Back to wallpaper",
    startWithWindows: "Start with Windows",
    language: "Language",
    quit: "Quit",
    tooltip: "Sketchboard Wallpaper (double-click for fullscreen)",
    runningTitle: "Sketchboard Wallpaper is running",
    runningBody: "Draw right on your desktop. Double-click the tray icon to open the board in fullscreen.",
  },
  "pt-BR": {
    name: "Português (Brasil)",
    excalidraw: "pt-BR",
    openFullscreen: "Abrir em tela cheia",
    backToWallpaper: "Voltar ao papel de parede",
    startWithWindows: "Iniciar com o Windows",
    language: "Idioma",
    quit: "Sair",
    tooltip: "Sketchboard Wallpaper (duplo clique para tela cheia)",
    runningTitle: "Sketchboard Wallpaper está ativo",
    runningBody: "Desenhe direto na área de trabalho. Dê um duplo clique no ícone da bandeja para abrir o quadro em tela cheia.",
  },
  es: {
    name: "Español",
    excalidraw: "es-ES",
    openFullscreen: "Abrir en pantalla completa",
    backToWallpaper: "Volver al fondo de pantalla",
    startWithWindows: "Iniciar con Windows",
    language: "Idioma",
    quit: "Salir",
    tooltip: "Sketchboard Wallpaper (doble clic para pantalla completa)",
    runningTitle: "Sketchboard Wallpaper está activo",
    runningBody: "Dibuja directamente en el escritorio. Haz doble clic en el icono de la bandeja para abrir la pizarra en pantalla completa.",
  },
};

const DEFAULT_LANGUAGE = "en";

// best supported language for a locale such as "pt-BR", "es-419" or "en-US"
const matchLanguage = (locale = "") => {
  if (LANGUAGES[locale]) return locale;
  const base = locale.split("-")[0].toLowerCase();
  return Object.keys(LANGUAGES).find((code) => code.split("-")[0] === base) ?? DEFAULT_LANGUAGE;
};

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, matchLanguage };
