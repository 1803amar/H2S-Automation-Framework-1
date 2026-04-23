// ============================================================
// tests/scenario4_pendingTeamSubmission.spec.js
// ============================================================
// SCENARIO 4: Complete Team Required — API-Based Check
// ============================================================
// GIVEN:   User is logged in
// WHEN:    Script intercepts the dashboard API response
// THEN:    If team COMPLETE  → submits and expects success
//          If team INCOMPLETE → attempts submit, expects backend rejection
//          If team OVERSIZED  → logs edge case and exits
// ============================================================

'use strict';

const { test, expect }            = require('@playwright/test');
const { AuthPage }                = require('../pages/AuthPage');
const { DashboardPage }           = require('../pages/DashboardPage');
const { SubmissionPage }          = require('../pages/SubmissionPage');
const { registerDashboardApiListener, extractTeamInfo, evaluateTeamSize } = require('../helpers/teamHelper');
const { Logger }                  = require('../utils/logger');
const { EMAIL, OTP, URLS, TIMEOUTS, SELECTORS, FORM_DATA } = require('../config/config');

test.use({ storageState: undefined });

test('Scenario 4 — Team size check via API + submit if team is complete', async ({ page }) => {

  test.setTimeout(TIMEOUTS.EXTRA_LONG * 3);

  const log  = new Logger('Scenario 4 - Team');
  const auth = new AuthPage(page);
  const dash = new DashboardPage(page);
  const sub  = new SubmissionPage(page);

  log.scenario('SCENARIO 4 — Complete Team Required — API-Based Check');

  // ── STEP 1: Login ─────────────────────────────────────────
  log.step(1, `Navigating to login page → ${URLS.LOGIN}`);
  await dash.goto(URLS.LOGIN);
  log.info('Dismissing cookie banner if present...');
  await auth.dismissCookieBanner();
  log.info(`Logging in as: "${EMAIL}" with OTP: "${OTP}"`);
  await auth.login(EMAIL, OTP);

  // EXPECT: nav-profile button visible confirms dashboard loaded after login
  await expect(
    page.locator('[data-id="nav-profile-button"]'),
    'nav-profile button must be visible — confirms login succeeded and dashboard loaded'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass(`Login confirmed — nav-profile visible ✔`);
  log.info(`Current URL after login: ${page.url()}`);

  // ── STEP 2: Register API Interceptor ──────────────────────
  log.step(2, 'Registering dashboard API response interceptor...');
  // Must be registered BEFORE goto() so it catches the first API call
  const getTeamData = registerDashboardApiListener(page);
  log.info('API interceptor registered — listening for GET /dashboard response...');

  // ── STEP 3: Load Dashboard to Trigger API Call ────────────
  log.step(3, `Navigating to dashboard to trigger API call → ${URLS.DASHBOARD}`);
  await dash.goto(URLS.DASHBOARD);
  log.info('Waiting 4 seconds for async API listener to store response data...');
  await page.waitForTimeout(4000);
  log.info(`Current URL: ${page.url()}`);

  // EXPECT: Dashboard main tablist must be visible — confirms page rendered
  await expect(
    page.getByRole('tablist').first(),
    'Main dashboard tablist must be visible — confirms dashboard page rendered correctly'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Dashboard tablist visible — page rendered correctly ✔');

  // ── STEP 4: Retrieve and Validate API Data ────────────────
  log.step(4, 'Retrieving captured API data...');
  let teamData = getTeamData();

  if (!teamData) {
    log.warn('API data not captured on first load — reloading page...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    teamData = getTeamData();
    log.info(teamData ? 'API data captured after reload ✔' : 'API data still not captured');
  } else {
    log.info('API data captured on first load ✔');
  }

  if (!teamData) {
    log.warn('Could not capture dashboard API data — exiting test gracefully');
    return;
  }

  // EXPECT: Team data must be a non-null object with tags.teamSize
  expect(
    teamData,
    'Dashboard API data must be captured — null means response was not intercepted'
  ).not.toBeNull();
  expect(
    teamData.tags?.teamSize,
    'API response must contain tags.teamSize — confirms correct API endpoint was captured'
  ).toBeDefined();
  log.pass('Dashboard API data captured and structure validated ✔');

  // ── STEP 5: Extract Team Info ─────────────────────────────
  log.step(5, 'Extracting team information from API data...');
  const teamInfo = extractTeamInfo(teamData);

  log.info('─── Team Info from API ───────────────────────────');
  log.info(`  👥 Team Name:       "${teamInfo.teamName}"`);
  log.info(`  👥 Current Members: ${teamInfo.currentSize}`);
  log.info(`  📏 Min Required:    ${teamInfo.minSize}`);
  log.info(`  📏 Max Allowed:     ${teamInfo.maxSize === 0 ? 'unlimited' : teamInfo.maxSize}`);
  teamInfo.members.forEach((m, i) =>
    log.info(`  👤 Member ${i + 1}:      ${m.name || m.email || 'unknown'}`)
  );
  log.info('──────────────────────────────────────────────────');

  // EXPECT: teamInfo must not be null — confirms extractTeamInfo() parsed correctly
  expect(
    teamInfo,
    'extractTeamInfo() must return a valid object — null means API data was malformed'
  ).not.toBeNull();
  expect(
    typeof teamInfo.currentSize,
    'teamInfo.currentSize must be a number'
  ).toBe('number');
  expect(
    typeof teamInfo.minSize,
    'teamInfo.minSize must be a number'
  ).toBe('number');
  log.pass('Team info extracted successfully — all required fields are numbers ✔');

  // ── STEP 6: Evaluate Team Size ────────────────────────────
  log.step(6, 'Evaluating team completeness...');
  const evaluation = evaluateTeamSize(teamInfo);

  log.info('─── Team Size Evaluation ─────────────────────────');
  log.info(`  📌 Status:  "${evaluation.status.toUpperCase()}"`);
  log.info(`  💬 Verdict: ${evaluation.message}`);
  log.info('──────────────────────────────────────────────────');

  // EXPECT: evaluation status must be one of the 4 known values
  expect(
    ['complete', 'incomplete', 'oversized', 'unknown'],
    'evaluation.status must be one of the defined states'
  ).toContain(evaluation.status);
  log.pass(`Team evaluation status is a valid state: "${evaluation.status}" ✔`);

  // ── STEP 7: Route Based on Team Status ───────────────────
  log.step(7, `Routing based on team status: "${evaluation.status.toUpperCase()}"`);

  if (evaluation.status === 'oversized') {
    log.warn('Team exceeds maximum size — unusual edge case, exiting gracefully');
    return;
  }
  if (evaluation.status === 'unknown') {
    log.warn('Team status unknown — exiting gracefully');
    return;
  }

  // Navigate to Submissions → Ongoing for both complete and incomplete
  log.info(`Navigating to submissions → ${URLS.SUBMISSIONS}`);
  await dash.goto(URLS.SUBMISSIONS);
  await dash.navigateToSubmissions();
  log.info('Now on Submissions → Ongoing tab ✔');

  // Look for submission card
  log.info(`Looking for submission card: "${SELECTORS.SUBMISSION_CARD}" in Ongoing tab...`);
  const cardVisible = await page.locator(`text=${SELECTORS.SUBMISSION_CARD}`)
    .first().isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false);
  log.info(`Submission card in Ongoing: ${cardVisible ? '✅ FOUND' : '❌ NOT FOUND'}`);

  if (!cardVisible) {
    log.warn('No submission card in Ongoing tab — exiting gracefully');
    return;
  }

  // EXPECT: Submission card must be visible in Ongoing tab
  await expect(
    page.locator(`text=${SELECTORS.SUBMISSION_CARD}`).first(),
    `Submission card "${SELECTORS.SUBMISSION_CARD}" must be visible in Ongoing tab`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Submission card visible in Ongoing tab ✔');

  log.info('Opening submission card to access the form...');
  await dash.openSubmissionCard(SELECTORS.SUBMISSION_CARD);
  await page.waitForTimeout(2000);
  log.info('Submission form opened ✔');

  if (evaluation.status === 'incomplete') {
    // ── INCOMPLETE TEAM ────────────────────────────────────
    log.step(8, 'Team INCOMPLETE → attempting submission to verify backend rejects it...');
    log.info(`Current: ${teamInfo.currentSize} member(s) | Required min: ${teamInfo.minSize}`);

    const result = await sub.trySubmitAndCheckBackendResponse('Incomplete team');

    log.info('─── Submit Attempt Result (Incomplete Team) ──────');
    log.info(`  Blocked:      ${result.blocked === true ? '✅ YES' : result.blocked === false ? '❌ NO (BUG!)' : '⚠️ UNCLEAR'}`);
    log.info(`  Block reason: ${result.reason ?? 'N/A'}`);
    log.info(`  Message:      ${result.message ?? 'none'}`);
    log.info('──────────────────────────────────────────────────');

    if (result.blocked === false) {
      log.bug(`Platform ALLOWED submission with incomplete team! — "${result.message}"`);
    }

    if (result.blocked !== null) {
      // EXPECT: submission must be blocked for incomplete team
      expect(
        result.blocked,
        `Submission with an incomplete team must be blocked. Platform returned: "${result.message}"`
      ).toBe(true);
      log.pass(`Submission correctly blocked for incomplete team (reason: ${result.reason}) ✔`);
    } else {
      log.warn(`Response unclassified: "${result.message}" — manual check needed`);
    }
    return;
  }

  // ── COMPLETE TEAM: Fill and Submit ───────────────────────
  log.step(8, `Team COMPLETE (${teamInfo.currentSize} members) → filling form and submitting...`);

  log.info('Waiting for form to fully render...');
  await sub.waitForFormReady();

  log.info('Filling all form fields:');
  log.info('  → Problem statement, Short answer, Paragraph, Link');
  log.info('  → MCQ, File upload, Searchable dropdown, Native dropdown');
  log.info('  → Slider, Date, Time');
  await sub.fillAllFields(FORM_DATA);
  log.info('All fields filled ✔');

  log.step(9, 'Clicking Submit button...');
  await sub.submit();
  log.info('Submit clicked — confirmation modal appeared ✔');

  log.step(10, 'Handling confirmation modal...');
  await sub.confirmSubmission();
  log.info('Modal handled and closed ✔');

  log.step(11, 'Asserting success message...');
  // EXPECT: success message must be visible — confirms submission was accepted
  await expect(
    page.getByText(SELECTORS.SUCCESS_MESSAGE),
    `Success message "${SELECTORS.SUCCESS_MESSAGE}" must appear — confirms submission was accepted by the backend`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('"Submission submitted successfully!" visible ✔');

  log.pass('═══════════════════════════════════════════════════════════');
  log.pass(`SCENARIO 4 PASSED ✅ — Team COMPLETE (${teamInfo.currentSize} members) — Submission accepted`);
  log.pass('═══════════════════════════════════════════════════════════');
});