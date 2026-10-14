import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWindowLabel } from "../services/bus";
import { App } from "./App";
import "../styles/base.css";
import "../styles/app.css";
import "../styles/teleprompter.css";

setWindowLabel("main");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
