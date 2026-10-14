import { useEffect, useState } from "react";
import { Select, Toggle } from "../../components/fields";
import type { MonitorInfo } from "../../core/geometry";
import type { Settings } from "../../core/settings";
import { displayAccelerator } from "../../core/shortcuts";
import { useDisplaySession } from "../../app/useDisplaySession";
import { patchSection } from "../../app/useSettings";
import { inTauri, isMac } from "../../services/env";
import { listMonitors, placeOverlayWindow } from "../../services/overlay";
import { isKde } from "../../services/session";
import { getSettings } from "../../services/settings-store";

export function WindowSettings({ settings }: { settings: Settings }) {
  const o = settings.overlay;
  const session = useDisplaySession();
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
        {inTauri && !session.windowPositioning ? (
          <>
            <p className="muted">
              Your desktop runs Wayland, which decides where windows open, so SeeRead can’t pick a
              display or restore a position. Drag it by its ⠿ handle where you want it; its size is
              remembered.
            </p>
            <div className="row">
              <button onClick={() => void moveTo(o.monitor ?? "")}>Reset size</button>
            </div>
          </>
        ) : inTauri ? (
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
        {session.windowPositioning && (
          <p className="muted">
            Drag the teleprompter by its ⠿ handle and resize it from the bottom-right corner. Its
            position is remembered per display and restored when that display is connected.
          </p>
        )}
      </fieldset>

      <fieldset className="fieldset">
        <legend>Behaviour</legend>
        <Toggle
          label="Always on top"
          checked={o.alwaysOnTop}
          onChange={(v) => void patchSection("overlay", { alwaysOnTop: v })}
          hint={
            session.keepAbove ? undefined : isKde(session) ? (
              <>
                Wayland doesn’t let apps keep themselves on top. In KDE Plasma, click the
                teleprompter, press <kbd>Alt+F3</kbd> and choose More Actions → Keep Above Others,
                or add a window rule for “SeeRead Teleprompter” in System Settings → Window
                Management → Window Rules.
              </>
            ) : (
              <>
                Wayland doesn’t let apps keep themselves on top, so this may be ignored. Your
                desktop’s window menu or window rules may offer an “Always on top” option.
              </>
            )
          }
        />
        <Toggle
          label="Click-through"
          checked={o.clickThrough}
          onChange={(v) => void patchSection("overlay", { clickThrough: v })}
          hint={
            <>
              Mouse clicks pass through the teleprompter to the windows behind it. To regain
              control,{" "}
              {session.globalShortcuts ? (
                <>
                  press{" "}
                  <kbd>{displayAccelerator(settings.shortcuts.toggleClickThrough, isMac)}</kbd>, use
                  the SeeRead tray menu,
                </>
              ) : (
                "use the SeeRead tray menu"
              )}{" "}
              or the “Regain control” button in this window.
            </>
          }
        />
      </fieldset>
    </>
  );
}
