/** Small labelled form controls. Every control has a programmatic label and optional hint. */
import { useId, type ReactNode } from "react";

interface Base {
  label: string;
  hint?: ReactNode;
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: Base & { checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      {hint && (
        <div className="hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit = "",
  format,
  onChange,
}: Base & {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?(v: number): string;
  onChange(v: number): void;
}) {
  const id = useId();
  const shown = format ? format(value) : `${value}${unit}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={shown}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output htmlFor={id}>{shown}</output>
      </div>
      {hint && (
        <div className="hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: Base & { value: T; options: [T, string][]; onChange(v: T): void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      {hint && (
        <div className="hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  maxLength = 200,
}: Base & { value: string; onChange(v: string): void; maxLength?: number }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <div className="hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Color({
  label,
  value,
  onChange,
}: Base & { value: string; onChange(v: string): void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <code>{value}</code>
      </div>
    </div>
  );
}
