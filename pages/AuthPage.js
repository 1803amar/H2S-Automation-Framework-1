// ============================================================
// pages/AuthPage.js
// ============================================================
// PAGE OBJECT: Handles all authentication flows on Hack2Skill.
//
// Responsibilities:
//   - Dismiss cookie consent banner (present on first visit)
//   - Fill email → click Login → fill OTP → click Verify
//   - Confirm dashboard has loaded after login (nav-profile visible)
//   - Perform logout via navbar profile menu
//
// Usage:
//   const auth = new AuthPage(page);
//   await auth.dismissCookieBanner();
//   await auth.login(EMAIL, OTP);
//   await auth.logout();
// ============================================================

'use strict';

const { expect } = require('@playwright/test');
const { SELECTORS, TIMEOUTS } = require('../config/config');

class AuthPage {
  // ── Constructor ────────────────────────────────────────────
  // Receives the Playwright page instance injected by the test.
  constructor(page) {
    this.page = page;
  }

  // ── dismissCookieBanner() ──────────────────────────────────
  // Waits for the cookie consent button to appear and clicks it.
  // Silently skips if the banner never appears (e.g. already accepted
  // in this session, or feature flag disabled on this environment).
  //
  // Edge cases handled:
  //   - Banner may not appear if cookies were already accepted (session storage)
  //   - Banner may be delayed by API — uses SHORT timeout before giving up
  async dismissCookieBanner() {
    const btn = this.page.locator(SELECTORS.COOKIE_ACCEPT);
    try {
      // Wait up to SHORT timeout for the banner to become visible
      await expect(btn).toBeVisible({ timeout: TIMEOUTS.SHORT });
      await btn.click();
      // Wait for the banner to disappear before proceeding
      await expect(btn).toBeHidden({ timeout: TIMEOUTS.SHORT });
      console.log('✅ Cookie banner dismissed');
    } catch {
      // Banner did not appear within the timeout — skip silently
      console.log('ℹ️  Cookie banner not found — skipping');
    }
  }

  // ── login(email, otp) ──────────────────────────────────────
  // Performs the full OTP-based login flow.
  //
  // Flow:
  //   1. Fill email field
  //   2. Click Login button
  //   3. Wait for OTP screen to load (heading appears, login btn gone)
  //   4. Fill 6 OTP digit inputs one by one
  //   5. Click Verify button
  //   6. Wait for nav-profile button to confirm dashboard loaded
  //
  // Parameters:
  //   email {string} — user email to fill
  //   otp   {string} — 6-digit OTP string (e.g. '123456')
  //
  // Edge cases handled:
  //   - Login button is removed from DOM after click (don't wait for it post-click)
  //   - OTP inputs are always exactly 6 — validated before filling
  //   - Verify button may be slow to enable — waits for enabled state
  async login(email, otp) {
    // ── 1. Email field ────────────────────────────────────────
    const emailInput = this.page.getByPlaceholder(SELECTORS.EMAIL_INPUT);
    // Wait until the email input is visible (page may still be loading)
    await expect(emailInput).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await emailInput.fill(email);
    console.log(`📧 Email filled: ${email}`);

    // ── 2. Login button ───────────────────────────────────────
    const loginBtn = this.page.locator(SELECTORS.LOGIN_BUTTON);
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toBeEnabled();
    // Confirm button is interactive before clicking
    await loginBtn.click();
    console.log('🔘 Login button clicked');

    // ── 3. Wait for OTP screen ────────────────────────────────
    // The login button is REMOVED from the DOM once the OTP screen loads.
    // Do NOT await loginBtn visibility after this point — it will throw.
    // Instead, wait for the OTP screen heading to confirm transition.
    await expect(
      this.page.getByRole('heading', { name: SELECTORS.VERIFY_HEADING })
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    console.log('📱 OTP screen loaded');

    // ── 4. Fill OTP digits ────────────────────────────────────
    const otpInputs = this.page.locator(SELECTORS.OTP_INPUT);
    // Confirm first box is visible and total count is exactly 6
    await expect(otpInputs.first()).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await expect(otpInputs).toHaveCount(6);

    // Fill each digit into its own input box
    for (let i = 0; i < otp.length; i++) {
      await otpInputs.nth(i).fill(otp[i]);
    }
    console.log('🔢 OTP digits filled');

    // ── 5. Verify button ──────────────────────────────────────
    const verifyBtn = this.page.locator(SELECTORS.VERIFY_BUTTON);
    await expect(verifyBtn).toBeVisible();
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();
    console.log('✅ Verify button clicked');

    // ── 6. Confirm login success ──────────────────────────────
    // The nav-profile button only appears after the dashboard fully loads.
    // Its presence is the most reliable indicator that login succeeded.
    await expect(
      this.page.locator(SELECTORS.NAV_PROFILE)
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    console.log('🎉 Login confirmed — dashboard loaded');
  }

  // ── logout() ──────────────────────────────────────────────
  // Clicks the profile icon in the navbar to open the dropdown,
  // then clicks the Logout link and asserts redirect to home page.
  //
  // Edge cases handled:
  //   - Profile button may take time to appear after login transition
  //   - Logout link text is matched case-insensitively with regex
  async logout() {
    const profileBtn = this.page.locator(SELECTORS.NAV_PROFILE);
    // Wait for the profile icon to be visible (post-login transition may delay it)
    await expect(profileBtn).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await profileBtn.click();
    console.log('👤 Profile menu opened');

    const logoutBtn = this.page.getByRole('link', { name: /^logout$/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    console.log('🚪 Logout clicked');

    // Assert redirect to the root of the domain after logout
    await expect(this.page).toHaveURL(url =>
      url.origin === new URL(this.page.url()).origin && url.pathname === '/'
    );
    console.log('✅ Logout confirmed — redirected to home');
  }
}

module.exports = { AuthPage };