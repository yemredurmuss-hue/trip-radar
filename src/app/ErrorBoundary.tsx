import { Component, type ErrorInfo, type ReactNode } from "react";
import { UpdateBanner } from "./UpdateBanner";

/** Never leave a blank page: show what broke so it can be reported, plus a way out. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; stack: string }> {
  state = { error: null as Error | null, stack: "" };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Trip Radar crashed:", error, info.componentStack);
    this.setState({ stack: info.componentStack ?? "" });
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    const report = `${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 6).join("\n")}\n${stack.split("\n").slice(0, 6).join("\n")}`;
    return (
      <div className="crash">
        <UpdateBanner />
        <h2>Pano açılırken bir hata oldu</h2>
        <p>Verilerin yerinde. Sayfayı yenilemeyi dene; tekrar olursa aşağıdaki metni kopyalayıp gönder.</p>
        <pre>{report}</pre>
        <div className="crash-actions">
          <button className="btn-primary" onClick={() => location.reload()}>
            Sayfayı yenile
          </button>
          <button className="btn-link" onClick={() => void navigator.clipboard.writeText(report)}>
            Hata metnini kopyala
          </button>
        </div>
      </div>
    );
  }
}

/** Errors outside React rendering (async code) show up as a thin banner instead of failing silently. */
export function installErrorBanner(): void {
  const show = (message: string) => {
    let bar = document.getElementById("error-banner");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "error-banner";
      bar.onclick = () => bar?.remove();
      document.body.appendChild(bar);
    }
    bar.textContent = `⚠ ${message} (kapatmak için tıkla)`;
  };
  window.addEventListener("error", (e) => show(e.message));
  window.addEventListener("unhandledrejection", (e) =>
    show(e.reason instanceof Error ? e.reason.message : String(e.reason)),
  );
}
