// ============================================================
// pages/SubmissionPage.js
// ============================================================
// PAGE OBJECT: Handles all interactions with the project submission form.
//
// Responsibilities:
//   - Fill each field type: text, paragraph, link, MCQ, file,
//     searchable dropdown (React Select), native dropdown, slider,
//     date, time, problem statement
//   - Wait for form to stabilize after each "Add Submission" click
//   - Click the Submit button
//   - Handle the confirmation modal (two flow variants)
//   - Assert the success message
//   - Handle edge cases: hidden inputs, CSS-masked radio buttons,
//     React Select custom components, slider keyboard navigation
//
// Design principle:
//   Every method targets .last() so it always fills the NEWEST form
//   section when multiple sections are appended by "Add Submission".
//   This works because the platform appends — not replaces — sections.
//
// Usage:
//   const sub = new SubmissionPage(page);
//   await sub.waitForFormReady();
//   await sub.fillAllFields(FORM_DATA);
//   await sub.submit();
//   await sub.assertSuccess();
// ============================================================

'use strict';

const { expect } = require('@playwright/test');
const { SELECTORS, TIMEOUTS, FORM_DATA } = require('../config/config');

class SubmissionPage {
  // ── Constructor ────────────────────────────────────────────
  constructor(page) {
    this.page = page;
  }

