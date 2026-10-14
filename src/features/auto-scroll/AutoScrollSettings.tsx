import { Select, Slider } from "../../components/fields";
import type { Settings } from "../../core/settings";
import { displayAccelerator } from "../../core/shortcuts";
import { patchSection } from "../../app/useSettings";
import { isMac } from "../../services/env";

const seconds = (ms: number) => (ms === 0 ? "Off" : `${(ms / 1000).toFixed(1)} s`);

export function AutoScrollSettings({ settings }: { settings: Settings }) {
  const a = settings.autoScroll;
  const set = (patch: Partial<Settings["autoScroll"]>) => void patchSection("autoScroll", patch);
  const keys = settings.shortcuts;
  return (
    <>
      <h2>Automatic scrolling</h2>
      <p className="muted">
        Scrolls at a steady pace without using the microphone. Change speed while reading with{" "}
        <kbd>↑</kbd>/<kbd>↓</kbd> in the teleprompter or{" "}
        <kbd>{displayAccelerator(keys.speedUp, isMac)}</kbd> /{" "}
        <kbd>{displayAccelerator(keys.speedDown, isMac)}</kbd> anywhere. Scroll with the mouse wheel
        to adjust the position at any time.
      </p>
      <fieldset className="fieldset">
        <legend>Speed</legend>
        <Slider
          label="Scroll speed"
          value={a.speed}
          min={5}
          max={600}
          step={5}
          unit=" px/s"
          onChange={(v) => set({ speed: v })}
        />
        <Slider
          label="Speed step"
          value={a.speedStep}
          min={1}
          max={50}
          unit=" px/s"
          onChange={(v) => set({ speedStep: v })}
        />
        <Slider
          label="Acceleration"
          value={a.rampMs}
          min={0}
          max={3000}
          step={100}
          format={seconds}
          onChange={(v) => set({ rampMs: v })}
          hint="Time to ease up to full speed, and to slow down before pauses and the end."
        />
      </fieldset>
      <fieldset className="fieldset">
        <legend>Timing</legend>
        <Slider
          label="Start delay"
          value={a.startDelayMs}
          min={0}
          max={10000}
          step={500}
          format={seconds}
          onChange={(v) => set({ startDelayMs: v })}
          hint="Applies to voice tracking too, and drives the countdown."
        />
        <Slider
          label="Pause between paragraphs"
          value={a.paragraphPauseMs}
          min={0}
          max={10000}
          step={250}
          format={seconds}
          onChange={(v) => set({ paragraphPauseMs: v })}
        />
        <Select
          label="At the end of the script"
          value={a.endBehavior}
          options={[
            ["stop", "Stop"],
            ["loop", "Loop back to the start"],
          ]}
          onChange={(v) => set({ endBehavior: v })}
        />
      </fieldset>
    </>
  );
}
