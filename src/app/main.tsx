import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWindowLabel } from "../services/bus";
import { logUncaughtErrors } from "../services/log";
import { App } from "./App";
import "../styles/base.css";
import "../styles/app.css";
import "../styles/teleprompter.css";

setWindowLabel("main");
logUncaughtErrors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
