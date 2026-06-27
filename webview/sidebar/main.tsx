import { createRoot } from "react-dom/client";

import { Sidebar } from "./Sidebar";

const app = document.querySelector("#app");

if (!app) {
  throw new Error("Sidebar app root was not found.");
}

createRoot(app).render(<Sidebar />);
