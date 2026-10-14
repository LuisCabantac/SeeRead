import { useEffect, useState } from "react";
import { Select, Toggle } from "../../components/fields";
import type { MonitorInfo } from "../../core/geometry";
import type { Settings } from "../../core/settings";
import { displayAccelerator } from "../../core/shortcuts";
import { patchSection } from "../../app/useSettings";
import { inTauri, isMac } from "../../services/env";
import { listMonitors, placeOverlayWindow } from "../../services/overlay";
import { getSettings } from "../../services/settings-store";

export function WindowSettings({ settings }: { settings: Settings }) {
  const o = settings.overlay;
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const refresh = () =>
    void listMonitors()
      .then(setMonitors)
      .catch(() => setMonitors([]));
  useEffect(refresh, []);

  const moveTo = async (name: string) => {
    await patchSection("overlay", { monitor: name || null, bounds: null });
    await placeOverlayWindow(getSettings());
  };

  return (
    <>
      <h2>Teleprompter window</h2>
      <fieldset className="fieldset">
        <legend>Display</legend>
        {inTauri ? (
          <>
            <Select
              label="Show on display"
              value={o.monitor ?? ""}
              options={[
                ["", "Primary display"],
                ...monitors.map((m, i): [string, string] => [
                  m.name ?? `display-${i}`,
                  `${m.name ?? `Display ${i + 1}`} — ${m.rect.width}×${m.rect.height}${m.scale !== 1 ? ` @ ${m.scale}×` : ""}`,
                ]),
              ]}
              onChange={(v) => void moveTo(v)}
            />
            <div className="row">
              <button onClick={refresh}>Refresh displays</button>
              <button onClick={() => void moveTo(o.monitor ?? "")}>Reset position and size</button>
            </div>
          </>
        ) : (
          <p className="muted">Display selection is available in the desktop app.</p>
        )}
        <p className="muted">
          Drag the teleprompter by its ⠿ handle and resize it from the bottom-right corner. Its
          position is remembered per display and restored when that display is connected.
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Behaviour</legend>
        <Toggle
          label="Always on top"
          checked={o.alwaysOnTop}
          onChange={(v) => void patchSection("overlay", { alwaysOnTop: v })}
        />
        <Toggle
          label="Click-through"
          checked={o.clickThrough}
          onChange={(v) => void patchSection("overlay", { clickThrough: v })}
          hint={
            <>
              Mouse clicks pass through the teleprompter to the windows behind it. To regain
              control, press{" "}
              <kbd>{displayAccelerator(settings.shortcuts.toggleClickThrough, isMac)}</kbd>, use the
              SeeRead tray menu, or the “Regain control” button in this window.
            </>
          }
        />
      </fieldset>
    </>
  );
}
