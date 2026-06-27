import { createRoot } from "react-dom/client";

import { DiffPanel } from "./DiffPanel";

const app = document.querySelector("#app");

if (!app) {
  throw new Error("Diff panel app root was not found.");
}

createRoot(app).render(<DiffPanel />);
