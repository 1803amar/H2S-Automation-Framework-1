// ============================================================
// helpers/teamHelper.js
// ============================================================
// HELPER: Team size validation via API response interception.
//
// Used by: pendingTeam test (Scenario 4)
//
// Responsibilities:
//   - Register a listener on page responses to capture the dashboard API
//   - Extract team size config (min, max) and current member count
//   - Evaluate whether the team meets the minimum size requirement
//   - Return a structured result for the test to act on
//
// Why intercept the API instead of reading from the UI?
//   The team size min/max is not always shown in the UI.
//   The dashboard API response always contains it in tags.teamSize.
//   Intercepting gives us machine-readable data without fragile scraping.
//
// How response interception works in Playwright:
//   page.on('response', cb) fires for EVERY network response.
//   We filter by URL pattern and method, then try to parse JSON.
//   The listener is registered BEFORE page.goto() to catch the first load.
// ============================================================

'use strict';

// ── registerDashboardApiListener(page) ───────────────────────
// Registers a response listener on the page that captures the dashboard
// API response containing team size information.
//
// Parameters:
//   page {Page} — Playwright page instance
//
// Returns:
//   {function} getTeamData — call after page.goto() to retrieve captured data
//
// Usage:
//   const getTeamData = registerDashboardApiListener(page);
//   await page.goto(URLS.DASHBOARD);
//   const teamData = await getTeamData();
//
// Edge cases handled:
//   - Multiple responses may match the URL pattern — only the first valid one is stored
//   - Non-JSON responses are caught and ignored silently
//   - getTeamData() returns null if no matching response was captured
function registerDashboardApiListener(page) {
  // Use a closure variable to store the captured API data
  let capturedData = null;

  // Register before navigation so the listener is active during page load
  page.on('response', async (response) => {
    // Only process GET requests to URLs containing 'dashboard'
    if (!response.url().includes('dashboard') || response.request().method() !== 'GET') return;
    // Skip if we already captured data (no need to process duplicates)
    if (capturedData) return;

    try {
      const json = await response.json().catch(() => null);
      // .catch(() => null) prevents unhandled promise rejections on non-JSON responses

      // Validate the response has the expected team size structure
      if (json?.data?.tags?.teamSize) {
        capturedData = json.data;
        console.log('📡 Dashboard API response captured');
      }
    } catch {
      // Response was not JSON or had unexpected structure — skip silently
    }
  });

  // Return a getter function the caller invokes after goto()
  return () => capturedData;
}

// ── extractTeamInfo(dashboardData) ───────────────────────────
// Extracts and normalises team size information from the dashboard API data.
//
// Parameters:
//   dashboardData {object} — data object captured from the dashboard API
//
// Returns:
//   {object} {
//     minSize:       number,   // minimum team members required
//     maxSize:       number,   // maximum allowed (0 = unlimited)
//     currentSize:   number,   // actual current member count
//     teamName:      string,
//     members:       array,    // list of member objects from API
//   }
//
// Edge cases handled:
//   - effectiveMin: treats minSize <= 1 as 1 (solo participant always valid)
//   - Falls back to innovators.length if webengage.currentMember is absent
//   - maxSize = 0 means unlimited — documented clearly in logs
function extractTeamInfo(dashboardData) {
  if (!dashboardData) {
    console.warn('⚠️  extractTeamInfo: no dashboard data provided');
    return null;
  }

  const minSize     = dashboardData.tags?.teamSize?.min ?? 1;
  const maxSize     = dashboardData.tags?.teamSize?.max ?? 0;
  const teamName    = dashboardData.team?.name || 'Unknown';
  const members     = dashboardData.team?.innovators || [];

  // Prefer webengage currentMember count; fall back to innovators array length
  const currentSize = dashboardData.webengage?.teamManagement?.currentMember ?? members.length;

  // Treat min=0 same as min=1 — at least the user themselves is always present
  const effectiveMin = Math.max(minSize, 1);

  const maxLabel = maxSize === 0 ? 'unlimited' : String(maxSize);
  console.log(`👥 Team: "${teamName}" | Members: ${currentSize} | Required: ${effectiveMin}–${maxLabel}`);
  members.forEach((m, i) => console.log(`   Member ${i + 1}: ${m.name || m.email || 'unknown'}`));

  return { minSize: effectiveMin, maxSize, currentSize, teamName, members };
}

// ── evaluateTeamSize(teamInfo) ────────────────────────────────
// Determines whether the team is complete, incomplete, or over-sized.
//
// Parameters:
//   teamInfo {object} — result of extractTeamInfo()
//
// Returns:
//   {object} {
//     status:  'complete' | 'incomplete' | 'oversized' | 'unknown'
//     message: string — human-readable explanation
//   }
//
// Edge cases handled:
//   - maxSize = 0 means unlimited — oversized check is skipped
//   - 'unknown' returned if teamInfo is null (API data unavailable)
function evaluateTeamSize(teamInfo) {
  if (!teamInfo) return { status: 'unknown', message: 'Team data not available' };

  const { minSize, maxSize, currentSize } = teamInfo;

  if (currentSize < minSize) {
    return {
      status: 'incomplete',
      message: `Team is INCOMPLETE — has ${currentSize} member(s), minimum required: ${minSize}`,
    };
  }

  if (maxSize > 0 && currentSize > maxSize) {
    return {
      status: 'oversized',
      message: `Team is OVERSIZED — has ${currentSize} member(s), maximum allowed: ${maxSize}`,
    };
  }

  const maxLabel = maxSize === 0 ? 'unlimited' : String(maxSize);
  return {
    status: 'complete',
    message: `Team is COMPLETE — ${currentSize} member(s) within allowed range ${minSize}–${maxLabel}`,
  };
}

module.exports = { registerDashboardApiListener, extractTeamInfo, evaluateTeamSize };