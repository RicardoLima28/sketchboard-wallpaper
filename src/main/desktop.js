// Chamadas Win32 para colocar uma janela atrás dos ícones da área de trabalho.
// A camada certa é uma janela "WorkerW" que o Explorer cria ao receber a
// mensagem 0x052C. A posição dela mudou no Windows 11 24H2.
const koffi = require("koffi");

const user32 = koffi.load("user32.dll");

const EnumProc = koffi.proto("bool __stdcall EnumWindowsProc(intptr_t hwnd, intptr_t lParam)");

const FindWindowW = user32.func("intptr_t __stdcall FindWindowW(str16 cls, str16 name)");
const FindWindowExW = user32.func("intptr_t __stdcall FindWindowExW(intptr_t parent, intptr_t after, str16 cls, str16 name)");
const EnumWindows = user32.func("bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lParam)");
const SendMessageTimeoutW = user32.func(
  "intptr_t __stdcall SendMessageTimeoutW(intptr_t hwnd, uint32 msg, uintptr_t w, intptr_t l, uint32 flags, uint32 timeout, _Out_ uintptr_t *result)",
);
const SetParent = user32.func("intptr_t __stdcall SetParent(intptr_t child, intptr_t parent)");
const SetWindowPos = user32.func("bool __stdcall SetWindowPos(intptr_t hwnd, intptr_t after, int x, int y, int cx, int cy, uint32 flags)");
const GetWindowLongPtrW = user32.func("intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)");
const SetWindowLongPtrW = user32.func("intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd, int index, intptr_t value)");

const GWL_STYLE = -16;
// estilo limpo de janela filha: sem a moldura invisível de redimensionar
const WS_CHILD_CLEAN = 0x40000000 | 0x10000000 | 0x04000000 | 0x02000000; // CHILD | VISIBLE | CLIPSIBLINGS | CLIPCHILDREN
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const SWP_FRAMECHANGED = 0x0020;

const hwndOf = (win) => {
  const buf = win.getNativeWindowHandle();
  return Number(buf.length === 8 ? buf.readBigInt64LE() : buf.readInt32LE());
};

// Devolve { parent, after }: a janela que vai conter o wallpaper e, no
// layout 24H2, a camada de ícones que deve ficar por cima dele.
const findDesktopLayer = () => {
  const progman = FindWindowW("Progman", null);
  if (!progman) return null;
  // pede ao Explorer para criar a WorkerW atrás dos ícones
  SendMessageTimeoutW(progman, 0x052c, 0xd, 0x1, 0, 1000, [0]);
  SendMessageTimeoutW(progman, 0x052c, 0, 0, 0, 1000, [0]);

  // Windows 11 24H2+: Progman -> [SHELLDLL_DefView, WorkerW]
  const innerWorker = FindWindowExW(progman, 0, "WorkerW", null);
  if (innerWorker) return { parent: innerWorker, after: 0 };

  // Layout antigo: WorkerW(ícones) -> SHELLDLL_DefView; a WorkerW seguinte é o fundo
  let worker = 0;
  const cb = koffi.register((top) => {
    if (FindWindowExW(top, 0, "SHELLDLL_DefView", null)) {
      worker = FindWindowExW(0, top, "WorkerW", null);
      return false;
    }
    return true;
  }, koffi.pointer(EnumProc));
  try {
    EnumWindows(cb, 0);
  } finally {
    koffi.unregister(cb);
  }
  if (worker) return { parent: worker, after: 0 };

  // Último recurso: dentro do Progman, logo abaixo da camada de ícones
  const defView = FindWindowExW(progman, 0, "SHELLDLL_DefView", null);
  return { parent: progman, after: defView || 0 };
};

// estilo original de cada janela, restaurado ao sair do fundo
const originalStyle = new Map();

// rect em pixels físicos, relativo ao canto superior esquerdo da tela virtual
const attachToDesktop = (win, rect) => {
  const layer = findDesktopLayer();
  if (!layer) return false;
  const hwnd = hwndOf(win);
  if (!originalStyle.has(hwnd)) originalStyle.set(hwnd, GetWindowLongPtrW(hwnd, GWL_STYLE));
  SetWindowLongPtrW(hwnd, GWL_STYLE, WS_CHILD_CLEAN);
  SetParent(hwnd, layer.parent);
  SetWindowPos(hwnd, layer.after, rect.x, rect.y, rect.width, rect.height, SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
  return true;
};

const detachFromDesktop = (win) => {
  const hwnd = hwndOf(win);
  if (!originalStyle.has(hwnd)) return;
  SetParent(hwnd, 0);
  SetWindowLongPtrW(hwnd, GWL_STYLE, originalStyle.get(hwnd));
  originalStyle.delete(hwnd);
};

module.exports = { attachToDesktop, detachFromDesktop };