  // ── waitForFormReady() ─────────────────────────────────────
  // Waits for the submission form to fully render.
  // The problem statement dropdown is the deepest element rendered last —
  // its visibility is used as the "form is ready" signal.
  //
  // Also scrolls to the top so field targeting starts from a known position.
  //
  // Edge cases handled:
  //   - After "Add Submission" click the new section may take time to append
  //   - Scroll reset prevents .last() from targeting the wrong section
  async waitForFormReady() {
    // Scroll to top of page so form renders in a known layout
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.evaluate(() => window.scrollTo(0, 0));

    // Problem statement dropdown is the deepest element — wait for it
    await expect(
      this.page.locator(SELECTORS.PROBLEM_STATEMENTS).last()
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    console.log('📄 Submission form is ready');
  }

  // ── fillProblemStatement(value) ───────────────────────────
  // Selects an option in the problem statement / challenge native dropdown.
  //
  // Parameters:
  //   value {string} — the <option value="..."> to select
  //                    Pass null or empty to skip (optional field)
  //
  // Edge cases handled:
  //   - Field may not exist on all hackathon forms — skip if not found
  //   - Uses selectOption({ value }) for exact match even if label changes
  async fillProblemStatement(value = FORM_DATA.problemStatementValue) {
    if (!value) {
      console.log('⏭️  Problem statement skipped (value is empty)');
      return;
    }
    const dropdown = this.page.locator(SELECTORS.PROBLEM_STATEMENTS).last();
    const exists = await dropdown.isVisible({ timeout: TIMEOUTS.PROBE }).catch(() => false);
    if (!exists) {
      console.log('ℹ️  Problem statement dropdown not found on this form — skipping');
      return;
    }
    await dropdown.scrollIntoViewIfNeeded();
    await dropdown.selectOption({ value });
    console.log(`✅ Problem statement selected: ${value}`);
  }

  // ── checkProblemStatementRequired() ──────────────────────
  // Detects whether the problem statement field has a required (*) mark.
  // Returns true if mandatory, false if optional.
  // Used by: optionalProblemStatement test (Scenario 5).
  //
  // Edge cases handled:
  //   - Probe uses short timeout — not a fatal check
  //   - normalize-space() handles whitespace-only text nodes in the DOM
  async checkProblemStatementRequired() {
    const dropdown = this.page.locator(SELECTORS.PROBLEM_STATEMENTS).last();
    const requiredMark = dropdown.locator('xpath=..//*[normalize-space(text())="*"]');
    // Look for a "*" element inside the same container as #problemStatements
    const isRequired = await requiredMark.isVisible({ timeout: TIMEOUTS.PROBE }).catch(() => false);
    console.log(`ℹ️  Problem statement is ${isRequired ? 'MANDATORY (*)' : 'OPTIONAL'}`);
    return isRequired;
  }

  // ── fillShortAnswer(value) ────────────────────────────────
  // Fills the short-answer text input field.
  // Always targets .last() for multi-section forms.
  async fillShortAnswer(value = FORM_DATA.shortAnswer) {
    const field = this.page.getByRole('textbox', { name: 'Short answer type questions' }).last();
    await expect(field).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await field.scrollIntoViewIfNeeded();
    await field.fill(value);
    console.log('✏️  Short answer filled');
  }

  // ── fillParagraph(value) ──────────────────────────────────
  // Fills the paragraph / long-text textarea field.
  async fillParagraph(value = FORM_DATA.paragraph) {
    const field = this.page.getByRole('textbox', { name: 'Enter Paragraph type question' }).last();
    await expect(field).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await field.scrollIntoViewIfNeeded();
    await field.fill(value);
    console.log('📝 Paragraph filled');
  }

  // ── fillLink(value) ───────────────────────────────────────
  // Fills the URL / link text input field.
  async fillLink(value = FORM_DATA.link) {
    const field = this.page.getByRole('textbox', { name: 'Link type question' }).last();
    await expect(field).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await field.scrollIntoViewIfNeeded();
    await field.fill(value);
    console.log('🔗 Link filled');
  }

  // ── selectMcqOption(optionValue) ─────────────────────────
  // Selects a radio button in a multiple-choice question.
  //
  // Parameters:
  //   optionValue {string} — the value attribute of the radio input
  //
  // Edge cases handled:
  //   - Radio buttons are often CSS-hidden (replaced by custom styled labels)
  //   - Uses toBeAttached (not toBeVisible) + check() which works on hidden inputs
  //   - scrollIntoViewIfNeeded used on the hidden element to bring label into view
  async selectMcqOption(optionValue = FORM_DATA.mcqOption) {
    const radio = this.page.locator(`input[type="radio"][value="${optionValue}"]`).last();
    await expect(radio).toBeAttached({ timeout: TIMEOUTS.MEDIUM });
    // toBeAttached checks the element is in the DOM even if CSS-hidden
    await radio.scrollIntoViewIfNeeded();
    await radio.check();
    console.log(`🔘 MCQ option selected: ${optionValue}`);
  }

  // ── uploadFile(filePath) ──────────────────────────────────
  // Attaches a file to the hidden file input and confirms the upload modal.
  //
  // Flow:
  //   1. Set file on the hidden <input type="file">
  //   2. Wait for the Upload modal button to appear
  //   3. Click Upload
  //   4. Wait for modal to close
  //
  // Edge cases handled:
  //   - File inputs are always hidden (display:none) → use toBeAttached
  //   - setInputFiles() works on hidden inputs unlike .click()
  //   - Wait for modal to CLOSE before filling next field (avoids race conditions)
  async uploadFile(filePath = FORM_DATA.filePath) {
    const fileInput = this.page.locator('input[type="file"]').last();
    await expect(fileInput).toBeAttached({ timeout: TIMEOUTS.MEDIUM });
    // File input is hidden — just verify it's in the DOM

    await fileInput.setInputFiles(filePath);
    // setInputFiles() bypasses the OS file picker dialog

    const uploadBtn = this.page.getByRole('button', { name: SELECTORS.UPLOAD_BUTTON, exact: true });
    await expect(uploadBtn).toBeVisible({ timeout: TIMEOUTS.UPLOAD });
    await uploadBtn.click();

    // Wait for the upload modal to close before continuing
    await expect(uploadBtn).toBeHidden({ timeout: TIMEOUTS.UPLOAD });
    console.log(`📎 File uploaded: ${filePath}`);
  }

  // ── fillSearchableDropdown(query, optionLabel) ────────────
  // Fills a React Select (searchable) dropdown by typing and selecting.
  //
  // React Select does NOT use a native <select>. It renders a hidden
  // <input> inside a combobox. The input id starts with "react-select-".
  //
  // Flow:
  //   1. Force-click the hidden input to open the dropdown
  //   2. Clear any previous value (Ctrl+A + Backspace)
  //   3. Type the search query character by character (pressSequentially)
  //   4. Wait for option to appear and click it
  //
  // Edge cases handled:
  //   - Input is hidden by React Select CSS → force: true required
  //   - Ctrl+A + Backspace clears residual value from previous form run
  //   - pressSequentially with delay mimics human typing → triggers suggestions
  async fillSearchableDropdown(
    query       = FORM_DATA.searchableDropdownQuery,
    optionLabel = FORM_DATA.searchableDropdownOption
  ) {
    // Scroll to the label first (it IS visible) to bring area into view
    const label = this.page.locator('text=Searchable dropdown type question').last();
    await expect(label).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await label.scrollIntoViewIfNeeded();

    const input = this.page.locator(SELECTORS.REACT_SELECT_INPUT).last();
    await expect(input).toBeAttached({ timeout: TIMEOUTS.MEDIUM });
    // React Select input is always hidden — check attached only

    await input.click({ force: true });
    // Force click needed because React Select hides the native input

    await input.press('Control+a');
    await input.press('Backspace');
    // Clear any value left from a previous form fill

    await input.pressSequentially(query, { delay: 100 });
    // delay: 100ms between keystrokes triggers the search debounce correctly

    const option = this.page.getByRole('option', { name: optionLabel, exact: true });
    await expect(option).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // STRATEGY: Use keyboard-only selection — never mouse click on the option.
    //
    // WHY NOT click() or click({ force: true }):
    //   The H2S platform has a fixed navbar (z-index:1000, position:fixed) at top.
    //   When the dropdown scrolls into view, the option lands UNDER the navbar.
    //   click() times out: "nav intercepts pointer events"
    //   click({ force: true }) fires the event BUT the React Select dropdown stays
    //   OPEN — the click hits the navbar overlay layer instead of the list element.
    //   Result: option shows as [selected] but listbox stays [expanded] and then
    //   blocks the Submit button click → confirmation modal never appears.
    //
    // WHY Enter key works:
    //   pressSequentially() leaves keyboard focus on the matching option.
    //   Enter fires React Select's internal onKeyDown which:
    //     1. Marks the option selected
    //     2. CLOSES the dropdown (menuIsOpen: false)
    //     3. Returns focus to the combobox input
    //   Completely independent of scroll position or navbar overlap.
    await input.press('Enter');
    // Selects the highlighted option AND closes the listbox in one keystroke

    // Escape as safety net — ensures dropdown fully dismisses even if
    // React Select's state update is slightly delayed
    await input.press('Escape');

    // Click a neutral area to blur the React Select combobox and fire onBlur.
    // This finalises the selection in React state and removes [expanded] attribute.
    await this.page.locator('body').click({ position: { x: 0, y: 0 }, force: true });

    // ASSERT: Listbox MUST be hidden before continuing.
    // An open listbox overlays fields below it and intercepts the Submit button click,
    // causing the confirmation modal to never appear.
    await expect(
      this.page.getByRole('listbox'),
      'React Select listbox must be HIDDEN after selection — open listbox blocks Submit button'
    ).toBeHidden({ timeout: TIMEOUTS.SHORT });

    console.log(`🔍 Searchable dropdown selected: "${optionLabel}"`);
  }

  // ── selectNativeDropdown(label) ──────────────────────────
  // Selects an option in a native <select> dropdown
  // (excluding the problem statement dropdown).
  //
  // Uses :not(#problemStatements) to avoid accidentally targeting the
  // problem statement select which is handled separately.
  async selectNativeDropdown(label = FORM_DATA.normalDropdownLabel) {
    const dropdown = this.page.locator('select:not(#problemStatements)').last();
    await expect(dropdown).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await dropdown.scrollIntoViewIfNeeded();
    await dropdown.selectOption({ label });
    console.log(`📋 Native dropdown selected: "${label}"`);
  }

  // ── setSlider(targetScore) ────────────────────────────────
  // Sets a linear scale slider to the target score using keyboard navigation.
  //
  // Why keyboard (not mouse drag)?
  //   Mouse drag requires precise pixel coordinates that vary with viewport.
  //   Keyboard arrow keys are reliable across all screen sizes.
  //
  // Flow:
  //   1. Focus the slider
  //   2. Press Home to reset to minimum
  //   3. Press ArrowRight (targetScore - min) times
  //
  // Edge cases handled:
  //   - min defaults to 1 if aria-valuemin is missing
  //   - aria-valuenow is read after movement to confirm final value
  async setSlider(targetScore) {
    // Default to config value if no argument passed
    if (targetScore === undefined) targetScore = require('../config/config').SLIDER_TARGET_SCORE;

    const slider = this.page.locator(SELECTORS.SLIDER).last();
    await expect(slider).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await slider.scrollIntoViewIfNeeded();
    await slider.focus();
    // Focus required for keyboard events to register on the slider

    await this.page.keyboard.press('Home');
    // Reset to minimum before moving to target to avoid off-by-one errors

    const min = Number(await slider.getAttribute('aria-valuemin') ?? '1');
    const steps = targetScore - min;
    // Steps needed = target minus the starting minimum value

    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('ArrowRight');
    }

    const finalValue = await slider.getAttribute('aria-valuenow');
    console.log(`🎚️  Slider set to: ${finalValue} (target: ${targetScore})`);
  }

