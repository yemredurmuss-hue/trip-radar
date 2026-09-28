import { createRoot } from "react-dom/client";
import { requestProcessing } from "../lib/browser";
import { App } from "./App";
import { ErrorBoundary, installErrorBanner } from "./ErrorBoundary";

installErrorBanner();
// Opening the board also drains anything still waiting in the capture queue.
requestProcessing();
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
