// ============================================================
// tests/scenario1_validLogin.spec.js
// ============================================================
// SCENARIO 1: Valid Login and Logout
// ============================================================
// GIVEN:  The user visits the login page
// WHEN:   They enter a valid email and correct OTP
// THEN:   They are logged in and reach the dashboard
//   AND:  They can log out and be redirected to the home page
// ============================================================

'use strict';

const { test, expect }  = require('@playwright/test');
const { AuthPage }      = require('../pages/AuthPage');
const { Logger }        = require('../utils/logger');
const { EMAIL, OTP, URLS, TIMEOUTS } = require('../config/config');

// Isolate this test from any shared auth state
// Prevents cookie/session bleed if tests run in parallel
test.use({ storageState: undefined });

test('Scenario 1 — Valid login and logout', async ({ page }) => {

  test.setTimeout(TIMEOUTS.EXTRA_LONG);

  const log  = new Logger('Scenario 1 - Login');
  const auth = new AuthPage(page);

  // ─────────────────────────────────────────────────────────
  log.scenario('SCENARIO 1 — Valid Login and Logout');
  // PURPOSE: Verify that a valid user can:
  //   (a) land on the login page
  //   (b) dismiss the cookie banner
  //   (c) fill email + OTP and reach the dashboard
  //   (d) log out and be redirected to the home page
  // ─────────────────────────────────────────────────────────

  // ── STEP 1: Open Login Page ───────────────────────────────
  log.step(1, `Navigating to login page → ${URLS.LOGIN}`);
  // WHY networkidle: The cookie consent banner is rendered by an API call.
  // We wait for ALL network requests to settle so the banner is present
  // before we attempt to dismiss it.
  await page.goto(URLS.LOGIN, { waitUntil: 'networkidle' });
  log.info(`Page loaded successfully`);
  log.info(`Current URL: ${page.url()}`);

  // ── STEP 2: Cookie Banner Check ───────────────────────────
  log.step(2, 'Checking for cookie consent banner on the page...');
  // WHY: H2S shows a GDPR/consent banner on first visit to any page.
  // If this banner is not dismissed, it overlays the email input
  // and makes the Login button unclickable.
  // dismissCookieBanner() handles both cases:
  //   ✅ Banner found     → clicks Accept → waits for it to disappear
  //   ℹ️  Banner not found → skips silently (already accepted or not shown)
  await auth.dismissCookieBanner();

  // ── STEP 3: Fill Email and Request OTP ────────────────────
  log.step(3, `Filling login form with email: "${EMAIL}"`);
  log.info('About to fill email input and click the Login button...');
  log.info(`OTP that will be entered: "${OTP}" (static OTP for the sandbox test environment)`);
  // WHAT auth.login() does step by step:
  //   1️⃣  Waits for email input → fills it with EMAIL
  //   2️⃣  Waits for Login button to be visible + enabled → clicks it
  //   3️⃣  Waits for "Verify Your Account" heading (confirms OTP screen loaded)
  //       NOTE: The Login button is REMOVED from DOM at this point — we never wait for it again
  //   4️⃣  Confirms exactly 6 OTP input boxes are present
  //   5️⃣  Fills each digit of OTP into its corresponding input box
  //   6️⃣  Waits for Verify button → clicks it
  //   7️⃣  Waits for nav-profile button to confirm the dashboard fully loaded
  await auth.login(EMAIL, OTP);
  log.info('Login flow completed — checking dashboard state...');

  // ── STEP 4: Confirm Dashboard Loaded ──────────────────────
  log.step(4, 'Asserting dashboard is fully loaded after login...');
  // WHY this extra check: auth.login() already confirms nav-profile is visible.
  // This step is a second-level assertion at the TEST level to make the
  // test report clearly show "dashboard confirmed" as a separate step.
  // If the OTP was wrong or the server rejected it, this assertion fails here.
  await expect(page.locator('[data-id="nav-profile-button"]')).toBeVisible();
  log.pass('nav-profile button visible → User is logged in and dashboard has loaded ✔');
  log.info(`Current URL after login: ${page.url()}`);

  // ── STEP 5: Logout via Navbar ─────────────────────────────
  log.step(5, 'Opening profile dropdown and clicking Logout...');
  // WHAT auth.logout() does:
  //   1️⃣  Clicks the nav-profile button to open the user dropdown menu
  //   2️⃣  Looks for a link matching /^logout$/i (case-insensitive)
  //   3️⃣  Clicks Logout
  //   4️⃣  Asserts the URL is back to the root path "/" of the domain
  log.info('Clicking nav-profile → opening dropdown menu...');
  await auth.logout();

  // ── STEP 6: Verify Home Page Redirect ────────────────────
  log.step(6, 'Verifying URL after logout...');
  // WHAT WE EXPECT: URL should return to the home page root after logout.
  // Example: https://alphavision.hack2skill.com/
  // The URL assertion is done inside auth.logout() — we log the final state here.
  log.info(`Final URL after logout: ${page.url()}`);
  log.pass('User was redirected to home page "/" after logout ✔');

  // ── FINAL SUMMARY ─────────────────────────────────────────
  log.pass('═══════════════════════════════════════════════════════');
  log.pass('SCENARIO 1 PASSED ✅ — Login + OTP + Dashboard + Logout all working');
  log.pass('═══════════════════════════════════════════════════════');
});