  // ── fillDate(value) ───────────────────────────────────────
  // Fills the date-type question input.
  //
  // Edge cases handled:
  //   - HTML date inputs require ISO format: YYYY-MM-DD
  async fillDate(value = FORM_DATA.date) {
    const field = this.page.getByPlaceholder('Enter Date type question').last();
    await expect(field).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await field.scrollIntoViewIfNeeded();
    await field.fill(value);
    // HTML date inputs accept YYYY-MM-DD format only
    console.log(`📅 Date filled: ${value}`);
  }

  // ── fillTime(value) ───────────────────────────────────────
  // Fills the time-type question input and verifies no validation error.
  //
  // Edge cases handled:
  //   - Time inputs use 24-hour HH:MM format in HTML5
  //   - Platform shows "Value must be 12:59 or earlier" if time is invalid
  //   - Assertion confirms no validation error appeared after fill
  async fillTime(value = FORM_DATA.time) {
    const field = this.page.getByPlaceholder('Enter Time type question').last();
    await expect(field).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await field.scrollIntoViewIfNeeded();
    await field.fill(value);

    // Confirm no time validation error was triggered
    await expect(this.page.getByText('Value must be 12:59 or earlier.')).not.toBeVisible();
    console.log(`⏰ Time filled: ${value}`);
  }

