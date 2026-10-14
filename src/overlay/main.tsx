import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWindowLabel } from "../services/bus";
import { logUncaughtErrors } from "../services/log";
import { OverlayApp } from "./OverlayApp";
import "../styles/base.css";
import "../styles/teleprompter.css";
import "../styles/overlay.css";

setWindowLabel("overlay");
logUncaughtErrors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
