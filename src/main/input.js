// Interação direto na área de trabalho, como no Wallpaper Engine: hooks
// globais de mouse e teclado repassam para o quadro o que acontece sobre a
// área de trabalho, sem precisar trocar de modo.
//  - mouse: cópia dos eventos sobre a área de trabalho (os ícones continuam
//    recebendo o clique; o botão direito fica só com o menu do Windows)
//  - teclado: com a área de trabalho em foco, as teclas vão só para o quadro
const koffi = require("koffi");
const { screen } = require("electron");

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

const POINT = koffi.struct("POINT", { x: "int32", y: "int32" });
const MSLLHOOKSTRUCT = koffi.struct("MSLLHOOKSTRUCT", {
  pt: POINT,
  mouseData: "uint32",
  flags: "uint32",
  time: "uint32",
  extra: "uintptr_t",
});
const KBDLLHOOKSTRUCT = koffi.struct("KBDLLHOOKSTRUCT", {
  vkCode: "uint32",
  scanCode: "uint32",
  flags: "uint32",
  time: "uint32",
  extra: "uintptr_t",
});
const HookProc = koffi.proto("intptr_t __stdcall HookProc(int code, uintptr_t wParam, void *lParam)");

const SetWindowsHookExW = user32.func("intptr_t __stdcall SetWindowsHookExW(int id, HookProc *fn, intptr_t mod, uint32 thread)");
const UnhookWindowsHookEx = user32.func("bool __stdcall UnhookWindowsHookEx(intptr_t hook)");
const CallNextHookEx = user32.func("intptr_t __stdcall CallNextHookEx(intptr_t hook, int code, uintptr_t wParam, void *lParam)");
const GetModuleHandleW = kernel32.func("intptr_t __stdcall GetModuleHandleW(str16 name)");
const WindowFromPoint = user32.func("intptr_t __stdcall WindowFromPoint(POINT pt)");
const GetAncestor = user32.func("intptr_t __stdcall GetAncestor(intptr_t hwnd, uint32 flags)");
const GetForegroundWindow = user32.func("intptr_t __stdcall GetForegroundWindow()");
const GetClassNameW = user32.func("int __stdcall GetClassNameW(intptr_t hwnd, _Out_ uint16 *buf, int max)");
const GetKeyState = user32.func("int16 __stdcall GetKeyState(int vk)");
const GetWindowThreadProcessId = user32.func("uint32 __stdcall GetWindowThreadProcessId(intptr_t hwnd, void *pid)");
const GetKeyboardLayout = user32.func("intptr_t __stdcall GetKeyboardLayout(uint32 thread)");
const ToUnicodeEx = user32.func(
  "int __stdcall ToUnicodeEx(uint32 vk, uint32 scan, uint8 *state, _Out_ uint16 *buf, int size, uint32 flags, intptr_t hkl)",
);
const GetDoubleClickTime = user32.func("uint32 __stdcall GetDoubleClickTime()");

const WH_KEYBOARD_LL = 13;
const WH_MOUSE_LL = 14;
const GA_ROOT = 2;
const DESKTOP_CLASSES = new Set(["Progman", "WorkerW"]);

const className = (hwnd) => {
  const buf = new Uint16Array(64);
  const n = GetClassNameW(hwnd, buf, buf.length);
  return String.fromCharCode(...buf.subarray(0, n));
};

// a área de trabalho (ícones, fundo ou o próprio quadro) é tudo cuja janela
// raiz é o Progman/WorkerW
const desktopAt = (pt) => {
  const hwnd = WindowFromPoint(pt);
  return !!hwnd && DESKTOP_CLASSES.has(className(GetAncestor(hwnd, GA_ROOT) || hwnd));
};
const desktopFocused = () => DESKTOP_CLASSES.has(className(GetForegroundWindow()));

// ---------------------------------------------------------------- mouse

const BUTTONS = {
  0x201: ["left", true], 0x202: ["left", false],
  0x207: ["middle", true], 0x208: ["middle", false],
};
const HELD_MODIFIER = { left: "leftButtonDown", middle: "middleButtonDown" };

