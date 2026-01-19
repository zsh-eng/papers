import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { queryClient } from "./query-client";

const QUERY_INVALIDATED_EVENT = "query-invalidated";

type QueryKey = readonly unknown[];

interface QueryInvalidationPayload {
  queryKey: QueryKey;
}

/**
 * Broadcast a query invalidation to all webviews.
 * This should be called after mutations to sync state across tabs.
 */
export function broadcastInvalidation(queryKey: QueryKey): void {
  emit(QUERY_INVALIDATED_EVENT, { queryKey });
}

/**
 * Set up a listener for query invalidation events from other webviews.
 * Returns an unsubscribe function.
 */
export function setupQueryInvalidationListener(): Promise<UnlistenFn> {
  return listen<QueryInvalidationPayload>(QUERY_INVALIDATED_EVENT, (event) => {
    queryClient.invalidateQueries({ queryKey: event.payload.queryKey });
  });
}
