import { createRoot } from "react-dom/client";
import { installPartnerLinks } from "../lib/affiliate";
import { requestProcessing } from "../lib/browser";
import { L, lang, loadLang } from "../lib/i18n";
import { reloadIfStale } from "../lib/update";
import { App } from "./App";
import { ErrorBoundary, installErrorBanner } from "./ErrorBoundary";

installErrorBanner();
// A partner brand's page opened from the board goes through the partner link, only as it's clicked (affiliate.ts).
installPartnerLinks();
// The language first (stored choice, else the browser's), so nothing renders in the wrong one. And
// files newer than the loaded extension (the updater just swapped them) reload it before the database
// is opened: the old version still holds it.
void Promise.all([loadLang(), reloadIfStale(location.hash)]).then(([, updating]) => {
  document.documentElement.lang = lang();
  const root = createRoot(document.getElementById("root")!);
  if (updating) return root.render(<p className="board-updating">{L("Trip Radar güncelleniyor…", "Updating Trip Radar…")}</p>);
  // Opening the board also drains anything still waiting in the capture queue.
  requestProcessing();
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
});
// Changed on another board tab (or from Settings): this tab follows.
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area === "local" && "lang" in changes && changes.lang.newValue !== lang()) location.reload();
});
