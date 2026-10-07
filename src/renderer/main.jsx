import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { startKeyBridge } from "./keyBridge";

const SCENE_KEY = "wp-excalidraw-scene";
const DB_NAME = "wp-excalidraw";
const FILES_STORE = "files";

// IndexedDB stores the images (they can be too large for localStorage)
const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FILES_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const dbPromise = openDb().catch(() => null);

const loadFiles = async () => {
  const db = await dbPromise;
  if (!db) return {};
  return new Promise((resolve) => {
    const files = {};
    const req = db.transaction(FILES_STORE).objectStore(FILES_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(files);
      files[cursor.key] = cursor.value;
      cursor.continue();
    };
    req.onerror = () => resolve(files);
  });
};

const saveFiles = async (files) => {
  const db = await dbPromise;
  if (!db || !files.length) return;
  const tx = db.transaction(FILES_STORE, "readwrite");
  files.forEach((file) => tx.objectStore(FILES_STORE).put(file, file.id));
};

const loadScene = () => {
  try {
    return JSON.parse(localStorage.getItem(SCENE_KEY)) || null;
  } catch {
    return null;
  }
};

const App = () => {
  const savedFileIds = useRef(new Set());
  const latest = useRef(null);
  const timer = useRef(null);
  const [mode, setMode] = useState("wallpaper");
  const [initialData] = useState(() =>
    loadFiles().then((files) => {
      Object.keys(files).forEach((id) => savedFileIds.current.add(id));
      const scene = loadScene();
      return {
        elements: scene?.elements ?? [],
        appState: { ...scene?.appState, collaborators: new Map() },
        files,
        scrollToContent: !scene,
      };
    }),
  );

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!latest.current) return;
    const { elements, appState, files } = latest.current;
    latest.current = null;
    const live = elements.filter((el) => !el.isDeleted);
    try {
      localStorage.setItem(SCENE_KEY, serializeAsJSON(live, appState, {}, "local"));
    } catch (err) {
      console.error("Failed to save the scene", err);
    }
    const newFiles = Object.values(files).filter((f) => !savedFileIds.current.has(f.id));
    newFiles.forEach((f) => savedFileIds.current.add(f.id));
    saveFiles(newFiles);
  }, []);

  const onChange = useCallback(
    (elements, appState, files) => {
      latest.current = { elements, appState, files };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  useEffect(() => {
    window.wallpaper?.onMode((next) => {
      // save when going back to the background, before the UI is hidden
      if (next === "wallpaper") flush();
      document.body.dataset.mode = next;
      setMode(next);
    });
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [flush]);

  const uiOptions = useMemo(() => ({ canvasActions: { loadScene: false } }), []);
  const drawing = mode === "draw";

  const renderTopRightUI = useCallback(
    () =>
      drawing && (
        <button className="wp-back" onClick={() => window.wallpaper?.toggle()} title="Ctrl+Alt+D">
          Back to wallpaper
        </button>
      ),
    [drawing],
  );

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Excalidraw
        initialData={initialData}
        onChange={onChange}
        langCode="en"
        UIOptions={uiOptions}
        renderTopRightUI={renderTopRightUI}
        handleKeyboardGlobally
      />
    </div>
  );
};

createRoot(document.getElementById("root")).render(<App />);
startKeyBridge();
