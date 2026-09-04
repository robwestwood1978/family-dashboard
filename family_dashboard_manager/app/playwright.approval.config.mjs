import { defineConfig } from "@playwright/test";

const approvalViewport = (browserName, width, height) => ({
  name: `approval-${browserName}-${width}x${height}`,
  use: {
    browserName,
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: true
  }
});

export default defineConfig({
  testDir: "./browser-test",
  testMatch: "family-hub-card.spec.mjs",
  grep: /v0\.9 design approval/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/v090-approval",
  use: {
    headless: true,
    trace: "retain-on-failure"
  },
  projects: [
    approvalViewport("chromium", 1024, 768),
    approvalViewport("chromium", 1112, 834),
    approvalViewport("webkit", 1024, 768),
    approvalViewport("webkit", 1112, 834)
  ]
});