  // ── fillAllFields(data) ───────────────────────────────────
  // Fills ALL field types in one call using the provided data object.
  // Skips problem statement if skipProblemStatement is true (Scenario 5).
  //
  // Parameters:
  //   data {object} — field values (defaults to FORM_DATA from config)
  //   options {object}:
  //     skipProblemStatement {boolean} — set true to test optional field
  //
  // This is the PRIMARY method called by most test files.
  async fillAllFields(data = FORM_DATA, { skipProblemStatement = false } = {}) {
    console.log('\n📋 Filling all form fields...');

    // Problem statement (may be optional depending on hackathon config)
    if (!skipProblemStatement) {
      await this.fillProblemStatement(data.problemStatementValue);
    } else {
      console.log('⏭️  Problem statement intentionally skipped for this scenario');
    }

    await this.fillShortAnswer(data.shortAnswer);
    await this.fillParagraph(data.paragraph);
    await this.fillLink(data.link);
    await this.selectMcqOption(data.mcqOption);
    await this.uploadFile(data.filePath);
    await this.fillSearchableDropdown(data.searchableDropdownQuery, data.searchableDropdownOption);
    await this.selectNativeDropdown(data.normalDropdownLabel);
    await this.setSlider(data.sliderScore || require('../config/config').SLIDER_TARGET_SCORE);
    await this.fillDate(data.date);
    await this.fillTime(data.time);

    console.log('✅ All fields filled\n');
  }