const createMouseForwarder = (getWin) => {
  const held = new Set();
  let last = { time: 0, x: 0, y: 0, count: 0 };

  // ponto físico da tela -> coordenadas da página (DIP, relativas ao monitor principal)
  const toPage = (pt) => {
    const dip = screen.screenToDipPoint(pt);
    const { bounds } = screen.getPrimaryDisplay();
    return { x: Math.round(dip.x - bounds.x), y: Math.round(dip.y - bounds.y), inside: screen.getDisplayNearestPoint(dip).id === screen.getPrimaryDisplay().id };
  };

  const send = (event) => getWin()?.webContents.sendInputEvent(event);
  const modifiers = () => [...held].map((b) => HELD_MODIFIER[b]);

  return (msg, info) => {
    const pt = { x: info.pt.x, y: info.pt.y };
    const dragging = held.size > 0;
    if (!dragging && (msg === 0x200 || msg in BUTTONS || msg === 0x20a) && !desktopAt(pt)) return;
    const pos = toPage(pt);
    if (!dragging && !pos.inside) return;

    if (msg === 0x200) {
      send({ type: "mouseMove", x: pos.x, y: pos.y, modifiers: modifiers() });
    } else if (msg in BUTTONS) {
      const [button, down] = BUTTONS[msg];
      if (down) {
        const near = Math.abs(pos.x - last.x) < 5 && Math.abs(pos.y - last.y) < 5;
        last = { time: info.time, x: pos.x, y: pos.y, count: near && info.time - last.time < GetDoubleClickTime() ? last.count + 1 : 1 };
        held.add(button);
      } else {
        held.delete(button);
      }
      send({ type: down ? "mouseDown" : "mouseUp", x: pos.x, y: pos.y, button, clickCount: last.count, modifiers: modifiers() });
    } else if (msg === 0x20a) {
      const delta = (info.mouseData | 0) >> 16; // palavra alta com sinal (WHEEL_DELTA)
      send({ type: "mouseWheel", x: pos.x, y: pos.y, deltaX: 0, deltaY: delta, canScroll: true, modifiers: [] });
    }
  };
};

// ---------------------------------------------------------------- teclado

const NAMED = {
  0x08: "Backspace", 0x09: "Tab", 0x0d: "Enter", 0x1b: "Escape", 0x20: " ",
  0x21: "PageUp", 0x22: "PageDown", 0x23: "End", 0x24: "Home",
  0x25: "ArrowLeft", 0x26: "ArrowUp", 0x27: "ArrowRight", 0x28: "ArrowDown",
  0x2d: "Insert", 0x2e: "Delete",
};
const MODIFIERS = new Set([0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0x10, 0x11, 0x12, 0x5b, 0x5c, 0x14, 0x90, 0x91]);

const code = (vk) => {
  if (vk >= 0x41 && vk <= 0x5a) return "Key" + String.fromCharCode(vk);
  if (vk >= 0x30 && vk <= 0x39) return "Digit" + String.fromCharCode(vk);
  if (vk >= 0x60 && vk <= 0x69) return "Numpad" + (vk - 0x60);
  if (vk >= 0x70 && vk <= 0x7b) return "F" + (vk - 0x6f);
  if (vk === 0x20) return "Space";
  return NAMED[vk] ?? "";
};

// caractere que a tecla produz no layout atual (ABNT2 etc.), sem mexer no
// estado de teclas mortas do sistema (flag 0x4)
const translate = (vk, scan, shift, altGr) => {
  const state = new Uint8Array(256);
  if (shift) state[0x10] = 0x80;
  if (altGr) state[0x11] = state[0x12] = 0x80;
  if (GetKeyState(0x14) & 1) state[0x14] = 0x01;
  const hkl = GetKeyboardLayout(GetWindowThreadProcessId(GetForegroundWindow(), null));
  const buf = new Uint16Array(8);
  const rc = ToUnicodeEx(vk, scan, state, buf, buf.length, 0x4, hkl);
  if (rc < 0) return { key: buf[0] ? String.fromCharCode(buf[0]) : "", dead: true };
  const s = String.fromCharCode(...buf.subarray(0, Math.max(0, rc)));
  return { key: s && s.charCodeAt(0) >= 0x20 ? s : "", dead: false };
};

