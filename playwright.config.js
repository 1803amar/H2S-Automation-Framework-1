// ============================================================
// playwright.config.js
// ============================================================
// Playwright Test configuration for the H2S Automation Framework.
//
// Key decisions:
//   - testDir points to /tests — all .spec.js files live there
//   - fullyParallel: false — H2S has shared session/cookie state
//     Running in parallel risks OTP conflicts on the same account
//   - workers: 1 — one test at a time to avoid login collisions
//   - screenshot, video, trace all ON for easy debugging of failures
//   - HTML reporter is human-friendly; 'dot' used on CI
//
// To run a single scenario:
//   npx playwright test tests/scenario1_validLogin.spec.js
//
// To run all scenarios:
//   npx playwright test
//
// To view the HTML report after run:
//   npx playwright show-report
// ============================================================

// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({

  // ── Test discovery ──────────────────────────────────────
  // All test files must be inside /tests and end with .spec.js
  testDir: './tests',

  // ── Parallelism ──────────────────────────────────────────
  // OFF — Hack2Skill shares OTP state; parallel runs on the same
  // account cause login race conditions and OTP conflicts.
  // Set to true only if you have separate accounts per worker.
  fullyParallel: false,

  // ── CI guard ──────────────────────────────────────────────
  // Prevents accidental test.only from blocking the entire CI run
  forbidOnly: !!process.env.CI,

  // ── Retries ───────────────────────────────────────────────
  // Retry failed tests once on CI to reduce flaky false negatives.
  // No retries locally so failures are visible immediately.
  retries: process.env.CI ? 1 : 0,

  // ── Workers ───────────────────────────────────────────────
  // 1 worker = sequential execution.
  // Increase only if using multiple test accounts.
  workers: 1,

  // ── Reporter ──────────────────────────────────────────────
  // 'html' gives a rich visual report locally.
  // CI environments should use 'dot' for compact output.
  reporter: process.env.CI ? 'dot' : 'html',

  // ── Shared test settings ──────────────────────────────────
  use: {
    // Base URL — allows page.goto('/login') shorthand in tests
    // Uncomment and set if you want relative URL navigation
    // baseURL: 'https://alphavision.hack2skill.com',

    // Collect a Playwright trace on first retry only.
    // Open with: npx playwright show-trace trace.zip
    trace: 'on-first-retry',

    // Capture a screenshot on every test failure for debugging
    screenshot: 'only-on-failure',

    // Record video on first retry — playback alongside trace
    video: 'on-first-retry',

    // Default navigation timeout (covers page.goto, page.reload)
    navigationTimeout: 30000,

    // Default action timeout (covers click, fill, waitFor*)
    actionTimeout: 15000,
  },

  // ── Browser projects ──────────────────────────────────────
  projects: [
    {
      // Primary browser: Desktop Chrome (Chromium)
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Always capture screenshot, video, and trace for every test run
        // These help debug failures without having to reproduce locally
        screenshot: 'on',
        video: 'on',
        trace: 'on',
      },
    },

    // Uncomment to add Firefox or WebKit cross-browser coverage:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Uncomment to test mobile viewports:
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 14'] },
    // },
  ],

  // ── Output folder ─────────────────────────────────────────
  // Where screenshots, videos, and traces are saved
  outputDir: 'test-results/',
});