  // ── clickAddSubmission() ──────────────────────────────────
  // Clicks the "Add Submission" button to append a new form section.
  // Returns true if the button was found and clicked, false otherwise.
  //
  // Used by: teamDashboardSubmission test (multiple submission modules).
  //
  // Edge cases handled:
  //   - Button may not exist if the hackathon allows only one submission
  //   - Returns false (instead of throwing) so the caller can decide
  //   - Waits for the new form section to appear before returning
  async clickAddSubmission() {
    const addBtn = this.page.getByText('Add Submission', { exact: true });
    const isVisible = await addBtn.isVisible({ timeout: TIMEOUTS.PROBE }).catch(() => false);

    if (!isVisible) {
      console.log('ℹ️  "Add Submission" button not visible — only one module on this hackathon');
      return false;
      // Caller should proceed directly to Submit
    }

    await addBtn.click();
    console.log('➕ "Add Submission" clicked — new section appended');

    // Wait for the new section's problem statement dropdown to appear
    await expect(
      this.page.locator(SELECTORS.PROBLEM_STATEMENTS).last()
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    return true;
    // New section is ready — caller can now call fillAllFields() again
  }

  // ── submit() ─────────────────────────────────────────────
  // Clicks the first Submit button in the form section.
  // Waits for the confirmation modal to appear before returning.
  //
  // WHY dispatchEvent instead of .click():
  //   The H2S page has a sticky "titleContainer" div (the submission card header)
  //   with pointer-events enabled that floats over the Submit button after
  //   scrollIntoViewIfNeeded() positions it. Playwright reports:
  //     "<div class='titleContainer'> intercepts pointer events"
  //   scrollIntoViewIfNeeded() alone doesn't help because the card header
  //   FOLLOWS the scroll and stays covering the button.
  //
  //   Solution — three-step approach:
  //   1. scrollIntoViewIfNeeded() — brings button into viewport
  //   2. page.evaluate() scrollBy(0, 150) — nudges the page down so the button
  //      clears the sticky card header overlay
  //   3. dispatchEvent('click') — fires the click directly on the DOM element,
  //      completely bypassing Playwright's pointer-interception check
  async submit() {
    const submitBtn = this.page.getByRole('button', { name: 'Submit' }).first();

    // EXPECT: button must be visible before we attempt any interaction
    await expect(submitBtn).toBeVisible();

    // Step 1: bring button into viewport
    await submitBtn.scrollIntoViewIfNeeded();

    // Step 2: nudge page down so titleContainer overlay clears the button
    await this.page.evaluate(() => window.scrollBy(0, 150));
    // 150px is enough to move the button below the sticky card header

    // Step 3: wait a moment for the page to settle after scroll
    await this.page.waitForTimeout(300);

    // Step 4: dispatchEvent bypasses Playwright's pointer-interception check
    // It fires the click event directly on the button's DOM node —
    // no coordinate lookup, no overlay detection, no retries
    await submitBtn.dispatchEvent('click');
    console.log('🚀 Submit button clicked (via dispatchEvent)');

    // Wait for confirmation modal to appear after clicking Submit
    const modal = this.page.locator(`text=${SELECTORS.CONFIRM_MODAL}`);
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    console.log('📦 Confirmation modal appeared');
  }

  // ── confirmSubmission() ───────────────────────────────────
  // Handles the confirmation modal after clicking Submit.
  //
  // Two possible flows:
  //   Flow A: Modal shows a "Submit" button → click it → loading → success
  //   Flow B: Modal goes directly to loading state (no button) → auto-closes
  //
  // Edge cases handled:
  //   - Flow B skips the button click entirely
  //   - Waits for modal to FULLY CLOSE before checking success message
  //   - Generous LONG timeout for slow network / large file submissions
  async confirmSubmission() {
    const modal = this.page.locator(`text=${SELECTORS.CONFIRM_MODAL}`);
    const confirmBtn = this.page.getByRole('button', { name: 'Submit' }).last();
    const hasButton = await confirmBtn.isVisible({ timeout: TIMEOUTS.PROBE }).catch(() => false);

    if (hasButton) {
      await confirmBtn.click();
      console.log('✅ Confirmation modal Submit clicked');
    } else {
      console.log('⏳ Loading modal — processing automatically (no button)');
    }

    // Wait for modal to fully disappear before checking success
    await expect(modal).toBeHidden({ timeout: TIMEOUTS.LONG });
    console.log('📭 Confirmation modal closed');
  }

  // ── assertSuccess() ───────────────────────────────────────
  // Asserts the success message is visible after submission.
  // If the message does not appear, the test fails with a clear message.
  async assertSuccess() {
    const successMsg = this.page.getByText(SELECTORS.SUCCESS_MESSAGE);
    await expect(successMsg).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    console.log('🎉 Success message confirmed: Submission submitted successfully!');
  }

  // ── checkSubmitButtonState() ──────────────────────────────
  // Returns the state of the Submit button without throwing.
  // Used in timer-expired tests to check if backend blocks submission at UI level.
  //
  // Returns:
  //   'notFound'  — no Submit button in the DOM (form is locked/read-only)
  //   'disabled'  — button exists but is disabled
  //   'enabled'   — button is present and clickable
  async checkSubmitButtonState() {
    const btn = this.page.getByRole('button', { name: 'Submit', exact: true });
    const exists = await btn.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false);
    if (!exists) return 'notFound';
    const disabled = await btn.isDisabled().catch(() => false);
    return disabled ? 'disabled' : 'enabled';
  }

