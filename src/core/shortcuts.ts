/**
 * Keyboard accelerators in the format Tauri's global-shortcut plugin understands
 * (e.g. `CommandOrControl+Shift+L`). Keys are W3C `KeyboardEvent.code` values with the
 * `Key`/`Digit` prefixes dropped, which the plugin parses case-insensitively.
 */

export interface KeyLike {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;
const MOD_ORDER = ["CommandOrControl", "Control", "Super", "Alt", "Shift"] as const;
type Modifier = (typeof MOD_ORDER)[number];

const MOD_ALIASES: Record<string, Modifier> = {
  commandorcontrol: "CommandOrControl",
  cmdorctrl: "CommandOrControl",
  commandorctrl: "CommandOrControl",
  cmdorcontrol: "CommandOrControl",
  control: "Control",
  ctrl: "Control",
  super: "Super",
  command: "Super",
  cmd: "Super",
  meta: "Super",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
};

export interface Accelerator {
  modifiers: Set<Modifier>;
  key: string;
}

const keyName = (code: string) => code.replace(/^Key(?=[A-Z]$)/, "").replace(/^Digit(?=\d$)/, "");

export function parseAccelerator(text: string): Accelerator | null {
  const parts = text
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  const key = parts.pop();
  if (!key || MOD_ALIASES[key.toLowerCase()]) return null;
  const modifiers = new Set<Modifier>();
  for (const part of parts) {
    const mod = MOD_ALIASES[part.toLowerCase()];
    if (!mod) return null;
    modifiers.add(mod);
  }
  return { modifiers, key: keyName(key.length === 1 ? key.toUpperCase() : key) };
}

export function formatAccelerator(acc: Accelerator): string {
  return [...MOD_ORDER.filter((m) => acc.modifiers.has(m)), acc.key].join("+");
}

/** Canonical form, so equal shortcuts compare equal as strings. */
export function normalizeAccelerator(text: string): string | null {
  const acc = parseAccelerator(text);
  return acc ? formatAccelerator(acc) : null;
}

/** Builds an accelerator from a key press, or null while only modifiers are held. */
export function eventToAccelerator(e: KeyLike, isMac: boolean): string | null {
  if (MODIFIER_CODES.test(e.code) || !e.code) return null;
  const modifiers = new Set<Modifier>();
  if (isMac ? e.metaKey : e.ctrlKey) modifiers.add("CommandOrControl");
  if (isMac && e.ctrlKey) modifiers.add("Control");
  if (!isMac && e.metaKey) modifiers.add("Super");
  if (e.altKey) modifiers.add("Alt");
  if (e.shiftKey) modifiers.add("Shift");
  return formatAccelerator({ modifiers, key: keyName(e.code) });
}

export function matchesAccelerator(e: KeyLike, accelerator: string, isMac: boolean): boolean {
  const pressed = eventToAccelerator(e, isMac);
  return pressed !== null && pressed === normalizeAccelerator(accelerator);
}

/** Global shortcuts need a modifier (or a function key) so they don't swallow typing. */
export function isSafeGlobalShortcut(accelerator: string): boolean {
  const acc = parseAccelerator(accelerator);
  if (!acc) return false;
  return acc.modifiers.size > 0 || /^F\d{1,2}$/.test(acc.key);
}

/** Groups actions that share the same accelerator. */
export function findConflicts(bindings: Record<string, string>): string[][] {
  const byAccel = new Map<string, string[]>();
  for (const [action, accel] of Object.entries(bindings)) {
    const norm = accel ? normalizeAccelerator(accel) : null;
    if (!norm) continue;
    byAccel.set(norm, [...(byAccel.get(norm) ?? []), action]);
  }
  return [...byAccel.values()].filter((actions) => actions.length > 1);
}

/** Human-readable label, e.g. `Ctrl+Shift+L` or `⌘⇧L`. */
export function displayAccelerator(accelerator: string, isMac: boolean): string {
  const acc = parseAccelerator(accelerator);
  if (!acc) return accelerator;
  const mac: Record<Modifier, string> = {
    CommandOrControl: "⌘",
    Control: "⌃",
    Super: "⌘",
    Alt: "⌥",
    Shift: "⇧",
  };
  const other: Record<Modifier, string> = {
    CommandOrControl: "Ctrl",
    Control: "Ctrl",
    Super: "Win",
    Alt: "Alt",
    Shift: "Shift",
  };
  const mods = MOD_ORDER.filter((m) => acc.modifiers.has(m)).map((m) => (isMac ? mac : other)[m]);
  const key = acc.key.replace(/^Arrow/, "");
  return isMac ? [...mods, key].join("") : [...mods, key].join("+");
}
