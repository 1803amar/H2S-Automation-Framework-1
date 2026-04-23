// ============================================================
// pages/DashboardPage.js
// ============================================================
// PAGE OBJECT: Handles navigation within the Hack2Skill dashboard.
//
// Responsibilities:
//   - Navigate to dashboard and submissions pages
//   - Click main tabs (Submissions, Roadmap, etc.)
//   - Click sub-tabs (Ongoing, Upcoming, Past)
//   - Locate and open a named submission card
//   - Wait for page and tab to be ready before interacting
//
// NOTE on two-tablist problem:
//   The H2S dashboard renders TWO <ul role="tablist"> elements with the
//   same aria-label on the same page. Playwright's strict mode throws if
//   you use getByRole('tablist') without disambiguation.
//   FIX: We always call .first() on the main tablist and pass the locator
//   down to getByRole('tab') to scope the query correctly.
//
// Usage:
//   const dash = new DashboardPage(page);
//   await dash.goto();
//   await dash.clickMainTab('Submissions');
//   await dash.clickSubTab('Ongoing');
//   await dash.openSubmissionCard('Project Submission');
// ============================================================

'use strict';

const { expect } = require('@playwright/test');
const { URLS, TIMEOUTS, TABS } = require('../config/config');

class DashboardPage {
  // ── Constructor ────────────────────────────────────────────
  constructor(page) {
    this.page = page;
  }

