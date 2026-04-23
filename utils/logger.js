// ============================================================
// utils/logger.js
// ============================================================
// UTILITY: Structured console logger with scenario/step context.
//
// Provides consistent log formatting across all test files.
// Every log line includes a timestamp and optional scenario label.
//
// Usage:
//   const { Logger } = require('../utils/logger');
//   const log = new Logger('Scenario 1');
//   log.step(1, 'Open dashboard');
//   log.pass('Submission confirmed');
//   log.fail('Submit button not found');
//   log.warn('Unexpected state — check manually');
//   log.info('Slider value: 5');
// ============================================================

'use strict';

class Logger {
  // ── Constructor ────────────────────────────────────────────
  // Parameters:
  //   scenarioLabel {string} — shown in every log line for this instance
  constructor(scenarioLabel = 'Test') {
    this.label = scenarioLabel;
  }

  // ── _timestamp() ──────────────────────────────────────────
  // Returns current local time as HH:MM:SS for log prefixes.
  _timestamp() {
    return new Date().toTimeString().split(' ')[0];
  }

  // ── _prefix() ─────────────────────────────────────────────
  // Builds the log line prefix: [HH:MM:SS][ScenarioLabel]
  _prefix() {
    return `[${this._timestamp()}][${this.label}]`;
  }

  // ── step(n, message) ──────────────────────────────────────
  // Logs a numbered step — use at the start of each test step.
  step(n, message) {
    console.log(`${this._prefix()} ── STEP ${n}: ${message}`);
  }

  // ── info(message) ─────────────────────────────────────────
  // Logs general informational messages.
  info(message) {
    console.log(`${this._prefix()} ℹ️  ${message}`);
  }

  // ── pass(message) ─────────────────────────────────────────
  // Logs a PASS outcome — use when an assertion or check succeeds.
  pass(message) {
    console.log(`${this._prefix()} ✅ PASS: ${message}`);
  }

  // ── fail(message) ─────────────────────────────────────────
  // Logs a FAIL outcome — use before throwing an error.
  fail(message) {
    console.error(`${this._prefix()} ❌ FAIL: ${message}`);
  }

  // ── warn(message) ─────────────────────────────────────────
  // Logs a WARNING — use for unexpected states that don't fail the test.
  warn(message) {
    console.warn(`${this._prefix()} ⚠️  WARN: ${message}`);
  }

  // ── bug(message) ──────────────────────────────────────────
  // Logs a BUG — use when the platform allows something it shouldn't.
  bug(message) {
    console.error(`${this._prefix()} 🐛 BUG: ${message}`);
  }

  // ── scenario(title) ──────────────────────────────────────
  // Logs the scenario title as a banner for easy scanning in CI output.
  scenario(title) {
    const border = '='.repeat(60);
    console.log(`\n${border}`);
    console.log(`  ${this._prefix()} ${title}`);
    console.log(`${border}\n`);
  }
}

module.exports = { Logger };
