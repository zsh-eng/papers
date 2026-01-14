import { useQuery } from "@tanstack/react-query";
import { listLibraryItems, type LibraryItem } from "@/lib/papers";

/**
 * Query hook for fetching library items from a directory.
 * Uses infinite caching - data is loaded once and cached indefinitely.
 */
export function useLibraryItemsQuery(directoryPath: string | null) {
  return useQuery({
    queryKey: ["libraryItems", directoryPath],
    queryFn: () => {
      if (!directoryPath) {
        return [] as LibraryItem[];
      }
      return listLibraryItems(directoryPath);
    },
    enabled: !!directoryPath,
  });
}
