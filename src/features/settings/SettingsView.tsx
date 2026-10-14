import { useState } from "react";
import type { Settings } from "../../core/settings";
import type { OverlayLink } from "../../app/useOverlayLink";
import { AnnotationSettings } from "../annotations/AnnotationSettings";
import { AutoScrollSettings } from "../auto-scroll/AutoScrollSettings";
import { VoiceSettings } from "../voice-tracking/VoiceSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { GeneralSettings } from "./GeneralSettings";
import { PrivacySettings } from "./PrivacySettings";
import { ShortcutSettings } from "./ShortcutSettings";
import { WindowSettings } from "./WindowSettings";

const SECTIONS = [
  ["appearance", "Appearance"],
  ["window", "Teleprompter window"],
  ["auto", "Automatic scrolling"],
  ["voice", "Voice tracking"],
  ["annotations", "Stage directions"],
  ["shortcuts", "Keyboard shortcuts"],
  ["privacy", "Privacy & capture"],
  ["general", "General"],
] as const;

type Section = (typeof SECTIONS)[number][0];

export function SettingsView({ settings, link }: { settings: Settings; link: OverlayLink }) {
  const [section, setSection] = useState<Section>("appearance");
  return (
    <div className="settings">
      <nav aria-label="Settings sections">
        {SECTIONS.map(([id, label]) => (
          <button key={id} aria-current={section === id} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </nav>
      <section aria-label={SECTIONS.find(([id]) => id === section)![1]}>
        {section === "appearance" && <AppearanceSettings settings={settings} />}
        {section === "window" && <WindowSettings settings={settings} />}
        {section === "auto" && <AutoScrollSettings settings={settings} />}
        {section === "voice" && (
          <VoiceSettings settings={settings} micBusy={link.status.mic !== "off"} />
        )}
        {section === "annotations" && <AnnotationSettings settings={settings} />}
        {section === "shortcuts" && (
          <ShortcutSettings settings={settings} failures={link.shortcutFailures} />
        )}
        {section === "privacy" && <PrivacySettings settings={settings} capture={link.capture} />}
        {section === "general" && <GeneralSettings settings={settings} />}
      </section>
    </div>
  );
}
