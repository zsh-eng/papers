import { broadcastInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { load } from "@tauri-apps/plugin-store";
import { useEffect, useMemo } from "react";

const STORE_KEY = "theme";

let storePromise: ReturnType<typeof load> | null = null;

// Tracks whether the theme change originated from this webview
let isLocalMutation = false;

function getStore() {
  if (!storePromise) {
    storePromise = load("settings.json", { autoSave: true, defaults: {} });
  }
  return storePromise;
}

type Theme = "dark" | "light";

/**
 * Query hook for fetching the current theme.
 */
export function useThemeQuery() {
  return useQuery({
    queryKey: queryKeys.theme(),
    queryFn: async (): Promise<Theme> => {
      const store = await getStore();
      const stored = await store.get<string>(STORE_KEY);
      if (stored === "dark" || stored === "light") {
        return stored;
      }
      // Default to system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    },
  });
}

/**
 * Mutation hook for toggling the theme.
 */
export function useToggleThemeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTheme: Theme) => {
      isLocalMutation = true;
      const store = await getStore();
      await store.set(STORE_KEY, newTheme);
    },
    onSuccess: () => {
      const queryKey = queryKeys.theme();
      queryClient.invalidateQueries({ queryKey });
      broadcastInvalidation(queryKey);
    },
  });
}

/**
 * Convenience hook that provides theme state and toggle function.
 * Also applies the theme to the DOM.
 */
export function useDarkMode() {
  const { data: theme, isLoading } = useThemeQuery();
  const { mutate: toggleTheme } = useToggleThemeMutation();

  const isDark = theme === "dark";
  const isLoaded = !isLoading;

  // Apply theme to DOM
  useEffect(() => {
    if (isLoading) return;

    const root = document.documentElement;

    // If this change came from another webview (broadcast), skip transitions
    if (!isLocalMutation) {
      root.classList.add("no-transition");
      // Force reflow to ensure the class is applied before toggling theme
      void root.offsetHeight;
    }

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Remove no-transition class and reset flag
    if (!isLocalMutation) {
      // Use requestAnimationFrame to ensure the theme change is painted first
      requestAnimationFrame(() => {
        root.classList.remove("no-transition");
      });
    }
    isLocalMutation = false;
  }, [isDark, isLoading]);

  const toggle = useMemo(
    () => () => {
      const newTheme = isDark ? "light" : "dark";
      toggleTheme(newTheme);
    },
    [isDark, toggleTheme],
  );

  return { isDark, toggle, isLoaded };
}
