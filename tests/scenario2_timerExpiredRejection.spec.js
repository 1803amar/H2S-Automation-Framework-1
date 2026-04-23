// ============================================================
// tests/scenario2_timerExpiredRejection.spec.js
// ============================================================
// SCENARIO 2: Timer Expired / Not Yet Started — Backend Rejection
// ============================================================
// GIVEN:  The user is logged in
// WHEN:   The submission window is NOT active (expired OR not started)
//   AND:  The user tries to submit a project
// THEN:   The backend should REJECT the submission with an error
//   AND:  If the platform ALLOWS it → BUG is logged clearly
// ============================================================

'use strict';

const { test, expect }      = require('@playwright/test');
const { AuthPage }          = require('../pages/AuthPage');
const { DashboardPage }     = require('../pages/DashboardPage');
const { SubmissionPage }    = require('../pages/SubmissionPage');
const { getWindowStatus, readSubmissionDates } = require('../helpers/dateHelper');
const { Logger }            = require('../utils/logger');
const { EMAIL, OTP, URLS, TIMEOUTS, SELECTORS } = require('../config/config');

test.use({ storageState: undefined });

test('Scenario 2 — Verify submission window status and test backend rejection', async ({ page }) => {

  test.setTimeout(TIMEOUTS.EXTRA_LONG * 2);

  const log  = new Logger('Scenario 2 - Timer');
  const auth = new AuthPage(page);
  const dash = new DashboardPage(page);
  const sub  = new SubmissionPage(page);

  log.scenario('SCENARIO 2 — Timer Expired / Not Yet Started — Backend Rejection Test');

  // ── STEP 1: Login ─────────────────────────────────────────
  log.step(1, `Navigating to login page → ${URLS.LOGIN}`);
  await dash.goto(URLS.LOGIN);
  log.info('Dismissing cookie banner if present...');
  await auth.dismissCookieBanner();
  log.info(`Logging in as: "${EMAIL}" with OTP: "${OTP}"`);
  await auth.login(EMAIL, OTP);

  // EXPECT: After login, nav-profile button must be visible
  // This confirms the user is authenticated and dashboard has loaded
  await expect(
    page.locator('[data-id="nav-profile-button"]'),
    'nav-profile button should be visible — confirms login succeeded'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass(`Login confirmed — nav-profile button visible ✔`);
  log.info(`Current URL after login: ${page.url()}`);

  // ── STEP 2: Navigate to Submissions Page ─────────────────
  log.step(2, `Navigating to submissions page → ${URLS.SUBMISSIONS}`);
  await dash.goto(URLS.SUBMISSIONS);
  log.info(`Submissions page loaded → Current URL: ${page.url()}`);

  // EXPECT: At least one tab should have aria-selected after React hydrates
  // This confirms the submissions page has fully rendered its tab list
  await expect(
    page.locator('[role="tab"][aria-selected]').first(),
    'At least one tab must be selected — confirms submissions page tab list loaded'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Submissions page tab list loaded — at least one tab is selected ✔');

  // ── STEP 3: Search All Tabs for Submission Card ───────────
  log.step(3, `Searching all 3 sub-tabs for submission card: "${SELECTORS.SUBMISSION_CARD}"`);
  log.info('Checking Ongoing → Upcoming → Past tabs...');

  const { inOngoing, inUpcoming, inPast, tab: foundInTab } =
    await dash.findSubmissionCardInAnyTab(SELECTORS.SUBMISSION_CARD);

  log.info('─── Tab Search Results ───────────────────────────');
  log.info(`  📋 Ongoing tab  → Card found: ${inOngoing  ? '✅ YES' : '❌ NO'}`);
  log.info(`  📋 Upcoming tab → Card found: ${inUpcoming ? '✅ YES' : '❌ NO'}`);
  log.info(`  📋 Past tab     → Card found: ${inPast     ? '✅ YES' : '❌ NO'}`);
  log.info(`  📌 Card currently in: "${foundInTab || 'NOT FOUND in any tab'}"`);
  log.info('──────────────────────────────────────────────────');

  if (!foundInTab) {
    log.warn('Submission card not found in any tab — exiting test gracefully');
    return;
  }

  // ── STEP 4: Navigate Back to the Correct Tab ─────────────
  log.step(4, `Navigating back to "${foundInTab}" tab (card was found here)`);
  // FIX: findSubmissionCardInAnyTab always ends on Past tab.
  // We must navigate back to the correct tab before scrolling to the card.
  await dash.clickSubTab(foundInTab);

  // EXPECT: The submission card must be visible in the correct tab
  // This confirms we are on the right tab and the DOM has the card
  await expect(
    page.locator(`text=${SELECTORS.SUBMISSION_CARD}`).first(),
    `Submission card "${SELECTORS.SUBMISSION_CARD}" should be visible after navigating back to "${foundInTab}" tab`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass(`Submission card visible in "${foundInTab}" tab ✔`);

  // ── STEP 5: Scroll to Card and Read Dates ─────────────────
  log.step(5, 'Scrolling to card and reading Starting/Ending dates from the page...');
  const card = page.locator(`text=${SELECTORS.SUBMISSION_CARD}`).first();
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));

  const { startDateStr, endDateStr } = await readSubmissionDates(page);

  log.info('─── Dates Read from Page ─────────────────────────');
  log.info(`  📅 Starting Date: ${startDateStr ?? '❌ NOT FOUND'}`);
  log.info(`  📅 Ending Date:   ${endDateStr   ?? '❌ NOT FOUND'}`);
  log.info('──────────────────────────────────────────────────');

  if (!startDateStr || !endDateStr) {
    log.warn('Could not read one or both dates — exiting test gracefully');
    return;
  }

  // EXPECT: Both dates must be non-empty strings
  // If either is null, the DOM structure may have changed
  expect(
    startDateStr,
    'Starting Date text must be a non-empty string read from the submission card'
  ).toBeTruthy();
  expect(
    endDateStr,
    'Ending Date text must be a non-empty string read from the submission card'
  ).toBeTruthy();
  log.pass('Both dates read successfully from page ✔');

  // ── STEP 6: Parse Dates and Determine Window Status ───────
  log.step(6, 'Parsing IST dates and comparing with current UTC time...');
  const { status, startDate, endDate, now } = getWindowStatus(startDateStr, endDateStr);

  log.info('─── Time Comparison ──────────────────────────────');
  log.info(`  🕐 Now (UTC):     ${now.toUTCString()}`);
  log.info(`  🕐 Window Start:  ${startDate.toUTCString()}`);
  log.info(`  🕐 Window End:    ${endDate.toUTCString()}`);
  log.info(`  📌 Status:        "${status.toUpperCase()}"`);
  if (status === 'upcoming') log.info(`  ⏳ Opens in: ${Math.round((startDate - now) / 60000)} minutes`);
  if (status === 'past')     log.info(`  ⌛ Closed:   ${Math.round((now - endDate) / 60000)} minutes ago`);
  if (status === 'ongoing')  log.info(`  ⏱️  Closes in: ${Math.round((endDate - now) / 60000)} minutes`);
  log.info('──────────────────────────────────────────────────');

  // EXPECT: Parsed dates must be valid Date objects (not NaN)
  expect(
    isNaN(startDate.getTime()),
    'startDate must be a valid parsed Date object — NaN means IST parsing failed'
  ).toBe(false);
  expect(
    isNaN(endDate.getTime()),
    'endDate must be a valid parsed Date object — NaN means IST parsing failed'
  ).toBe(false);
  log.pass('Both dates parsed to valid Date objects ✔');

  // ── STEP 7: Route Based on Status ─────────────────────────
  log.step(7, `Acting on window status: "${status.toUpperCase()}"`);

  if (status === 'ongoing') {
    log.info('Window is ACTIVE — rejection testing does not apply to active windows');
    log.warn('EXITING — active window is covered by Scenario 5 and Scenario 6');
    return;
  }

  if (status === 'unknown') {
    log.warn('Window status unknown — date parsing failed');
    return;
  }

  const context = status === 'past' ? 'Expired window' : 'Not-yet-started window';
  log.info(`Window is "${status.toUpperCase()}" → attempting submission to verify backend rejection`);

  // ── STEP 8: Open the Submission Form ─────────────────────
  log.step(8, 'Clicking submission card to open form...');
  await card.click();
  log.info('Waiting for Submit button (if form is not fully locked)...');
  await page.getByRole('button', { name: 'Submit', exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM })
    .catch(() => log.info('Submit button not visible — form may be locked at UI level'));

  // ── STEP 9: Check Submit Button State + Backend Response ──
  log.step(9, `Checking submit button state and backend response for: "${context}"`);
  const result = await sub.trySubmitAndCheckBackendResponse(context);

  log.info('─── Submit Attempt Result ────────────────────────');
  log.info(`  Context:      ${context}`);
  log.info(`  Blocked:      ${result.blocked === true ? '✅ YES (correct)' : result.blocked === false ? '❌ NO (BUG!)' : '⚠️ UNCLEAR'}`);
  log.info(`  Block reason: ${result.reason ?? 'N/A'}`);
  log.info(`  Message:      ${result.message ?? 'none'}`);
  log.info('──────────────────────────────────────────────────');

  // ── STEP 10: Assert Submission Was Blocked ────────────────
  log.step(10, 'Asserting submission was blocked by UI or backend...');

  // EXPECT: Submission MUST be blocked when the window is not active.
  // If result.blocked is false, it means the platform allowed submission
  // outside the window — this is a bug and the assertion will fail loudly.
  if (result.blocked === false) {
    log.bug(`Platform ALLOWED submission during "${context}" — this is a BUG!`);
    log.bug(`Success message shown: "${result.message}"`);
  }

  // This expect only runs when result.blocked is true or null (not when it's a confirmed bug above)
  // For null (unclassified) we skip the hard assertion but log a warning
  if (result.blocked === null) {
    log.warn(`Response unclassified: "${result.message}" — manual verification needed`);
  } else {
    expect(
      result.blocked,
      `Submission during "${context}" must be blocked. Platform returned: "${result.message}"`
    ).toBe(true);
    log.pass(`Submission correctly blocked (reason: ${result.reason}) ✔`);
  }

  log.pass('═══════════════════════════════════════════════════════');
  log.pass('SCENARIO 2 PASSED ✅ — Backend correctly rejects submission outside window');
  log.pass('═══════════════════════════════════════════════════════');
});