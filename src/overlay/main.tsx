import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setWindowLabel } from "../services/bus";
import { OverlayApp } from "./OverlayApp";
import "../styles/base.css";
import "../styles/teleprompter.css";
import "../styles/overlay.css";

setWindowLabel("overlay");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
