import { defineConfig } from "@playwright/test";

const tablet = (browserName, width, height) => ({
  name: `${browserName}-${width}x${height}`,
  use: {
    browserName,
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: true,
    ...(browserName === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
      : {})
  }
});

export default defineConfig({
  testDir: "./browser-test",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    tablet("webkit", 1112, 834),
    tablet("webkit", 1024, 768),
    tablet("chromium", 1112, 834),
    tablet("chromium", 1024, 768)
  ]
});
