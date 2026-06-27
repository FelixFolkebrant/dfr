import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function mountWebview(name: string, content: ReactNode): void {
  const app = document.querySelector<HTMLElement>("#app");

  if (!app) {
    throw new Error(`${name} app root was not found.`);
  }

  createRoot(app, {
    onUncaughtError(error) {
      app.textContent = `${name} failed to render: ${error instanceof Error ? error.message : String(error)}`;
    },
  }).render(content);
  app.dataset.webviewMounted = "true";
}
