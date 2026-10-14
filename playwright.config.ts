import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the web UI in Chromium. Outside the Tauri shell SeeRead falls back
 * to localStorage, a BroadcastChannel between windows and a recorded demo recognizer, so
 * the editor, settings, overlay playback and voice-tracking UI run without native code.
 * Native behaviour (window flags, microphone, capture exclusion) is covered separately;
 * see docs/development/testing.md.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "retain-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
