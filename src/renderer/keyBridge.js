// Receives the keys captured by the main process (src/main/input.js)
// while the desktop has focus and delivers them to Excalidraw.

// ABNT2-layout dead keys -> combining accent mark
const DEAD_MARKS = { "´": "́", "`": "̀", "~": "̃", "^": "̂", "¨": "̈" };

const isEditable = (el) =>
  !!el &&
  (el.tagName === "TEXTAREA" ||
    (el.tagName === "INPUT" && !["checkbox", "radio", "button", "range", "color"].includes(el.type)) ||
    el.isContentEditable);

const compose = (dead, ch) => {
  if (!dead) return ch;
  const mark = DEAD_MARKS[dead];
  if (mark && ch.length === 1) {
    const composed = (ch + mark).normalize("NFC");
    if (composed.length === 1) return composed;
  }
  return ch === " " ? dead : dead + ch;
};

const dispatchKey = (target, ev) =>
  !target.dispatchEvent(
    new KeyboardEvent(ev.type, {
      key: ev.key,
      code: ev.code,
      ctrlKey: ev.ctrl,
      shiftKey: ev.shift,
      altKey: ev.alt,
      repeat: ev.repeat,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );

const insertText = (el, text) => {
  if (document.execCommand("insertText", false, text)) return;
  el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const deleteText = (el, forward) => {
  if (document.execCommand(forward ? "forwardDelete" : "delete")) return;
  let { selectionStart: start, selectionEnd: end } = el;
  if (start === end) forward ? (end = Math.min(el.value.length, end + 1)) : (start = Math.max(0, start - 1));
  el.setRangeText("", start, end, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const moveCaret = (el, key, shift) => {
  if (!("selectionStart" in el)) return;
  const { value, selectionStart: start, selectionEnd: end } = el;
  let pos = end;
  if (key === "ArrowLeft") pos = start !== end && !shift ? start : Math.max(0, end - 1);
  else if (key === "ArrowRight") pos = start !== end && !shift ? end : Math.min(value.length, end + 1);
  else if (key === "Home") pos = value.lastIndexOf("\n", end - 1) + 1;
  else if (key === "End") pos = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
  el.setSelectionRange(shift ? Math.min(start, pos) : pos, shift ? Math.max(start, pos) : pos);
};

export const startKeyBridge = () => {
  if (!window.wallpaper) return;
  let dead = null;

  const handleEditable = (el, ev) => {
    // Excalidraw handles Escape, Ctrl+Enter, Tab etc. on the field's keydown
    if (dispatchKey(el, ev)) return;
    if (ev.ctrl && !ev.alt) {
      const k = ev.key.toLowerCase();
      if (k === "a") el.select?.();
      else if (k === "z") document.execCommand(ev.shift ? "redo" : "undo");
      else if (k === "y") document.execCommand("redo");
      else if (k === "c" || k === "x") document.execCommand(k === "c" ? "copy" : "cut");
      return;
    }
    if (ev.dead) {
      dead = ev.key;
      return;
    }
    if (ev.key.length >= 1 && ev.key.length <= 2 && ev.key !== "Unidentified" && !/^F\d+$/.test(ev.key)) {
      insertText(el, compose(dead, ev.key));
      dead = null;
      return;
    }
    if (ev.key === "Backspace" || ev.key === "Delete") deleteText(el, ev.key === "Delete");
    else if (ev.key === "Enter") insertText(el, "\n");
    else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) moveCaret(el, ev.key, ev.shift);
  };

  window.wallpaper.onKey((ev) => {
    const el = document.activeElement;
    if (ev.type === "keydown" && isEditable(el)) {
      handleEditable(el, ev);
      return;
    }
    if (ev.dead) return;
    dispatchKey(el || document.body, ev);
  });
};
