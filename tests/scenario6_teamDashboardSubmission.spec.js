// ============================================================
// tests/scenario6_teamDashboardSubmission.spec.js
// ============================================================
// SCENARIO 6: Team Dashboard — Multi-Module Project Submission
// ============================================================
// GIVEN:  User is logged in and submission window is active
// WHEN:   User fills form(s) and optionally adds more submission modules
// THEN:   All filled modules are submitted and success message appears
// ============================================================

'use strict';

const { test, expect }    = require('@playwright/test');
const { AuthPage }        = require('../pages/AuthPage');
const { DashboardPage }   = require('../pages/DashboardPage');
const { SubmissionPage }  = require('../pages/SubmissionPage');
const { Logger }          = require('../utils/logger');
const { EMAIL, OTP, URLS, TIMEOUTS, TABS, SELECTORS, MAX_ADD_SUBMISSIONS, FORM_DATA } = require('../config/config');

test.use({ storageState: undefined });

test('Scenario 6 — Team dashboard multi-module project submission', async ({ page }) => {

  test.setTimeout(TIMEOUTS.EXTRA_LONG);

  const log  = new Logger('Scenario 6 - Multi-Module');
  const auth = new AuthPage(page);
  const dash = new DashboardPage(page);
  const sub  = new SubmissionPage(page);

  log.scenario('SCENARIO 6 — Team Dashboard — Multi-Module Project Submission');

  log.info(`Configuration: MAX_ADD_SUBMISSIONS = ${MAX_ADD_SUBMISSIONS}`);
  log.info(`Max forms to be filled: up to ${MAX_ADD_SUBMISSIONS + 1}`);

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

  // EXPECT: nav-profile button visible confirms login + dashboard loaded
  await expect(
    page.locator('[data-id="nav-profile-button"]'),
    'nav-profile button must be visible — confirms login succeeded and dashboard loaded'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Login confirmed — nav-profile visible ✔');
  log.info(`Current URL after login: ${page.url()}`);

  // Wait for main tablist to render
  log.info('Waiting for dashboard main tab list...');
  const tabList = await dash.waitForMainTabList();

  // EXPECT: Dashboard tablist must be visible before we attempt tab navigation
  await expect(
    page.getByRole('tablist').first(),
    'Dashboard main tablist must be visible before navigating to Submissions tab'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Dashboard tab list ready ✔');

  // ── STEP 4: Navigate to Submissions → Ongoing ─────────────
  log.step(4, `Clicking "${TABS.SUBMISSIONS}" → "${TABS.ONGOING}"`);
  await dash.clickMainTab(TABS.SUBMISSIONS, tabList);
  log.info(`"${TABS.SUBMISSIONS}" main tab selected ✔`);

  await dash.clickSubTab(TABS.ONGOING);
  log.info(`"${TABS.ONGOING}" sub-tab selected ✔`);

  // EXPECT: Submissions main tab must be selected
  await expect(
    page.getByRole('tab', { name: TABS.SUBMISSIONS, exact: true }).first(),
    `"${TABS.SUBMISSIONS}" main tab must be selected (aria-selected=true)`
  ).toHaveAttribute('aria-selected', 'true');
  log.pass(`"${TABS.SUBMISSIONS}" main tab confirmed selected ✔`);

  // EXPECT: Ongoing sub-tab must be selected
  await expect(
    page.getByRole('tab', { name: TABS.ONGOING, exact: true }).first(),
    `"${TABS.ONGOING}" sub-tab must be selected (aria-selected=true)`
  ).toHaveAttribute('aria-selected', 'true');
  log.pass(`"${TABS.ONGOING}" sub-tab confirmed selected ✔`);
  log.info('Now viewing: Submissions → Ongoing');

  // ── STEP 5: Multi-Module Form Fill Loop ───────────────────
  log.step(5, `Starting form fill loop (max ${MAX_ADD_SUBMISSIONS + 1} fills)`);
  log.info('─── Form Fill Loop Plan ──────────────────────────');
  log.info(`  Fill #1 always fills the initial form`);
  log.info(`  Fill #2 to #${MAX_ADD_SUBMISSIONS + 1}: only if "Add Submission" button is visible`);
  log.info(`  Exit condition: button not found OR MAX_ADD_SUBMISSIONS reached`);
  log.info('──────────────────────────────────────────────────');

  let totalFilled = 0;

  for (let i = 0; i <= MAX_ADD_SUBMISSIONS; i++) {

    log.info(`\n┌─── Form Fill Run #${i + 1} of max ${MAX_ADD_SUBMISSIONS + 1} ─────────────`);

    // Wait for form section to be ready before filling
    log.info(`Waiting for form section #${i + 1} to render...`);
    await sub.waitForFormReady();

    // EXPECT: Problem statement dropdown must be visible — confirms form section loaded
    await expect(
      page.locator('#problemStatements').last(),
      `#problemStatements must be visible in form section #${i + 1} — confirms new section was appended`
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    log.pass(`Form section #${i + 1} rendered — #problemStatements visible ✔`);

    // Fill all fields in the newest (last) form section
    log.info(`Filling all fields in section #${i + 1}:`);
    log.info('  → Problem statement, Short answer, Paragraph, Link');
    log.info('  → MCQ, File upload, Searchable dropdown, Native dropdown');
    log.info('  → Slider, Date, Time');
    await sub.fillAllFields(FORM_DATA);
    totalFilled++;
    log.info(`Section #${i + 1} filled ✔ (total filled: ${totalFilled})`);

    // Check for "Add Submission" button
    log.info(`Checking if "Add Submission" button is visible after fill #${i + 1}...`);
    const added = await sub.clickAddSubmission();
    log.info(`"Add Submission": ${added ? '✅ Found and clicked' : '❌ Not found'}`);

    if (i < MAX_ADD_SUBMISSIONS && added) {
      log.info(`New section appended → proceeding to fill run #${i + 2}`);
      continue;
    }

    if (!added) {
      log.info('Button not visible — single-module hackathon or limit reached');
    } else {
      log.info(`MAX_ADD_SUBMISSIONS (${MAX_ADD_SUBMISSIONS}) reached — exiting loop`);
    }
    break;
  }

  log.info(`\n✅ Fill loop complete — total sections filled: ${totalFilled}`);

  // EXPECT: At least 1 section must have been filled before submitting
  expect(
    totalFilled,
    'At least 1 form section must be filled before attempting submission'
  ).toBeGreaterThanOrEqual(1);
  log.pass(`${totalFilled} form section(s) confirmed filled ✔`);

  // ── STEP 6: Click Submit ──────────────────────────────────
  log.step(6, 'Clicking the form Submit button...');
  await sub.submit();

  // EXPECT: Confirmation modal must appear after Submit click
  await expect(
    page.locator(`text=${SELECTORS.CONFIRM_MODAL}`),
    `"${SELECTORS.CONFIRM_MODAL}" modal must appear after Submit is clicked`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Confirmation modal appeared ✔');

  // ── STEP 7: Handle Confirmation Modal ─────────────────────
  log.step(7, 'Handling confirmation modal...');
  log.info('Flow A: Modal has Submit button → click it');
  log.info('Flow B: Modal auto-loading → wait for close');
  await sub.confirmSubmission();

  // EXPECT: Confirmation modal must be HIDDEN after confirmation
  await expect(
    page.locator(`text=${SELECTORS.CONFIRM_MODAL}`),
    `"${SELECTORS.CONFIRM_MODAL}" modal must close after submission is confirmed`
  ).toBeHidden({ timeout: TIMEOUTS.LONG });
  log.pass('Confirmation modal closed ✔');

  // ── STEP 8: Assert Success Message ───────────────────────
  log.step(8, 'Asserting success message...');
  log.info(`Expecting: "${SELECTORS.SUCCESS_MESSAGE}"`);

  // EXPECT: Success message is the MAIN final assertion of this test
  // Failure here means backend rejected the submission — check:
  //   - Submission window is active (Ongoing)
  //   - Team is complete (if team required)
  //   - Required fields are all filled
  await expect(
    page.getByText(SELECTORS.SUCCESS_MESSAGE),
    `"${SELECTORS.SUCCESS_MESSAGE}" must be visible — confirms all ${totalFilled} module(s) submitted successfully`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('"Submission submitted successfully!" visible ✔');

  log.pass('═══════════════════════════════════════════════════════════════════');
  log.pass(`SCENARIO 6 PASSED ✅ — ${totalFilled} module(s) filled and submitted successfully`);
  log.pass('═══════════════════════════════════════════════════════════════════');
});