  // ── goto(url) ──────────────────────────────────────────────
  // Navigates to the given URL and waits for the DOM to load.
  // Uses 'domcontentloaded' (not 'networkidle') to avoid hanging
  // on push-notification iframes that never fully close.
  //
  // Parameters:
  //   url {string} — defaults to URLS.DASHBOARD if not provided
  async goto(url = URLS.DASHBOARD) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log(`🌐 Navigated to: ${url}`);
  }

  // ── waitForMainTabList() ───────────────────────────────────
  // Waits for the main dashboard tablist to be visible and returns it.
  // Uses .first() to target only the primary tablist (avoids strict mode
  // error caused by two tablists sharing the same aria-label on the page).
  async waitForMainTabList() {
    const tabList = this.page.getByRole('tablist').first();
    await expect(tabList).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    return tabList;
    // Return the locator so callers can scope tab queries to it
  }

  // ── clickMainTab(tabName, tabList) ─────────────────────────
  // Clicks a main dashboard tab (e.g. 'Submissions', 'Roadmap').
  //
  // Parameters:
  //   tabName  {string}  — exact text of the tab to click
  //   tabList  {Locator} — optional scoped tablist; if omitted, uses
  //                        page-level with .first() disambiguation
  //
  // Edge cases handled:
  //   - Two tablists on page → scoped query prevents wrong-tab click
  //   - Slow tab rendering → waits for visibility before clicking
  //   - Verifies aria-selected='true' to confirm activation
  async clickMainTab(tabName, tabList = null) {
    const tab = tabList
      ? tabList.getByRole('tab', { name: tabName, exact: true })
      : this.page.getByRole('tab', { name: tabName, exact: true }).first();

    await expect(tab).toBeVisible({ timeout: TIMEOUTS.TAB });
    await tab.scrollIntoViewIfNeeded();
    // Scroll to tab in case dashboard is partially off-screen
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    // Confirm tab is now active before any further interaction
    console.log(`🗂️  Main tab selected: ${tabName}`);
    return tab;
  }

  // ── clickSubTab(tabName) ───────────────────────────────────
  // Clicks a sub-tab inside the Submissions section
  // (e.g. 'Ongoing', 'Upcoming', 'Past').
  //
  // Sub-tab names are unique on the page so .first() is safe here.
  // Still uses scrollIntoViewIfNeeded in case the layout is tall.
  async clickSubTab(tabName) {
    const tab = this.page.getByRole('tab', { name: tabName, exact: true }).first();
    await expect(tab).toBeVisible({ timeout: TIMEOUTS.TAB });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    console.log(`📋 Sub-tab selected: ${tabName}`);
    return tab;
  }

  // ── navigateToSubmissions() ────────────────────────────────
  // Full navigation sequence: main tab → Submissions, sub-tab → Ongoing.
  // Most submission tests start here. Extracts repeated 3-step pattern.
  async navigateToSubmissions() {
    const tabList = await this.waitForMainTabList();
    await this.clickMainTab(TABS.SUBMISSIONS, tabList);
    await this.clickSubTab(TABS.ONGOING);
    console.log('📬 Navigated to Submissions → Ongoing');
  }

  // ── findSubmissionCardInAnyTab(cardText) ───────────────────
  // Searches all three sub-tabs (Ongoing, Upcoming, Past) for a
  // submission card with the given text. Returns which tab it was
  // found in, or null if not found anywhere.
  //
  // Used by: timerExpiredRejection test, ongoingtabvisibility test
  //
  // Parameters:
  //   cardText {string} — visible text on the submission card
  //
  // Returns:
  //   { tab: 'Ongoing'|'Upcoming'|'Past'|null, inOngoing, inUpcoming, inPast }
  async findSubmissionCardInAnyTab(cardText) {
    const results = { inOngoing: false, inUpcoming: false, inPast: false };

    // Check each sub-tab and probe for the card (non-fatal)
    for (const tabName of [TABS.ONGOING, TABS.UPCOMING, TABS.PAST]) {
      await this.clickSubTab(tabName);
      const found = await this.page.locator(`text=${cardText}`).first()
        .isVisible({ timeout: TIMEOUTS.PROBE })
        .catch(() => false);
      // .catch() ensures a missing element returns false instead of throwing

      if (tabName === TABS.ONGOING)  results.inOngoing  = found;
      if (tabName === TABS.UPCOMING) results.inUpcoming = found;
      if (tabName === TABS.PAST)     results.inPast     = found;
    }

    // Derive which tab currently holds the card
    let tab = null;
    if (results.inOngoing)  tab = TABS.ONGOING;
    if (results.inUpcoming) tab = TABS.UPCOMING;
    if (results.inPast)     tab = TABS.PAST;

    console.log(`🔍 Card "${cardText}" — Ongoing: ${results.inOngoing}, Upcoming: ${results.inUpcoming}, Past: ${results.inPast}`);
    return { ...results, tab };
  }

  // ── openSubmissionCard(cardText) ──────────────────────────
  // Waits for the submission card with the given text to be visible,
  // scrolls to it, and clicks it to open the submission form.
  //
  // Edge cases handled:
  //   - Card may need scrolling to become visible on smaller viewports
  //   - Uses .first() to avoid strict mode error if multiple cards exist
  async openSubmissionCard(cardText) {
    const card = this.page.locator(`text=${cardText}`).first();
    await expect(card).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await card.scrollIntoViewIfNeeded();
    await card.click();
    console.log(`📂 Submission card opened: "${cardText}"`);
    return card;
  }

  // ── reloadAndRestoreNav() ─────────────────────────────────
  // Reloads the current page (simulates F5) and re-navigates to
  // Submissions → Ongoing after the page re-renders.
  // Used by: ongoingtabvisibility test (Scenario 3).
  //
  // Edge cases handled:
  //   - Uses domcontentloaded to avoid hanging on push-notification iframes
  //   - Waits for tablist to re-appear before any tab interaction
  async reloadAndRestoreNav() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    console.log('🔄 Page reloaded');

    // React re-renders asynchronously — wait for tablist to appear
    await expect(this.page.getByRole('tablist').first()).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // Restore tab navigation after reload resets the active tab
    const tabList = this.page.getByRole('tablist').first();
    await this.clickMainTab(TABS.SUBMISSIONS, tabList);
    await this.clickSubTab(TABS.ONGOING);
    console.log('🔄 Navigated back to Ongoing after reload');
  }
}

module.exports = { DashboardPage };