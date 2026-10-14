import { describe, expect, it } from "vitest";
import {
  displayAccelerator,
  eventToAccelerator,
  findConflicts,
  isSafeGlobalShortcut,
  matchesAccelerator,
  normalizeAccelerator,
} from "../../src/core/shortcuts";

const key = (
  code: string,
  mods: Partial<Record<"ctrl" | "meta" | "alt" | "shift", boolean>> = {},
) => ({
  code,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
});

describe("shortcuts", () => {
  it("normalizes aliases and modifier order", () => {
    expect(normalizeAccelerator("shift+cmdorctrl+l")).toBe("CommandOrControl+Shift+L");
    expect(normalizeAccelerator("Ctrl+Option+KeyA")).toBe("Control+Alt+A");
    expect(normalizeAccelerator("Digit5")).toBe("5");
    expect(normalizeAccelerator("Shift+")).toBeNull();
    expect(normalizeAccelerator("Hyper+A")).toBeNull();
    expect(normalizeAccelerator("Shift")).toBeNull();
  });

  it("builds accelerators from key events per platform", () => {
    expect(eventToAccelerator(key("KeyL", { ctrl: true, shift: true }), false)).toBe(
      "CommandOrControl+Shift+L",
    );
    expect(eventToAccelerator(key("KeyL", { meta: true, shift: true }), true)).toBe(
      "CommandOrControl+Shift+L",
    );
    expect(eventToAccelerator(key("ArrowUp", { alt: true }), false)).toBe("Alt+ArrowUp");
    expect(eventToAccelerator(key("ShiftLeft", { shift: true }), false)).toBeNull();
  });

  it("matches events against stored accelerators", () => {
    expect(matchesAccelerator(key("Space"), "Space", false)).toBe(true);
    expect(matchesAccelerator(key("Space", { shift: true }), "Space", false)).toBe(false);
    expect(matchesAccelerator(key("KeyR", { ctrl: true }), "CmdOrCtrl+R", false)).toBe(true);
  });

  it("requires a modifier for global shortcuts unless it is a function key", () => {
    expect(isSafeGlobalShortcut("L")).toBe(false);
    expect(isSafeGlobalShortcut("F9")).toBe(true);
    expect(isSafeGlobalShortcut("Alt+L")).toBe(true);
    expect(isSafeGlobalShortcut("nonsense+")).toBe(false);
  });

  it("detects conflicting bindings regardless of spelling", () => {
    expect(
      findConflicts({ play: "Ctrl+Shift+P", stop: "shift+control+p", restart: "Alt+R", none: "" }),
    ).toEqual([["play", "stop"]]);
  });

  it("formats for display", () => {
    expect(displayAccelerator("CommandOrControl+Shift+ArrowUp", false)).toBe("Ctrl+Shift+Up");
    expect(displayAccelerator("CommandOrControl+Shift+L", true)).toBe("⌘⇧L");
  });
});
