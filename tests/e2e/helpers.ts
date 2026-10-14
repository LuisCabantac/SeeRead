import type { Page } from "@playwright/test";

/** Seeds settings so tests start past the first-run guide (unless told otherwise). */
export async function seedSettings(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript(
    (value) => {
      if (!localStorage.getItem("seeread.settings")) {
        localStorage.setItem("seeread.settings", JSON.stringify(value));
      }
    },
    { firstRunComplete: true, ...settings },
  );
}

/** Replaces the editor contents the way a user would: select all, then type/paste. */
export async function setScript(page: Page, text: string) {
  const editor = page.getByRole("textbox", { name: "Script text" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press("ControlOrMeta+v");
}
