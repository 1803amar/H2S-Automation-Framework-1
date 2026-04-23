// ============================================================
// tests/scenario5_optionalProblemStatement.spec.js
// ============================================================
// SCENARIO 5: Submission allowed when problem statement is optional
// ============================================================
// GIVEN:  The problem statement field is NOT marked as mandatory
// WHEN:   The participant submits WITHOUT selecting a problem statement
// THEN:   The submission is accepted successfully
// ============================================================

'use strict';

const { test, expect }   = require('@playwright/test');
const { AuthPage }       = require('../pages/AuthPage');
const { DashboardPage }  = require('../pages/DashboardPage');
const { SubmissionPage } = require('../pages/SubmissionPage');
const { Logger }         = require('../utils/logger');
const { EMAIL, OTP, URLS, TIMEOUTS, TABS, SELECTORS, FORM_DATA } = require('../config/config');

test.use({ storageState: undefined });

test('Scenario 5 — Submission allowed without selecting problem statement (optional)', async ({ page }) => {

  test.setTimeout(TIMEOUTS.EXTRA_LONG);

  const log  = new Logger('Scenario 5 - Optional PS');
  const auth = new AuthPage(page);
  const dash = new DashboardPage(page);
  const sub  = new SubmissionPage(page);

  log.scenario('SCENARIO 5 — Optional Problem Statement — Submission Without Selection');

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

  // Wait for tablist to load
  log.info('Waiting for dashboard main tab list...');
  const tabList = await dash.waitForMainTabList();
  log.info('Dashboard tab list ready ✔');

  // ── STEP 4: Navigate to Submissions → Ongoing ─────────────
  log.step(4, `Clicking "${TABS.SUBMISSIONS}" → "${TABS.ONGOING}"`);
  await dash.clickMainTab(TABS.SUBMISSIONS, tabList);
  log.info(`"${TABS.SUBMISSIONS}" main tab selected ✔`);

  await dash.clickSubTab(TABS.ONGOING);
  log.info(`"${TABS.ONGOING}" sub-tab selected ✔`);

  // EXPECT: Ongoing sub-tab must have aria-selected="true"
  // This confirms the tab click succeeded and the Ongoing content is shown
  await expect(
    page.getByRole('tab', { name: TABS.ONGOING, exact: true }).first(),
    '"Ongoing" sub-tab must be selected (aria-selected=true) before reading the form'
  ).toHaveAttribute('aria-selected', 'true');
  log.pass('"Ongoing" sub-tab confirmed selected (aria-selected=true) ✔');
  log.info('Now viewing: Submissions → Ongoing — form fields should load shortly');

  // ── STEP 5: Wait for Form to Render ──────────────────────
  log.step(5, 'Waiting for submission form to fully render...');
  await sub.waitForFormReady();

  // EXPECT: Problem statement dropdown must be visible before we interact with it
  // waitForFormReady() already checks this internally — this is the test-level guard
  await expect(
    page.locator('#problemStatements').last(),
    '#problemStatements dropdown must be visible — confirms submission form has fully loaded'
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Submission form rendered — #problemStatements dropdown is visible ✔');
  log.info('All field types should now be available: short answer, paragraph, link, MCQ, file, dropdowns, slider, date, time');

  // ── STEP 6: Check If Problem Statement is Required ────────
  log.step(6, 'Inspecting problem statement field for required (*) mark...');
  const isRequired = await sub.checkProblemStatementRequired();

  log.info('─── Problem Statement Field Status ───────────────');
  log.info(`  Required (*): ${isRequired ? '✅ YES — mandatory on this form' : '⭕ NO — optional on this form'}`);
  if (isRequired) {
    log.warn('Field is MANDATORY — test will still skip it to check if platform enforces it on submit');
  } else {
    log.info('Field is OPTIONAL — skipping it is the correct behavior for this scenario');
  }
  log.info('──────────────────────────────────────────────────');

  // EXPECT: isRequired must be a boolean (not undefined/null)
  expect(
    typeof isRequired,
    'checkProblemStatementRequired() must return a boolean — not undefined or null'
  ).toBe('boolean');
  log.pass(`Problem statement required check returned a valid boolean: ${isRequired} ✔`);

  // ── STEP 7: Fill All Fields Except Problem Statement ──────
  log.step(7, 'Filling all form fields — intentionally SKIPPING problem statement...');
  log.info('Fields being filled: short answer, paragraph, link, MCQ, file upload,');
  log.info('                     searchable dropdown, native dropdown, slider, date, time');
  log.info('Field SKIPPED:       #problemStatements (intentional — this is what we are testing)');
  await sub.fillAllFields(FORM_DATA, { skipProblemStatement: true });
  log.info(`All other fields filled ✔ — problem statement left blank`);
  log.info(`(Field is ${isRequired ? 'MANDATORY' : 'OPTIONAL'} on this form)`);

  // ── STEP 8: Click Submit ──────────────────────────────────
  log.step(8, 'Clicking the Submit button...');
  log.info('Looking for Submit button in form...');
  await sub.submit();

  // EXPECT: Confirmation modal must appear after clicking Submit
  // sub.submit() already waits for modal internally — this confirms it at test level
  await expect(
    page.locator(`text=${SELECTORS.CONFIRM_MODAL}`),
    `"${SELECTORS.CONFIRM_MODAL}" confirmation modal must appear after clicking Submit`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('Confirmation modal appeared after Submit click ✔');
  log.info('Modal text: "Submit Project for Evaluation"');

  // ── STEP 9: Handle Confirmation Modal ─────────────────────
  log.step(9, 'Handling the confirmation modal...');
  log.info('Flow A: Modal has Submit button → click it');
  log.info('Flow B: Modal is auto-loading → wait for it to close automatically');
  await sub.confirmSubmission();

  // EXPECT: Confirmation modal must be HIDDEN after confirmation
  // Modal closing confirms the submission request was sent to the backend
  await expect(
    page.locator(`text=${SELECTORS.CONFIRM_MODAL}`),
    `"${SELECTORS.CONFIRM_MODAL}" modal must close after submission is confirmed`
  ).toBeHidden({ timeout: TIMEOUTS.LONG });
  log.pass('Confirmation modal closed — submission processing complete ✔');

  // ── STEP 10: Assert Success Message ──────────────────────
  log.step(10, 'Asserting success message is visible...');
  log.info(`Expecting to see: "${SELECTORS.SUCCESS_MESSAGE}"`);

  // EXPECT: Success message must appear — this is the MAIN assertion of this test
  // If problem statement was mandatory AND enforced → this will fail (validation error shown instead)
  // If problem statement was optional OR not enforced → this passes
  await expect(
    page.getByText(SELECTORS.SUCCESS_MESSAGE),
    `"${SELECTORS.SUCCESS_MESSAGE}" must be visible — confirms submission was accepted without problem statement`
  ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  log.pass('"Submission submitted successfully!" visible ✔');

  log.pass('═══════════════════════════════════════════════════════════════');
  log.pass(`SCENARIO 5 PASSED ✅ — Submission accepted without problem statement`);
  log.pass(`Problem statement was: ${isRequired ? 'MANDATORY (not enforced on submit)' : 'OPTIONAL (correctly skippable)'}`);
  log.pass('═══════════════════════════════════════════════════════════════');
});