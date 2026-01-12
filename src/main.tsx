import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { TabContent } from "./TabContent.tsx"

// Determine if this is the shell (main webview) or a tab webview
// Tab webviews are loaded with /tab?type=... URL
const isTabWebview = window.location.pathname === "/tab" || window.location.search.includes("type=");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isTabWebview ? <TabContent /> : <App />}
  </StrictMode>
)
