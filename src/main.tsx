import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import App from "./App.tsx";
import { TabContent } from "./TabContent.tsx";
import { queryClient } from "./lib/query-client.ts";
import { CommandRegistryProvider } from "./lib/commands/registry.tsx";

// Determine if this is the shell (main webview) or a tab webview
// Tab webviews are loaded with /tab?type=... URL
const isTabWebview =
  window.location.pathname === "/tab" ||
  window.location.search.includes("type=");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CommandRegistryProvider>
        {isTabWebview ? <TabContent /> : <App />}
      </CommandRegistryProvider>
    </QueryClientProvider>
  </StrictMode>,
);
