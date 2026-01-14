import { useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";
import { emit, listen } from "@tauri-apps/api/event";

const STORE_KEY = "theme";
const THEME_CHANGE_EVENT = "theme-changed";

let storePromise: ReturnType<typeof load> | null = null;

function getStore() {
  if (!storePromise) {
    storePromise = load("settings.json", { autoSave: true, defaults: {} });
  }
  return storePromise;
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // Fallback to system preference, will sync with store in useEffect
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial value from store
  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        const store = await getStore();
        const stored = await store.get<string>(STORE_KEY);
        if (mounted && stored !== undefined) {
          setIsDark(stored === "dark");
        }
      } finally {
        if (mounted) {
          setIsLoaded(true);
        }
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for theme changes from other webviews
  useEffect(() => {
    const unlisten = listen<string>(THEME_CHANGE_EVENT, (event) => {
      setIsDark(event.payload === "dark");
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Apply dark mode class and persist to store
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Only persist after initial load to avoid overwriting store with default
    if (isLoaded) {
      const theme = isDark ? "dark" : "light";

      getStore().then((store) => {
        store.set(STORE_KEY, theme);
      });

      // Broadcast to other webviews
      emit(THEME_CHANGE_EVENT, theme);
    }
  }, [isDark, isLoaded]);

  const toggle = () => setIsDark((prev) => !prev);

  return { isDark, toggle, isLoaded };
}
