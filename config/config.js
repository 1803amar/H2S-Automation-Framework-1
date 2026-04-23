// ============================================================
// config/config.js
// ============================================================
// CENTRAL CONFIGURATION FILE — All settings live here.
// Change values here once and every test picks them up.
// Never hard-code URLs, credentials, or timeouts in test files.
// ============================================================

'use strict';

// ── Credentials ──────────────────────────────────────────────
// User email used for OTP-based login across all tests.
// Change this to switch the test account.
const EMAIL = 'amar@hack2skill.com';

// Static OTP used in the test/sandbox environment.
// In production, replace with a dynamic OTP fetcher if needed.
const OTP = '123456';

// ── Base URLs ────────────────────────────────────────────────
// Root domain of the platform being tested.
// Update this when switching between environments (staging / prod).
const BASE_DOMAIN = 'https://alphavision.hack2skill.com';

// Slug for the hackathon event being tested.
// Change this to run the same tests against a different hackathon.
const EVENT_SLUG = 'platform-automation-sandbox';

// ── Page URLs ─────────────────────────────────────────────────
// Built from BASE_DOMAIN and EVENT_SLUG so you only change one place.
const URLS = {
  // Login page — entry point for all tests that require auth
  LOGIN: `${BASE_DOMAIN}/login`,

  // Main hackathon dashboard roadmap tab
  DASHBOARD: `${BASE_DOMAIN}/event/${EVENT_SLUG}/dashboard/roadmap`,

  // Submissions tab — direct deep-link used by submission tests
  SUBMISSIONS: `${BASE_DOMAIN}/event/${EVENT_SLUG}/dashboard/submissions`,
};

// ── Timeouts (milliseconds) ───────────────────────────────────
// Centralise every timeout so adjustments need only one change.
const TIMEOUTS = {
  // Short wait: cookie banner, button visibility
  SHORT: 8000,

  // Medium wait: OTP screen, tab navigation, page transitions
  MEDIUM: 15000,

  // Long wait: full form submit, modal confirmation, upload
  LONG: 30000,

  // Extra-long: complex scenarios with multiple form fills or API checks
  EXTRA_LONG: 120000,

  // Tab selection confirmation wait
  TAB: 10000,

  // Quick probe — used when checking if something MAY be visible (non-fatal)
  PROBE: 3000,

  // File upload modal close wait
  UPLOAD: 10000,
};

// ── Form / Submission Settings ────────────────────────────────
// Controls how many extra submission sections to add before submitting.
// Total forms filled = MAX_ADD_SUBMISSIONS + 1 (the initial form).
// Set to 0 to fill just the initial form and submit immediately.
const MAX_ADD_SUBMISSIONS = 3;

// Target value for the linear-scale slider question.
// Must be within the min/max range defined on the form.
const SLIDER_TARGET_SCORE = 5;

// ── Test Data ─────────────────────────────────────────────────
// Default form field values used across all submission tests.
// Override per-test in the individual data files if needed.
const FORM_DATA = {
  // Value for "Short answer type question" fields
  shortAnswer: 'This is dummy text for Short answer type questions',

  // Value for "Paragraph type question" fields
  paragraph: 'This is dummy text for Paragraph type questions',

  // Value for "Link type question" fields
  link: 'https://www.lipsum.com/',

  // Radio option selected for MCQ questions
  mcqOption: 'option 2',

  // Search term typed in the React Select searchable dropdown
  searchableDropdownQuery: 'abcd',

  // Exact label of the option to select in the searchable dropdown
  searchableDropdownOption: 'abcd',

  // Label of the option to select in normal native <select> dropdowns
  normalDropdownLabel: 'dropdown 3',

  // Date value filled into date-type questions (HTML date input format)
  date: '2026-03-20',

  // Time value filled into time-type questions (24-hour HH:MM format)
  time: '11:30',

  // MongoDB ObjectId of the problem statement / challenge to select
  // Change to match the challenge available in your test hackathon
  problemStatementValue: '6992aed1cc85ebfb1c17540f',

  // Path to the file used for file-upload questions (relative to project root)
  filePath: 'asset/challenges.png',
};

// ── Selectors ─────────────────────────────────────────────────
// All data-id and CSS selectors used across the platform.
// Centralise here so a platform UI change only needs one fix.
const SELECTORS = {
  // Cookie consent accept button
  COOKIE_ACCEPT: '[data-id="accept-cookies"]',

  // Email input on the login page
  EMAIL_INPUT: 'Enter Email',                   // used with getByPlaceholder

  // Button that submits the email and requests OTP
  LOGIN_BUTTON: '[data-id="auth-login-button"]',

  // Individual OTP digit input boxes (6 total)
  OTP_INPUT: '[data-id="auth-otp-input"]',

  // Button that verifies the entered OTP
  VERIFY_BUTTON: '[data-id="auth-verify-button"]',

  // Profile icon in the navbar — presence confirms successful login
  NAV_PROFILE: '[data-id="nav-profile-button"]',

  // OTP screen heading — confirms page has transitioned from login to OTP
  VERIFY_HEADING: 'Verify Your Account',        // used with getByRole heading

  // Problem statement / challenge native <select> dropdown
  PROBLEM_STATEMENTS: '#problemStatements',

  // React Select searchable dropdown input (id is auto-generated)
  REACT_SELECT_INPUT: 'input[id^="react-select-"]',

  // Slider element used for linear scale questions
  SLIDER: '[role="slider"]',

  // Upload confirmation button that appears after a file is selected
  UPLOAD_BUTTON: 'Upload',                      // used with getByRole button exact

  // Submission card title text — used to locate the project submission card
  SUBMISSION_CARD: 'Project Submission',

  // Confirmation modal title text — appears before final submission
  CONFIRM_MODAL: 'Submit Project for Evaluation',

  // Success message shown after a submission completes
  SUCCESS_MESSAGE: 'Submission submitted successfully!',

  // Error/toast/alert locators — used to detect backend response
  RESPONSE_LOCATOR: '[class*="error"], [class*="toast"], [role="alert"], [class*="snack"], [class*="success"]',
};

// ── Tab Names ──────────────────────────────────────────────────
// Exact text of each tab used in navigation helpers.
// If the platform renames a tab, update only here.
const TABS = {
  SUBMISSIONS: 'Submissions',   // Main tab in dashboard
  ONGOING: 'Ongoing',           // Sub-tab: active submissions
  UPCOMING: 'Upcoming',         // Sub-tab: not-yet-started submissions
  PAST: 'Past',                 // Sub-tab: expired submissions
};

// ── Export ───────────────────────────────────────────────────
// Export everything as a single object for easy destructuring in tests.
module.exports = {
  EMAIL,
  OTP,
  BASE_DOMAIN,
  EVENT_SLUG,
  URLS,
  TIMEOUTS,
  MAX_ADD_SUBMISSIONS,
  SLIDER_TARGET_SCORE,
  FORM_DATA,
  SELECTORS,
  TABS,
};