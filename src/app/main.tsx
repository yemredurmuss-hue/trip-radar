import { createRoot } from "react-dom/client";
import { requestProcessing } from "../lib/browser";
import { lang, loadLang } from "../lib/i18n";
import { App } from "./App";
import { ErrorBoundary, installErrorBanner } from "./ErrorBoundary";

installErrorBanner();
// Opening the board also drains anything still waiting in the capture queue.
requestProcessing();
// The language first (stored choice, else the browser's), so nothing renders in the wrong one.
void loadLang().then(() => {
  document.documentElement.lang = lang();
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
});
// Changed on another board tab (or from Settings): this tab follows.
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area === "local" && "lang" in changes && changes.lang.newValue !== lang()) location.reload();
});
