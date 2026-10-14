import { useMemo, useState } from "react";
import { Color, Select, TextInput, Toggle } from "../../components/fields";
import { parseAnnotations, type DelimiterPair, type UnmatchedPolicy } from "../../core/annotations";
import type { Settings } from "../../core/settings";
import { patchSection } from "../../app/useSettings";

const PRESETS: DelimiterPair[] = [
  { open: "[", close: "]" },
  { open: "(", close: ")" },
  { open: "{", close: "}" },
  { open: "<", close: ">" },
];

const SAMPLE =
  "Welcome to the presentation. [Pause for two seconds and smile.] Today we will discuss our results. (Point at the chart.) {Slide 3}";

const pairLabel = (p: DelimiterPair) => `${p.open} … ${p.close}`;

export function AnnotationSettings({ settings }: { settings: Settings }) {
  const a = settings.annotations;
  const set = (patch: Partial<Settings["annotations"]>) => void patchSection("annotations", patch);
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const [sample, setSample] = useState(SAMPLE);

  const has = (p: DelimiterPair) => a.pairs.some((x) => x.open === p.open && x.close === p.close);
  const togglePair = (p: DelimiterPair) =>
    set({
      pairs: has(p)
        ? a.pairs.filter((x) => !(x.open === p.open && x.close === p.close))
        : [...a.pairs, p],
    });
  const custom = a.pairs.filter(
    (p) => !PRESETS.some((q) => q.open === p.open && q.close === p.close),
  );

  const preview = useMemo(() => parseAnnotations(sample, a), [sample, a]);

  return (
    <>
      <h2>Stage directions</h2>
      <p className="muted">
        Text inside these delimiters stays visible in the teleprompter but is never expected to be
        spoken, so voice tracking skips straight over it.
      </p>

      <fieldset className="fieldset">
        <legend>Delimiters</legend>
        <div className="row" role="group" aria-label="Preset delimiters">
          {PRESETS.map((p) => (
            <button key={pairLabel(p)} aria-pressed={has(p)} onClick={() => togglePair(p)}>
              {pairLabel(p)}
            </button>
          ))}
        </div>
        {custom.map((p) => (
          <div className="row" key={pairLabel(p)}>
            <code>{pairLabel(p)}</code>
            <button
              className="danger"
              onClick={() => togglePair(p)}
              aria-label={`Remove ${pairLabel(p)}`}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="row">
          <label>
            Opening{" "}
            <input
              type="text"
              size={4}
              maxLength={8}
              value={open}
              onChange={(e) => setOpen(e.target.value)}
            />
          </label>
          <label>
            Closing{" "}
            <input
              type="text"
              size={4}
              maxLength={8}
              value={close}
              onChange={(e) => setClose(e.target.value)}
            />
          </label>
          <button
            disabled={!open.trim() || !close.trim() || has({ open, close })}
            onClick={() => {
              togglePair({ open, close });
              setOpen("");
              setClose("");
            }}
          >
            Add custom pair
          </button>
        </div>
        {a.pairs.length === 0 && !a.linePrefix && (
          <p className="notice warn">No delimiters are active, so all text is treated as spoken.</p>
        )}
        <TextInput
          label="Whole-line marker"
          value={a.linePrefix}
          maxLength={8}
          onChange={(v) => set({ linePrefix: v })}
          hint="Optional. Lines starting with this marker (e.g. >>) are stage directions. Leave empty to turn off."
        />
        <Toggle
          label="Allow nested delimiters"
          checked={a.allowNesting}
          onChange={(v) => set({ allowNesting: v })}
        />
        <Select<UnmatchedPolicy>
          label="Opening delimiter without a closing one"
          value={a.unmatched}
          options={[
            ["text", "Treat it as normal text"],
            ["toLineEnd", "Stage direction until the end of the line"],
            ["toEnd", "Stage direction until the end of the script"],
          ]}
          onChange={(v) => set({ unmatched: v })}
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Behaviour and style</legend>
        <Toggle
          label="Show stage directions"
          checked={a.visible}
          onChange={(v) => set({ visible: v })}
        />
        <Toggle
          label="Skip stage directions in voice tracking"
          checked={a.ignoreInMatching}
          onChange={(v) => set({ ignoreInMatching: v })}
        />
        <Toggle
          label="Include stage directions when copying"
          checked={a.includeInCopy}
          onChange={(v) => set({ includeInCopy: v })}
          hint="“Export clean copy” always leaves them out."
        />
        <Color label="Colour" value={a.color} onChange={(v) => set({ color: v })} />
        <Toggle label="Italic" checked={a.italic} onChange={(v) => set({ italic: v })} />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Try it</legend>
        <label htmlFor="ann-sample" className="visually-hidden">
          Sample text
        </label>
        <textarea
          id="ann-sample"
          rows={3}
          value={sample}
          onChange={(e) => setSample(e.target.value)}
        />
        <p
          aria-label="Sample with stage directions marked"
          className="annotation-sample"
          style={{
            color: settings.appearance.textColor,
            background: settings.appearance.backgroundColor,
          }}
        >
          {preview.map((s) =>
            s.kind === "annotation" ? (
              <mark
                key={s.start}
                style={{
                  color: a.color,
                  fontStyle: a.italic ? "italic" : "normal",
                  background: "transparent",
                }}
              >
                {sample.slice(s.start, s.end)}
              </mark>
            ) : (
              <span key={s.start}>{sample.slice(s.start, s.end)}</span>
            ),
          )}
        </p>
      </fieldset>
    </>
  );
}
