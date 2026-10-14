import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedSettings, setScript } from "./helpers";

test.describe("first run", () => {
  test("walks through the guide and lands in the editor with a sample script", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to SeeRead" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Voice tracking" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "The teleprompter window" })).toBeVisible();
    await page.getByRole("button", { name: "Start using SeeRead" }).click();

    await expect(page.getByRole("textbox", { name: "Script text" })).toContainText(
      "Welcome to SeeRead.",
    );
    await page.reload();
    await expect(page.getByRole("heading", { name: "Welcome to SeeRead" })).toBeHidden();
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});

test.describe("script editor", () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page);
    await page.goto("/");
  });

  test("accepts pasted scripts and counts spoken words separately", async ({ page }) => {
    await setScript(page, "Hello there everyone. [Smile.] Let us begin.");
    await expect(page.getByText("6 spoken words (7 incl. stage directions)")).toBeVisible();
    await expect(page.locator(".cm-annotation")).toHaveText("[Smile.]");
    await expect(page.getByLabel("Teleprompter preview").locator(".ann")).toHaveText("[Smile.]");
  });

  test("preserves Unicode and line breaks through copy", async ({ page }) => {
    const script = "Café naïve — “quoted”\n\nSecond paragraph 🎤 [note]";
    await setScript(page, script);
    await page.getByRole("button", { name: "Copy script" }).click();
    await expect(page.getByText("Script copied to the clipboard.")).toBeVisible();
    // The Windows clipboard hands text back with CRLF line endings.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replaceAll("\r\n", "\n")).toBe(script);
  });

  test("can leave stage directions out of copies", async ({ page }) => {
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("seeread.settings")!);
      s.annotations = { includeInCopy: false };
      localStorage.setItem("seeread.settings", JSON.stringify(s));
    });
    await page.reload();
    await setScript(page, "One. [cue] Two.");
    await page.getByRole("button", { name: "Copy script" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("One. Two.");
  });

  test("supports undo after a toolbar paste", async ({ page }) => {
    await setScript(page, "first");
    await page.evaluate(() => navigator.clipboard.writeText(" second"));
    await page.keyboard.press("End");
    await page.getByRole("button", { name: "Paste" }).click();
    const editor = page.getByRole("textbox", { name: "Script text" });
    await expect(editor).toHaveText("first second");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(editor).toHaveText("first");
  });

  test("offers to recover an autosaved draft after a restart", async ({ page }) => {
    await setScript(page, "Unsaved words that must survive a crash.");
    await expect(page.getByText(/Draft autosaved/)).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.getByText(/found an unsaved draft/)).toBeVisible();
    await page.getByRole("button", { name: "Restore draft" }).click();
    await expect(page.getByRole("textbox", { name: "Script text" })).toHaveText(
      "Unsaved words that must survive a crash.",
    );
  });

  test("finds and replaces text", async ({ page }) => {
    await setScript(page, "alpha beta alpha");
    await page.getByRole("button", { name: "Find & replace" }).click();
    await page.getByRole("textbox", { name: "Find" }).fill("alpha");
    await page.getByRole("textbox", { name: "Replace" }).fill("gamma");
    await page.getByRole("button", { name: "replace all" }).click();
    await expect(page.getByRole("textbox", { name: "Script text" })).toHaveText("gamma beta gamma");
  });
});

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
  });

  test("persist across reloads", async ({ page }) => {
    await page.getByRole("button", { name: "Automatic scrolling" }).click();
    await page.getByLabel("Scroll speed").fill("120");
    await page.reload();
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Automatic scrolling" }).click();
    await expect(page.getByLabel("Scroll speed")).toHaveValue("120");
  });

  test("record a global shortcut and flag conflicts", async ({ page }) => {
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await page.getByRole("button", { name: "Change shortcut for Stop" }).click();
    await page.keyboard.press("Control+Shift+Alt+KeyR"); // same as Restart
    await expect(page.getByRole("alert")).toContainText("Restart & Stop");
    await page.getByRole("button", { name: "Restore defaults" }).click();
    await expect(page.getByRole("alert")).toBeHidden();
  });

  test("rejects global shortcuts without a modifier", async ({ page }) => {
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await page.getByRole("button", { name: "Change shortcut for Stop" }).click();
    await page.keyboard.press("KeyQ");
    await expect(page.getByRole("alert")).toContainText("need a modifier");
  });

  test("custom stage-direction delimiters apply to the live preview", async ({ page }) => {
    await page.getByRole("button", { name: "Stage directions" }).click();
    await page.getByRole("button", { name: "( … )" }).click();
    const sample = page.getByLabel("Sample with stage directions marked");
    await expect(sample.locator("mark")).toContainText([
      "[Pause for two seconds and smile.]",
      "(Point at the chart.)",
    ]);
  });

  test("every settings section is accessible", async ({ page }) => {
    for (const section of [
      "Appearance",
      "Teleprompter window",
      "Automatic scrolling",
      "Voice tracking",
      "Stage directions",
      "Keyboard shortcuts",
      "Privacy & capture",
      "General",
    ]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(serious, section).toEqual([]);
    }
  });
});
