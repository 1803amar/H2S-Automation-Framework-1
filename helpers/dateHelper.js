// ============================================================
// helpers/dateHelper.js
// ============================================================
// HELPER: Date parsing and submission window status detection.
//
// Used by: timerExpiredRejection test (Scenario 2)
//
// Responsibilities:
//   - Parse IST date strings from the platform UI
//   - Determine if the submission window is Upcoming / Ongoing / Past
//   - Handle IST ↔ UTC conversion correctly
//
// Date format on the H2S platform:
//   "13/02/2026 12:26:00 PM(IST)"
//
// Why not just use new Date(dateStr)?
//   JavaScript's Date constructor does not understand DD/MM/YYYY format.
//   It also does not recognise "(IST)" as a timezone. We must parse
//   manually and offset to UTC ourselves.
// ============================================================

'use strict';

// ── parseDateFromPage(dateStr) ────────────────────────────────
// Parses the IST date string shown on the platform into a UTC Date object.
//
// Parameters:
//   dateStr {string} — e.g. "13/02/2026 12:26:00 PM(IST)"
//
// Returns:
//   {Date} — equivalent UTC Date object
//
// IST = UTC+5:30 → subtract 5h 30m to convert to UTC.
//
// Edge cases handled:
//   - 12-hour clock: AM 12:xx → 00:xx (midnight); PM 12:xx stays 12:xx
//   - Trailing "(IST)" is stripped before parsing
//   - Returns Invalid Date if input is malformed (caller should check)
function parseDateFromPage(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    console.warn('⚠️  parseDateFromPage: invalid input:', dateStr);
    return new Date(NaN);
    // Return Invalid Date so caller can check with isNaN(date.getTime())
  }

  // Remove "(IST)" timezone label from the end of the string
  const cleaned = dateStr.replace('(IST)', '').trim();
  // cleaned: "13/02/2026 12:26:00 PM"

  const parts = cleaned.split(' ');
  // parts: ["13/02/2026", "12:26:00", "PM"]

  if (parts.length < 3) {
    console.warn('⚠️  parseDateFromPage: unexpected format:', dateStr);
    return new Date(NaN);
  }

  const [datePart, timePart, meridiem] = parts;

  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  // Convert 12-hour to 24-hour
  let hr = hours;
  if (meridiem === 'PM' && hr !== 12) hr += 12;
  // PM 1–11 → add 12; PM 12 stays 12 (noon)
  if (meridiem === 'AM' && hr === 12) hr = 0;
  // AM 12 → midnight (00:00)

  // Build UTC date by subtracting IST offset (UTC+5:30 = +330 minutes)
  // We use Date.UTC to avoid any local timezone contamination
  const dateUTC = Date.UTC(
    year,
    month - 1,    // JavaScript months are 0-indexed
    day,
    hr - 5,       // subtract IST hours offset
    minutes - 30, // subtract IST minutes offset (may go negative → JS handles automatically)
    seconds
  );

  return new Date(dateUTC);
  // Date.UTC handles negative minute values correctly (rolls back the hour)
}

// ── getWindowStatus(startDateStr, endDateStr) ─────────────────
// Determines the submission window status based on the current time.
//
// Parameters:
//   startDateStr {string} — IST date string from the Starting Date field
//   endDateStr   {string} — IST date string from the Ending Date field
//
// Returns:
//   {object} {
//     status:    'upcoming' | 'ongoing' | 'past' | 'unknown'
//     startDate: Date,
//     endDate:   Date,
//     now:       Date,
//   }
//
// Edge cases handled:
//   - Returns 'unknown' if either date string is invalid
//   - Logs UTC timestamps for all three dates for debugging
function getWindowStatus(startDateStr, endDateStr) {
  const startDate = parseDateFromPage(startDateStr);
  const endDate   = parseDateFromPage(endDateStr);
  const now       = new Date();

  // Validate parsed dates — isNaN check for Invalid Date objects
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.warn('⚠️  Could not parse start or end date — returning unknown status');
    return { status: 'unknown', startDate, endDate, now };
  }

  console.log(`🕐 Current time (UTC):  ${now.toUTCString()}`);
  console.log(`🕐 Start time (UTC):    ${startDate.toUTCString()}`);
  console.log(`🕐 End time (UTC):      ${endDate.toUTCString()}`);

  let status;
  if (now < startDate) {
    status = 'upcoming';
    console.log('📅 Window status: UPCOMING — submission has not opened yet');
  } else if (now > endDate) {
    status = 'past';
    console.log('📅 Window status: PAST — submission window has expired');
  } else {
    status = 'ongoing';
    console.log('📅 Window status: ONGOING — submission window is active');
  }

  return { status, startDate, endDate, now };
}

// ── readSubmissionDates(page) ─────────────────────────────────
// Reads the Starting Date and Ending Date text from the submission card.
//
// The platform renders these as sibling elements:
//   <p>Starting Date</p>
//   <p>13/02/2026 12:26:00 PM(IST)</p>
//
// Two selector strategies are tried in order:
//   1. CSS adjacent sibling: p:has-text("Label") + *
//   2. XPath following-sibling (fallback for different DOM structures)
//
// Returns:
//   { startDateStr: string|null, endDateStr: string|null }
//
// Edge cases handled:
//   - Returns null for each date if the element is not found
//   - Caller should check for null and skip/log if dates unavailable
async function readSubmissionDates(page) {
  const startDateStr =
    await page.locator('p:has-text("Starting Date") + *').textContent().catch(() => null) ||
    await page.locator('text=Starting Date').locator('xpath=following-sibling::*[1]').textContent().catch(() => null);

  const endDateStr =
    await page.locator('p:has-text("Ending Date") + *').textContent().catch(() => null) ||
    await page.locator('text=Ending Date').locator('xpath=following-sibling::*[1]').textContent().catch(() => null);

  if (startDateStr) console.log(`📅 Starting Date on page: ${startDateStr.trim()}`);
  if (endDateStr)   console.log(`📅 Ending Date on page:   ${endDateStr.trim()}`);

  return {
    startDateStr: startDateStr?.trim() ?? null,
    endDateStr:   endDateStr?.trim()   ?? null,
  };
}

module.exports = { parseDateFromPage, getWindowStatus, readSubmissionDates };