import { useEffect, useState } from "react";
import { Welcome } from "../features/first-run/Welcome";
import { ScriptView } from "../features/script-editor/ScriptView";
import { useScriptDocument } from "../features/script-editor/useScriptDocument";
import { SettingsView } from "../features/settings/SettingsView";
import { inTauri } from "../services/env";
import { setDebugLogging } from "../services/log";
import { updateSettings } from "../services/settings-store";
import { About } from "./About";
import { PlaybackBar } from "./PlaybackBar";
import { useOverlayLink } from "./useOverlayLink";
import { useSettings, useTheme } from "./useSettings";
import type { Settings } from "../core/settings";

type View = "script" | "settings" | "about";

export function App() {
  const { settings, loaded } = useSettings();
  useTheme(settings);
  useEffect(() => {
    if (inTauri && loaded) void setDebugLogging(settings.debugLogs);
  }, [loaded, settings.debugLogs]);
  if (!loaded) return <p className="welcome muted">Loading…</p>;
  return <Shell settings={settings} />;
}

function Shell({ settings }: { settings: Settings }) {
  const [view, setView] = useState<View>("script");
  const doc = useScriptDocument(settings, !settings.firstRunComplete);
  const link = useOverlayLink(doc.text, settings);

  if (!settings.firstRunComplete) {
    return (
      <Welcome onDone={() => void updateSettings((s) => ({ ...s, firstRunComplete: true }))} />
    );
  }

  const tab = (id: View, label: string) => (
    <button aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>SeeRead</h1>
        <nav className="tabs" aria-label="Main">
          {tab("script", "Script")}
          {tab("settings", "Settings")}
          {tab("about", "About")}
        </nav>
        <PlaybackBar link={link} settings={settings} />
      </header>

      <div className="banner-area">
        {doc.recovery && (
          <div className="notice warn" role="alert">
            <span>
              SeeRead found an unsaved draft from {new Date(doc.recovery.savedAt).toLocaleString()}.
              Restore it?
            </span>
            <button className="primary" onClick={doc.restoreDraft}>
              Restore draft
            </button>
            <button onClick={() => void doc.discardDraft()}>Discard</button>
          </div>
        )}
        {doc.message && (
          <div className={`notice ${doc.message.kind === "error" ? "error" : ""}`} role="status">
            <span>{doc.message.text}</span>
            <button onClick={doc.dismissMessage} aria-label="Dismiss message">
              ✕
            </button>
          </div>
        )}
        {link.status.error && (
          <div className="notice error" role="alert">
            <span>{link.status.error}</span>
            {settings.mode === "voice" && (
              <button onClick={() => setView("settings")}>Voice settings</button>
            )}
          </div>
        )}
        {link.shortcutFailures.length > 0 && (
          <div className="notice warn" role="status">
            <span>
              Some global shortcuts could not be registered (another app may be using them):{" "}
              {link.shortcutFailures.join(", ")}.
            </span>
            <button onClick={() => setView("settings")}>Change shortcuts</button>
          </div>
        )}
      </div>

      <main className="app-main">
        {view === "script" && <ScriptView doc={doc} settings={settings} />}
        {view === "settings" && <SettingsView settings={settings} link={link} />}
        {view === "about" && <About />}
      </main>
    </div>
  );
}
