import { setupQueryInvalidationListener } from "@/lib/query-invalidation";
import { useEffect } from "react";

/**
 * Hook to set up cross-webview query invalidation listener.
 * Call this once at the root of each webview (App.tsx and TabContent.tsx).
 */
export function useQuerySync(): void {
  useEffect(() => {
    const unlistenPromise = setupQueryInvalidationListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