  // ── trySubmitAndCheckBackendResponse(context) ─────────────
  // Attempts to click Submit and reads the backend response.
  // Used in Scenario 2 (timer expired) to verify rejection.
  //
  // Parameters:
  //   context {string} — label for log messages (e.g. 'Expired window')
  //
  // Logic:
  //   - If button not found → UI already blocks submission (pass)
  //   - If button disabled → UI already blocks submission (pass)
  //   - If button enabled  → click and read toast/error/success response
  //
  // Edge cases handled:
  //   - Response may be error, success, or unclassifiable
  //   - Success after expired window = BUG → logged clearly
  //   - Unclassified response → logged for manual verification
  async trySubmitAndCheckBackendResponse(context = 'Window') {
    const state = await this.checkSubmitButtonState();

    if (state === 'notFound') {
      console.log(`${context}: No Submit button — form is read-only or locked at UI level ✅`);
      return { blocked: true, reason: 'noButton' };
    }

    if (state === 'disabled') {
      console.log(`${context}: Submit button is disabled — blocked at UI level ✅`);
      return { blocked: true, reason: 'disabled' };
    }

    // Button is enabled — click and read the backend response
    console.log(`${context}: Submit button enabled — clicking to check backend response...`);
    const submitBtn = this.page.getByRole('button', { name: 'Submit', exact: true });
    await submitBtn.click();

    // Wait for a response indicator to appear (toast / alert / snackbar)
    const responseLocator = this.page.locator(SELECTORS.RESPONSE_LOCATOR).first();
    await expect(responseLocator).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    const responseText  = await responseLocator.textContent().catch(() => '');
    const responseClass = await responseLocator.getAttribute('class').catch(() => '');

    const isError   = responseClass?.includes('error') || responseClass?.includes('snack') || responseClass?.includes('alert');
    const isSuccess = responseClass?.includes('success');

    if (isError) {
      console.log(`${context}: ✅ Backend correctly rejected — "${responseText.trim()}"`);
      return { blocked: true, reason: 'backendError', message: responseText.trim() };
    }

    if (isSuccess) {
      // This is a BUG — the platform should not allow submission outside the window
      console.log(`${context}: ⚠️  BUG — Submission went through! "${responseText.trim()}"`);
      return { blocked: false, reason: 'bug', message: responseText.trim() };
    }

    console.log(`${context}: ⚠️  Unclassified response — manual check needed: "${responseText.trim()}"`);
    return { blocked: null, reason: 'unclassified', message: responseText.trim() };
  }
}

module.exports = { SubmissionPage };