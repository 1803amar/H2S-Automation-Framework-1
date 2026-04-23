# H2S Automation Framework
### Pro-level Playwright automation for the Hack2Skill platform

---

## 📁 Folder Structure

```
h2s-framework/
│
├── config/
│   └── config.js                  ← ALL settings: URLs, credentials, timeouts, selectors
│
├── pages/                         ← Page Object Model (POM)
│   ├── AuthPage.js                ← Login, logout, cookie banner
│   ├── DashboardPage.js           ← Tab navigation, card discovery
│   └── SubmissionPage.js          ← Every field type + submit + modal
│
├── helpers/
│   ├── dateHelper.js              ← IST date parsing + window status detection
│   └── teamHelper.js             ← API interception for team size validation
│
├── utils/
│   └── logger.js                  ← Structured logger with timestamps + emoji
│
├── tests/
│   ├── scenario1_validLogin.spec.js
│   ├── scenario2_timerExpiredRejection.spec.js
│   ├── scenario3_ongoingTabVisibility.spec.js
│   ├── scenario4_pendingTeamSubmission.spec.js
│   ├── scenario5_optionalProblemStatement.spec.js
│   └── scenario6_teamDashboardSubmission.spec.js
│
├── assets/
│   └── challenges.png             ← Sample file for upload field tests
│
├── playwright.config.js           ← Playwright config (browsers, retries, reporters)
└── package.json                   ← npm scripts for each scenario
```

---

## ⚙️ Setup

```bash
npm install
npx playwright install chromium
```

---

## ▶️ Running Tests

```bash
# Run ALL scenarios
npm test

# Run a specific scenario
npm run test:s1    # Valid Login
npm run test:s2    # Timer Expired Rejection
npm run test:s3    # Ongoing Tab Visibility
npm run test:s4    # Pending Team Check
npm run test:s5    # Optional Problem Statement
npm run test:s6    # Multi-Module Submission

# View HTML report
npm run report
```

---

## 🔧 Changing the Hackathon

To run against a **different hackathon**, edit only `config/config.js`:

```js
const EMAIL      = 'your@email.com';
const EVENT_SLUG = 'your-hackathon-slug';   // ← change this
const BASE_DOMAIN = 'https://yourdomain.hack2skill.com';  // ← and this
```

Every test picks up the new values automatically. No test file needs to be touched.

---

## 🧩 Scenarios Covered

| # | File | What it tests |
|---|------|--------------|
| 1 | `scenario1_validLogin.spec.js` | Login with OTP + Logout + redirect |
| 2 | `scenario2_timerExpiredRejection.spec.js` | Backend rejects submit outside window |
| 3 | `scenario3_ongoingTabVisibility.spec.js` | Card visible in Ongoing tab after F5 |
| 4 | `scenario4_pendingTeamSubmission.spec.js` | API team size check + submission |
| 5 | `scenario5_optionalProblemStatement.spec.js` | Submit without problem statement |
| 6 | `scenario6_teamDashboardSubmission.spec.js` | Multi-module form fill + submit |

---

## ➕ Adding a New Test

1. Create `tests/scenarioN_yourName.spec.js`
2. Import the pages and helpers you need:
   ```js
   const { AuthPage }       = require('../pages/AuthPage');
   const { DashboardPage }  = require('../pages/DashboardPage');
   const { SubmissionPage } = require('../pages/SubmissionPage');
   const { Logger }         = require('../utils/logger');
   const { EMAIL, OTP, URLS, TIMEOUTS } = require('../config/config');
   ```
3. Follow the pattern of any existing scenario file.

---

## 📌 Key Design Decisions

| Decision | Reason |
|----------|--------|
| `.last()` for all form fields | Platform appends new sections — last = newest |
| `storageState: undefined` per test | Prevents session bleed between parallel runs |
| `domcontentloaded` not `networkidle` | Push-notification iframes never fully settle |
| Keyboard arrows for slider | Mouse drag requires pixel coords — unstable across viewports |
| `toBeAttached` for radio/file inputs | These are CSS-hidden — `toBeVisible` would throw |
| `force: true` on React Select click | React Select hides native input — needs force |