const createKeyForwarder = (getWin, isHotkey) => {
  const mods = {};
  const forwardedDown = new Set();

  // devolve true quando a tecla foi para o quadro (e deve ser engolida)
  return (msg, info) => {
    const vk = info.vkCode;
    const down = msg === 0x100 || msg === 0x104;
    const up = msg === 0x101 || msg === 0x105;
    if ([0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0x5b, 0x5c].includes(vk)) mods[vk] = down;
    if (MODIFIERS.has(vk) || !(down || up)) return false;
    if (up && !forwardedDown.has(vk)) return false;

    const shift = mods[0xa0] || mods[0xa1];
    const altGr = !!mods[0xa5]; // AltGr chega como Ctrl esquerdo + Alt direito
    const ctrl = (mods[0xa2] || mods[0xa3]) && !altGr;
    const alt = mods[0xa4] && !altGr;
    const win = mods[0x5b] || mods[0x5c];

    if (down) {
      // atalhos do sistema e do próprio app continuam funcionando
      if (win || (alt && [0x09, 0x73, 0x1b].includes(vk)) || isHotkey(vk, ctrl, alt) || !desktopFocused()) return false;
    }

    let key = NAMED[vk];
    let dead = false;
    if (!key) {
      if (vk >= 0x70 && vk <= 0x7b) key = "F" + (vk - 0x6f);
      else if ((ctrl || alt) && vk >= 0x41 && vk <= 0x5a) key = shift ? String.fromCharCode(vk) : String.fromCharCode(vk).toLowerCase();
      else if ((ctrl || alt) && vk >= 0x30 && vk <= 0x39) key = String.fromCharCode(vk);
      else ({ key, dead } = translate(vk, info.scanCode, shift, altGr));
    }

    const repeat = down && forwardedDown.has(vk);
    if (down) forwardedDown.add(vk);
    else forwardedDown.delete(vk);

    getWin()?.webContents.send("key", {
      type: down ? "keydown" : "keyup",
      key: key || "Unidentified",
      code: code(vk),
      ctrl: !!ctrl, shift: !!shift, alt: !!alt, dead, repeat,
    });
    return true;
  };
};

// ---------------------------------------------------------------- hooks

let hooks = [];

// enabled(): se o quadro está atrás dos ícones (no modo tela cheia não repassa nada)
const startDesktopInput = ({ getWin, enabled, isHotkey }) => {
  stopDesktopInput();
  const mouse = createMouseForwarder(getWin);
  const keys = createKeyForwarder(getWin, isHotkey);
  const mod = GetModuleHandleW(null);

  const mouseCb = koffi.register((code, wParam, lParam) => {
    if (code >= 0 && enabled()) {
      try {
        mouse(Number(wParam), koffi.decode(lParam, MSLLHOOKSTRUCT));
      } catch (err) {
        console.error(err);
      }
    }
    return CallNextHookEx(0, code, wParam, lParam); // o clique segue para os ícones
  }, koffi.pointer(HookProc));

  const keyCb = koffi.register((code, wParam, lParam) => {
    if (code >= 0 && enabled()) {
      try {
        if (keys(Number(wParam), koffi.decode(lParam, KBDLLHOOKSTRUCT))) return 1; // o Explorer não recebe (evita Delete em arquivos)
      } catch (err) {
        console.error(err);
      }
    }
    return CallNextHookEx(0, code, wParam, lParam);
  }, koffi.pointer(HookProc));

  hooks = [
    { handle: SetWindowsHookExW(WH_MOUSE_LL, mouseCb, mod, 0), cb: mouseCb },
    { handle: SetWindowsHookExW(WH_KEYBOARD_LL, keyCb, mod, 0), cb: keyCb },
  ];
  if (hooks.some((h) => !h.handle)) console.error("Falha ao instalar os hooks de entrada");
};

const stopDesktopInput = () => {
  for (const { handle, cb } of hooks) {
    if (handle) UnhookWindowsHookEx(handle);
    koffi.unregister(cb);
  }
  hooks = [];
};

module.exports = { startDesktopInput, stopDesktopInput };
