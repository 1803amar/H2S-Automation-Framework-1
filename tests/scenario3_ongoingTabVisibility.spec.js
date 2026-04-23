// ============================================================
// tests/scenario3_ongoingTabVisibility.spec.js
// ============================================================
// SCENARIO 3: Submission visible in Ongoing tab after page refresh
// ============================================================
// GIVEN:  The submission window is currently active (ongoing)
// WHEN:   The participant refreshes the page (simulates F5)
// THEN:   The submission module is STILL visible in the Ongoing tab
//
// Why this matters:
//   React SPA state resets on full reload. Push-notification iframes
//   can cause incomplete re-renders. This test catches any regression
//   where the Ongoing submission card disappears after a page refresh.
// ============================================================

'use strict';

const { test, expect }  = require('@playwright/test');
const { AuthPage }      = require('../pages/AuthPage');
const { DashboardPage } = require('../pages/DashboardPage');
const { Logger }        = require('../utils/logger');
const { EMAIL, OTP, URLS, TIMEOUTS, SELECTORS, TABS } = require('../config/config');

test.use({ storageState: undefined });

test('Scenario 3 — Submission visible in Ongoing tab after page refresh', async ({ page }) => {

  test.setTimeout(TIMEOUTS.EXTRA_LONG);

  const log  = new Logger('Scenario 3 - Ongoing Visibility');
  const auth = new AuthPage(page);
  const dash = new DashboardPage(page);

  // ─────────────────────────────────────────────────────────
  log.scenario('SCENARIO 3 — Submission Visible in Ongoing Tab After Page Refresh');
  // PURPOSE: Confirm that after a full page reload (F5), the submission card
  // that was visible in the Ongoing tab is still visible — not moved to
  // another tab or missing entirely.
  // ─────────────────────────────────────────────────────────

  // ── STEP 1: Navigate to Dashboard ─────────────────────────
  log.step(1, `Navigating to dashboard → ${URLS.DASHBOARD}`);
  await dash.goto(URLS.DASHBOARD);
  log.info(`Page loaded → Current URL: ${page.url()}`);

  // ── STEP 2: Cookie Banner ─────────────────────────────────
  log.step(2, 'Checking for cookie consent banner...');
  await auth.dismissCookieBanner();

  // ── STEP 3: Login ─────────────────────────────────────────
  log.step(3, `Logging in as: "${EMAIL}" with OTP: "${OTP}"`);
  await auth.login(EMAIL, OTP);
  log.info(`Login complete → Current URL: ${page.url()}`);

  // Wait for the dashboard main tablist to fully render after login
  log.info('Waiting for dashboard main tab list to be visible...');
  const tabList = await dash.waitForMainTabList();
  log.info('Dashboard tab list is ready ✔');

  // ── STEP 4: Navigate to Submissions Tab ───────────────────
  log.step(4, `Clicking main tab: "${TABS.SUBMISSIONS}"`);
  // WHY: The dashboard has multiple main tabs (Roadmap, Team Management,
  // Submissions, Forms, etc.). We must click Submissions first before
  // we can see the Ongoing/Upcoming/Past sub-tabs.
  await dash.clickMainTab(TABS.SUBMISSIONS, tabList);
  log.info(`"${TABS.SUBMISSIONS}" main tab is now selected ✔`);
  log.info('Waiting for Submissions panel content to fully render (CI runner may be slow)...');

  // CI FIX: After clicking the Submissions main tab, React renders the sub-tabs
  // and their content panels asynchronously. On GitHub Actions the JS execution
  // is 2-4x slower than local. We wait for the sub-tablist to be visible
  // (confirms the Submissions panel has rendered) before searching for cards.
  await expect(
    page.getByRole('tab', { name: TABS.ONGOING, exact: true }).first(),
    `"${TABS.ONGOING}" sub-tab must be visible — confirms Submissions panel has rendered`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass(`"${TABS.ONGOING}" sub-tab is visible — Submissions panel rendered ✔`);
  log.info('Sub-tabs (Ongoing / Upcoming / Past) are now visible and interactive');

  // ── STEP 5: Pre-Check — Find Card Across All Sub-Tabs ────
  log.step(5, `Pre-check: Searching all sub-tabs for card: "${SELECTORS.SUBMISSION_CARD}"`);
  // WHY: Before the main assertion, we check ALL three sub-tabs.
  // This gives us a clear failure reason if the card is in the wrong tab:
  //   - In Upcoming → window hasn't opened yet
  //   - In Past     → window already expired
  //   - Not found   → login or config issue
  // Without this check, the test would just say "card not visible" with no reason.
  log.info('Checking Ongoing tab...');
  log.info('Checking Upcoming tab...');
  log.info('Checking Past tab...');

  const { inOngoing, inUpcoming, inPast } =
    await dash.findSubmissionCardInAnyTab(SELECTORS.SUBMISSION_CARD);

  log.info('─── Pre-Check Tab Scan Results ───────────────────');
  log.info(`  📋 Ongoing tab  → "${SELECTORS.SUBMISSION_CARD}" found: ${inOngoing  ? '✅ YES' : '❌ NO'}`);
  log.info(`  📋 Upcoming tab → "${SELECTORS.SUBMISSION_CARD}" found: ${inUpcoming ? '✅ YES' : '❌ NO'}`);
  log.info(`  📋 Past tab     → "${SELECTORS.SUBMISSION_CARD}" found: ${inPast     ? '✅ YES' : '❌ NO'}`);
  log.info('──────────────────────────────────────────────────');

  // ── STEP 6: Validate Card is in Ongoing Before Refresh ────
  log.step(6, 'Validating submission card is in Ongoing tab (required before testing refresh)...');

  if (inUpcoming && !inOngoing) {
    log.fail('Card is in UPCOMING tab — submission window has NOT opened yet');
    log.fail('This test requires the window to be ACTIVE (Ongoing) to test refresh behavior');
    throw new Error('Submission is in Upcoming tab — submission window has not started yet.');
  }

  if (inPast && !inOngoing) {
    log.fail('Card is in PAST tab — submission window has ALREADY EXPIRED');
    log.fail('This test requires the window to be ACTIVE (Ongoing) to test refresh behavior');
    throw new Error('Submission is in Past tab — submission window has already closed.');
  }

  if (!inOngoing && !inUpcoming && !inPast) {
    log.fail('Card NOT FOUND in any tab (Ongoing, Upcoming, or Past)');
    log.fail('Possible causes: wrong EVENT_SLUG in config, login failed, or no submission module');
    throw new Error('Submission not found in any tab — check login and submission module.');
  }

  log.pass(`Submission card "${SELECTORS.SUBMISSION_CARD}" confirmed in Ongoing tab ✔`);
  log.info('Pre-check passed — proceeding to page refresh test');

  // ── STEP 7: Navigate Back to Ongoing Before Reload ────────
  log.step(7, 'Navigating to Ongoing tab before triggering page refresh...');
  // WHY: findSubmissionCardInAnyTab always ends on the Past tab (last checked).
  // We navigate back to Ongoing so the state is correct when we reload.
  await dash.clickSubTab(TABS.ONGOING);
  log.info(`"${TABS.ONGOING}" sub-tab is now selected ✔`);
  log.info('Submission card is currently visible in Ongoing tab — about to reload...');

  // ── STEP 8: Reload Page (Simulate F5) ─────────────────────
  log.step(8, 'Reloading the page to simulate F5 (full browser refresh)...');
  // WHY domcontentloaded: Using 'networkidle' would hang because push-notification
  // iframes on the H2S platform never fully close their network connections.
  // 'domcontentloaded' fires when the HTML is parsed — safe for React apps.
  log.info('Using waitUntil: domcontentloaded to avoid hanging on push-notification iframes');
  await dash.reloadAndRestoreNav();
  // reloadAndRestoreNav() does:
  //   1. page.reload({ waitUntil: 'domcontentloaded' })
  //   2. Waits for tablist to re-appear (React re-render guard)
  //   3. Clicks Submissions main tab
  //   4. Clicks Ongoing sub-tab
  log.info('Page reloaded and tab navigation restored ✔');
  log.info(`Current URL after reload: ${page.url()}`);
  log.info(`Currently on: Submissions → Ongoing tab`);

  // ── STEP 9: Assert Card Still Visible After Refresh ───────
  log.step(9, `Asserting submission card "${SELECTORS.SUBMISSION_CARD}" is still visible in Ongoing tab...`);
  // THIS IS THE MAIN ASSERTION of this test.
  // If the card disappeared after refresh, it means:
  //   - React state was lost on reload (regression)
  //   - The card moved to a different tab
  //   - The submission window expired during the test run
  const submissionCard = page.locator(`text=${SELECTORS.SUBMISSION_CARD}`);
  await expect(submissionCard).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass(`Card "${SELECTORS.SUBMISSION_CARD}" is still visible in Ongoing tab after page refresh ✔`);

  // ── FINAL SUMMARY ─────────────────────────────────────────
  log.pass('═══════════════════════════════════════════════════════════');
  log.pass('SCENARIO 3 PASSED ✅ — Submission card persists in Ongoing tab after F5 reload');
  log.pass('═══════════════════════════════════════════════════════════');
});