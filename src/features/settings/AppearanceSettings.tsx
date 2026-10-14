import { Color, Select, Slider, TextInput, Toggle } from "../../components/fields";
import type { Align, HighlightStyle, Settings } from "../../core/settings";
import { patchSection } from "../../app/useSettings";

const FONTS: [string, string][] = [
  ["system-ui, sans-serif", "System sans-serif"],
  ["Georgia, 'Times New Roman', serif", "Serif"],
  ["Verdana, Tahoma, sans-serif", "Wide sans-serif (Verdana)"],
  ["'Atkinson Hyperlegible', Arial, sans-serif", "Atkinson Hyperlegible (if installed)"],
  ["ui-monospace, Menlo, Consolas, monospace", "Monospace"],
];

export function AppearanceSettings({ settings }: { settings: Settings }) {
  const a = settings.appearance;
  const set = (patch: Partial<Settings["appearance"]>) => void patchSection("appearance", patch);
  const knownFont = FONTS.some(([v]) => v === a.fontFamily);

  return (
    <>
      <h2>Appearance</h2>
      <fieldset className="fieldset">
        <legend>Text</legend>
        <Select
          label="Font"
          value={knownFont ? a.fontFamily : "custom"}
          options={[...FONTS, ["custom", "Custom…"]]}
          onChange={(v) => set({ fontFamily: v === "custom" ? a.fontFamily : v })}
        />
        {!knownFont && (
          <TextInput
            label="Custom font family"
            value={a.fontFamily}
            onChange={(v) => set({ fontFamily: v })}
            hint="Any CSS font-family list, e.g. “Inter, sans-serif”. The font must be installed."
          />
        )}
        <Slider
          label="Size"
          value={a.fontSize}
          min={16}
          max={160}
          unit=" px"
          onChange={(v) => set({ fontSize: v })}
        />
        <Slider
          label="Weight"
          value={a.fontWeight}
          min={300}
          max={900}
          step={100}
          onChange={(v) => set({ fontWeight: v })}
        />
        <Slider
          label="Line spacing"
          value={a.lineHeight}
          min={1}
          max={2.5}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set({ lineHeight: v })}
        />
        <Select<Align>
          label="Alignment"
          value={a.align}
          options={[
            ["left", "Left"],
            ["center", "Centre"],
            ["right", "Right"],
            ["justify", "Justified"],
          ]}
          onChange={(v) => set({ align: v })}
        />
        <Slider
          label="Side margins"
          value={a.marginPercent}
          min={0}
          max={40}
          unit="%"
          onChange={(v) => set({ marginPercent: v })}
        />
        <Color label="Text colour" value={a.textColor} onChange={(v) => set({ textColor: v })} />
        <Toggle
          label="Text outline"
          checked={a.textShadow}
          onChange={(v) => set({ textShadow: v })}
          hint="A dark halo keeps text readable over light and busy backgrounds."
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Background</legend>
        <Color
          label="Tint colour"
          value={a.backgroundColor}
          onChange={(v) => set({ backgroundColor: v })}
        />
        <Slider
          label="Tint opacity"
          value={Math.round(a.backgroundOpacity * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => set({ backgroundOpacity: v / 100 })}
          hint="0% is fully transparent; the desktop shows through."
        />
        <Toggle label="Border" checked={a.showBorder} onChange={(v) => set({ showBorder: v })} />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Reading aids</legend>
        <Toggle
          label="Reading guide"
          checked={a.showGuide}
          onChange={(v) => set({ showGuide: v })}
        />
        <Slider
          label="Guide position"
          value={a.guidePercent}
          min={5}
          max={90}
          unit="% from top"
          onChange={(v) => set({ guidePercent: v })}
        />
        <Select<HighlightStyle>
          label="Current word style"
          value={a.highlightStyle}
          options={[
            ["background", "Highlighted background"],
            ["underline", "Underline"],
            ["color", "Coloured text"],
          ]}
          onChange={(v) => set({ highlightStyle: v })}
        />
        <Color
          label="Highlight colour"
          value={a.highlightColor}
          onChange={(v) => set({ highlightColor: v })}
        />
        <Slider
          label="Upcoming words emphasised"
          value={a.upcomingWords}
          min={0}
          max={15}
          onChange={(v) => set({ upcomingWords: v })}
        />
        <Toggle
          label="Dim text already read"
          checked={a.dimReadText}
          onChange={(v) => set({ dimReadText: v })}
        />
        <Toggle
          label="Mirror horizontally"
          checked={a.mirrorHorizontal}
          onChange={(v) => set({ mirrorHorizontal: v })}
          hint="For beam-splitter teleprompter glass."
        />
        <Toggle
          label="Mirror vertically"
          checked={a.mirrorVertical}
          onChange={(v) => set({ mirrorVertical: v })}
        />
        <Toggle
          label="Show countdown"
          checked={a.showCountdown}
          onChange={(v) => set({ showCountdown: v })}
          hint="Uses the start delay from Automatic scrolling."
        />
        <Toggle
          label="Hide controls while reading"
          checked={a.hideControlsWhileReading}
          onChange={(v) => set({ hideControlsWhileReading: v })}
          hint="They reappear when you hover over the top of the teleprompter or tab to them."
        />
      </fieldset>
    </>
  );
}
