# SPECKULA BROWSER EXTENSION
## Testing & Deployment Guide

---

## TABLE OF CONTENTS

1. [Local Development & Testing](#local-development--testing)
2. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
3. [Staging Deployment](#staging-deployment)
4. [Production Deployment](#production-deployment)
5. [Chrome Web Store Submission](#chrome-web-store-submission)
6. [Monitoring & Analytics](#monitoring--analytics)
7. [Rollback & Emergency Procedures](#rollback--emergency-procedures)
8. [Troubleshooting Deployment Issues](#troubleshooting-deployment-issues)

---

## LOCAL DEVELOPMENT & TESTING

### 1. Initial Setup

```bash
# Clone and install
git clone <repo>
cd speckula-extension
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your settings
# REACT_APP_API_URL=http://localhost:3000 (for local backend)
# REACT_APP_ENV=development
```

### 2. Development Server with Hot Reload

```bash
# Start Plasmo dev server
npm run dev

# Output:
# ⚡ Plasmo (v0.80.0)
# 📦 Build successful
# 📂 Unpacked extension folder: .plasmo/chrome-mv3-dev
```

**What happens:**
- Plasmo watches your files for changes
- Auto-rebuilds on save
- Extension auto-reloads in Chrome

### 3. Load Extension in Chrome

```
1. Open chrome://extensions
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select: /path/to/speckula-extension/.plasmo/chrome-mv3-dev
5. Extension appears in sidebar
```

**Verify:**
- Extension icon appears in Chrome toolbar
- Right-click context menu shows "Analyze with SPECKULA"
- Popup opens when you click the icon
- No errors in Chrome DevTools

### 4. Testing Development Locally

#### 4.1 Test Content Extraction

```javascript
// In Chrome console on any webpage:

// 1. Check if content script loaded
console.log('__speckula_extract' in window)  // Should be true

// 2. Run extraction
const content = window.__speckula_extract?.()
console.log('Content extracted:', content)

// 3. Classify page type
const pageType = window.__speckula_classify?.()
console.log('Page type:', pageType)
```

**Expected output:**
```javascript
{
  url: "https://example.com",
  title: "Example Domain",
  text: "This domain is established...",
  metadata: { ... },
  structured: [ ... ]
}
```

#### 4.2 Test Message Passing

```javascript
// In Chrome console:

// Send message from popup context
chrome.runtime.sendMessage({
  type: 'ANALYZE_PAGE',
  payload: {
    content: { text: 'test' },
    pageType: 'landing_page',
    metadata: { url: 'https://example.com' }
  }
}, (response) => {
  console.log('Response:', response)
  // Should show: { jobId: 'job_...', status: 'queued' }
})
```

#### 4.3 Test Job Queue

```javascript
// In background service worker console:

// Get all jobs
chrome.storage.local.get('speckula_jobs', (result) => {
  console.log('Jobs in storage:', result.speckula_jobs)
})

// Get specific job status
chrome.runtime.sendMessage(
  { type: 'GET_JOB_STATUS', jobId: 'job_123' },
  (response) => {
    console.log('Job status:', response)
  }
)
```

### 5. Chrome DevTools for Extension Debugging

#### Background Service Worker Console

```
1. chrome://extensions
2. Find SPECKULA
3. Click "Inspect views: service_worker"
4. DevTools opens for background.ts
5. See console logs and errors
6. Set breakpoints
```

**What to look for:**
- Message listeners firing
- Job state changes
- API call errors
- Storage writes

#### Popup Console

```
1. Right-click extension popup
2. Select "Inspect"
3. DevTools opens for popup React component
4. See React errors, state changes
5. Network tab shows API calls
```

**What to look for:**
- Component render errors
- Message responses
- API latency
- Storage reads

#### Content Script Console

```
1. Open any webpage
2. Open DevTools (F12)
3. Console tab
4. Logs from content script appear here
5. Run extraction tests
```

**What to look for:**
- Content extraction output
- Page classification
- DOM query results

### 6. Testing Different Page Types

Test extraction on diverse pages:

```
Pricing Page:
  https://linear.app/pricing
  https://vercel.com/pricing
  https://stripe.com/pricing

Landing Page:
  https://notion.so
  https://figma.com
  https://github.com

Reddit Thread:
  https://reddit.com/r/startup/...
  https://reddit.com/r/ProductManagement/...

Product Hunt:
  https://producthunt.com
  (Click on a launch)

Documentation:
  https://docs.openai.com
  https://nextjs.org/docs
```

**For each page, verify:**
- ✅ Content extracts cleanly
- ✅ Page type classification is correct
- ✅ No console errors
- ✅ Popup UI updates smoothly

### 7. Testing with Mock API

For Phase 1 (before backend is ready), mock the API:

```typescript
// src/api/client.ts - Add mock mode

export class APIClient {
  private isMock = process.env.REACT_APP_MOCK === 'true'

  async post(endpoint: string, data: any) {
    if (this.isMock) {
      console.log('[MOCK API] POST', endpoint, data)
      
      if (endpoint === '/analyses/jobs') {
        // Mock response
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              jobId: `mock_${Date.now()}`,
              status: 'processing'
            })
          }, 500)  // Simulate network latency
        })
      }
      
      if (endpoint === '/insights') {
        return { insightId: 'mock_insight_123', saved: true }
      }
    }
    
    // Real API call
    return this.realPost(endpoint, data)
  }
}
```

```bash
# Run with mock API
REACT_APP_MOCK=true npm run dev
```

### 8. Performance Testing

#### Measure Extension Load Time

```javascript
// In Chrome console
performance.mark('extension-start')

// Open popup
// Wait for content to load

performance.mark('extension-end')
performance.measure('extension-load', 'extension-start', 'extension-end')
console.log(performance.getEntriesByName('extension-load')[0].duration)
// Should be <200ms
```

#### Measure API Call Latency

```javascript
// In popup console
const start = Date.now()
chrome.runtime.sendMessage(...)
// After response:
const latency = Date.now() - start
console.log('API latency:', latency, 'ms')
// Should be <5000ms for most pages
```

#### Check Memory Usage

```
1. Open Chrome Task Manager (Shift+Esc)
2. Find "SPECKULA" extension
3. Watch memory as you use extension
4. Should stay <20MB
```

---

## CI/CD PIPELINE SETUP

### 1. GitHub Actions Workflow

Create `.github/workflows/build-test.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Unit tests
        run: npm run test
      
      - name: Build extension
        run: npm run build
      
      - name: Upload build artifact
        uses: actions/upload-artifact@v3
        with:
          name: extension-build
          path: .plasmo/chrome-mv3-prod
      
      - name: Check build size
        run: |
          SIZE=$(du -sh .plasmo/chrome-mv3-prod | cut -f1)
          echo "Build size: $SIZE"
          # Fail if >5MB
          if [ $(du -sb .plasmo/chrome-mv3-prod | cut -f1) -gt 5242880 ]; then
            echo "Build too large!"
            exit 1
          fi
```

### 2. Lint Configuration

Create `.eslintrc.json`:

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-debugger": "error",
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "error"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### 3. Test Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### 4. Test Setup

Create `tests/setup.ts`:

```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  },
  contextMenus: {
    create: vi.fn()
  }
} as any
```

### 5. Unit Tests Example

Create `src/content/extractor.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { extractPageContent } from './extractor'

describe('Content Extractor', () => {
  beforeEach(() => {
    // Setup DOM
    document.documentElement.lang = 'en'
    document.title = 'Test Page'
  })

  it('should extract page metadata', () => {
    // Add meta tags
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:description')
    meta.setAttribute('content', 'Test description')
    document.head.appendChild(meta)

    const content = extractPageContent()

    expect(content.title).toBe('Test Page')
    expect(content.metadata.ogDescription).toBe('Test description')
  })

  it('should extract text content', () => {
    document.body.innerHTML = '<p>Hello World</p>'

    const content = extractPageContent()

    expect(content.text).toContain('Hello')
  })

  it('should handle missing metadata gracefully', () => {
    document.body.innerHTML = '<p>Content</p>'

    const content = extractPageContent()

    expect(content.metadata.ogTitle).toBeNull()
    expect(content.text).toBeDefined()
  })
})
```

---

## STAGING DEPLOYMENT

### 1. Create Staging Environment

Create `.env.staging`:

```
REACT_APP_API_URL=https://api-staging.speckula.ai
REACT_APP_ENV=staging
REACT_APP_VERSION=1.0.0-staging.1
```

### 2. Build for Staging

```bash
# Build production bundle with staging config
NODE_ENV=staging npm run build

# Output: .plasmo/chrome-mv3-prod
```

### 3. Package Extension

```bash
# Create zip for upload
npm run package

# Output: speckula-extension.zip
```

### 4. Test in Staging

```bash
# Manual testing checklist:

1. Load unpacked from .plasmo/chrome-mv3-prod
2. Test all user flows:
   - Right-click context menu
   - Open popup
   - Click Analyze
   - Wait for job to complete
   - View insight
   - Click Save
   - Check dashboard

3. Test error paths:
   - Close popup mid-analysis
   - Refresh popup and verify job resumes
   - Kill service worker (DevTools) and verify job recovers
   - Test with expired auth token
   - Test with bad API response

4. Performance:
   - Measure extraction time (<500ms)
   - Measure job processing time (<30s)
   - Check memory usage (<20MB)
   - Check bundle size (<2MB)

5. Security:
   - Verify no sensitive data in console logs
   - Verify HTTPS-only API calls
   - Verify auth token not exposed
   - Check for XSS vulnerabilities
```

### 5. Beta Testing

Deploy to beta testers:

```bash
# Create private beta version
# Upload to staging version in Chrome Web Store
# Share URL with 5-10 trusted users

# Gather feedback:
- Any crashes?
- Is extraction working?
- Is analysis latency acceptable?
- Any UI issues?
- Are insights accurate?
```

---

## PRODUCTION DEPLOYMENT

### 1. Pre-Deployment Checklist

```
Code Quality:
  ☐ All tests passing (npm run test)
  ☐ No linting errors (npm run lint)
  ☐ No TypeScript errors (npm run type-check)
  ☐ No console errors in DevTools
  ☐ >80% test coverage

Performance:
  ☐ Extension load time <200ms
  ☐ Content extraction <500ms
  ☐ Job processing <30s (typical)
  ☐ Memory usage <20MB
  ☐ Bundle size <2MB

Security:
  ☐ Auth token handled securely
  ☐ API calls over HTTPS
  ☐ No hardcoded secrets
  ☐ Privacy policy drafted
  ☐ Security review completed

Chrome Web Store:
  ☐ Icons created (16, 48, 128, 256px)
  ☐ Screenshots taken (1280x800, 2-5 shots)
  ☐ Marketing copy written
  ☐ Terms & Privacy policy finalized
  ☐ Developer account verified
```

### 2. Build Production

```bash
# Build optimized production bundle
npm run build

# Verify output
ls -lah .plasmo/chrome-mv3-prod/

# Expected structure:
# manifest.json      (15-20 KB)
# background.js     (150-200 KB)
# popup.html        (5-10 KB)
# popup.js          (300-400 KB)
# content-script.js (100-150 KB)
# icons/            (various)
```

### 3. Create Version Tag

```bash
# Tag release
git tag -a v1.0.0 -m "SPECKULA Extension v1.0.0"
git push origin v1.0.0

# GitHub creates release automatically
# Attach build artifact: speckula-extension.zip
```

### 4. Deploy to Chrome Web Store

#### Step 1: Developer Account

```
1. Go to https://developer.chrome.com/docs/webstore/get_started/
2. Create Chrome Web Store developer account
3. Verify email + payment method
4. Wait for approval (24-48 hours)
```

#### Step 2: Prepare Store Listing

Create store metadata:

```
Title:
  "SPECKULA - Product Intelligence"

Short Description (80 chars):
  "AI-powered product insights from any webpage, saved instantly"

Full Description:
  "SPECKULA Extension turns scattered PM research into structured
   intelligence.
   
   Right-click on any page → [Analyze with SPECKULA] → Get PM-level
   insights in seconds:
   
   • Competitor positioning analysis
   • Pricing strategy extraction
   • UX friction detection
   • Market signal identification
   
   Insights save directly to your SPECKULA dashboard.
   
   No more context switching between discovery and capture.
   No more lost research.
   Just intelligence, right where you need it."

Category:
  Productivity

Detailed Description:
  [Full feature list, use cases, screenshots]

Privacy Policy:
  https://speckula.ai/privacy

Support Email:
  support@speckula.ai
```

#### Step 3: Upload to Chrome Web Store

```
1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New item"
3. Upload .plasmo/chrome-mv3-prod as zip
4. Fill in store metadata
5. Review manifest.json
6. Set pricing (free)
7. Submit for review

Chrome will review:
  - Manifest compliance
  - Security (permissions, API usage)
  - Content policy (no malware, hate speech, etc.)
  - Privacy (data collection disclosure)

Review typically takes 24-72 hours
```

#### Step 4: Monitor Review Status

```bash
# Check status in webstore/devconsole
# Email: review updates

Status messages:
  "In review" - Under Chrome review (24-72 hrs)
  "Approved" - Ready to publish
  "Rejected" - See details, fix, resubmit

If rejected:
  - Read feedback carefully
  - Fix issues
  - Click "Submit for review" again
  - Wait 24-72 hours
```

### 5. Publish to Public

```
1. Chrome Web Store -> SPECKULA extension
2. Status shows "Approved"
3. Click "Publish" (or it auto-publishes after approval)
4. Wait 1-2 hours for propagation
5. Verify extension appears on:
   https://chrome.google.com/webstore/detail/[extension-id]
```

### 6. Announce Release

```bash
# Once live, announce:

Twitter:
  "🎉 SPECKULA Extension is live on Chrome Web Store!
   
   Right-click → Analyze with SPECKULA → Get instant PM insights
   
   Turn scattered research into structured intelligence.
   Zero context switching.
   
   Download now: [link]"

Email to waitlist:
  Subject: SPECKULA Extension is Here
  Body: [Feature overview, link, call-to-action]

Product Hunt:
  Submit for launch day
  Encourage team to upvote
```

---

## CHROME WEB STORE SUBMISSION

### 1. Required Assets

#### Icons

```
icon-16.png    (16×16px)  - Toolbar icon
icon-48.png    (48×48px)  - Permissions dialog
icon-128.png   (128×128px) - Web Store listing
icon-256.png   (256×256px) - Web Store featured

Requirements:
  - PNG format
  - No transparency needed (but OK)
  - Centered, clear at small sizes
  - Professional design (matches SPECKULA branding)
```

#### Screenshots

```
Requirements:
  - 1280×800 pixels (16:10 aspect ratio)
  - PNG or JPG
  - 2-5 screenshots minimum
  
Suggested screenshots:
  1. Popup with Analyze button
  2. Analysis in progress (status stages)
  3. Completed insight preview
  4. Settings/authentication page
  5. Dashboard integration (optional)
```

### 2. Submission Form Fields

```
Title:
  SPECKULA - Product Intelligence

Slug (unique ID):
  speckula-product-intelligence
  (Must be available, 45 chars max)

Category:
  Productivity

Short Description:
  [80 chars max]
  "AI-powered product insights captured instantly from any webpage"

Detailed Description:
  [4,000 chars max]
  [Feature bullets, use cases, benefits, screenshots explanation]

Developer Email:
  [verified email]

Support URL:
  https://speckula.ai/support

Privacy Policy URL:
  https://speckula.ai/privacy

Permissions Justification:
  "The extension extracts content from webpages you visit and sends
   it to SPECKULA's AI analysis engine for PM-level insights. Your
   data is never shared with third parties and is deleted after
   analysis."
```

### 3. Manifest Validation

Chrome Web Store auto-validates manifest.json:

```json
{
  "manifest_version": 3,
  "name": "SPECKULA - Product Intelligence",
  "version": "1.0.0",
  "description": "AI-powered product intelligence from any webpage",
  "permissions": [
    "activeTab",
    "scripting",
    "contextMenus",
    "storage",
    "webRequest"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "Analyze with SPECKULA",
    "default_icons": {
      "16": "public/icons/icon-16.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png",
      "256": "public/icons/icon-256.png"
    }
  },
  "background": {
    "service_worker": "src/background/background.ts"
  },
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png",
    "256": "public/icons/icon-256.png"
  }
}
```

### 4. Review Process Timeline

```
Day 1:
  Submit extension
  Automated checks run (~5 mins)
  
Day 1-3:
  Manual review by Chrome team
  Check for:
    - Policy compliance
    - Malware/security
    - Privacy violations
    
Day 3-4:
  If rejected: Email with feedback
            Resubmit with fixes
  If approved: Extension goes to "Approved" status
             Ready to publish
  
Day 4-5:
  Publish to public
  Propagates to all regions
  
Day 5+:
  Public can install from Web Store
```

---

## MONITORING & ANALYTICS

### 1. Error Tracking (Sentry)

```typescript
// src/api/client.ts - Add Sentry

import * as Sentry from "@sentry/browser"

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Don't send user tokens
    if (event.request?.headers?.Authorization) {
      delete event.request.headers.Authorization
    }
    return event
  }
})

// Catch errors
try {
  await api.post('/analyses/jobs', payload)
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'analysis', pageType }
  })
  throw error
}
```

### 2. Analytics (Mixpanel/Amplitude)

```typescript
// src/utils/analytics.ts

import * as amplitude from '@amplitude/analytics-browser'

amplitude.init(process.env.REACT_APP_AMPLITUDE_KEY)

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  amplitude.track(eventName, properties)
}

// Track key events
trackEvent('extension_installed')
trackEvent('analysis_started', { pageType })
trackEvent('analysis_completed', { pageType, duration })
trackEvent('insight_saved', { insightType })
trackEvent('error_occurred', { errorMessage, feature })
```

### 3. Dashboard Metrics

Create Grafana/Datadog dashboard to monitor:

```
Real-time Metrics:
  - Active users (last 24h)
  - Analyses per hour
  - Average analysis duration
  - Success rate (%)
  - Error rate (%)
  
Latency:
  - P50 response time
  - P95 response time
  - P99 response time
  
Errors:
  - Top errors by frequency
  - Error trend (up/down)
  - Affected users
  
Storage:
  - Jobs queue size
  - Average job age
  - Orphaned jobs
```

### 4. Chrome Web Store Analytics

```
Available in webstore/devconsole:

Users:
  - Total installs
  - Active users (by day/week/month)
  - Uninstalls
  - Crash rate

Ratings:
  - Average rating (1-5 stars)
  - Review count
  - Recent reviews

Geography:
  - Installs by country
  - Language breakdown

Referral:
  - Where users found extension
  - Direct vs. search traffic
```

---

## ROLLBACK & EMERGENCY PROCEDURES

### 1. Rollback Process

**If critical bug found post-launch:**

```bash
# Step 1: Identify issue and reproduce
# Step 2: Revert code
git revert <bad-commit>

# Step 3: Build and test previous version
npm run build

# Step 4: Create hotfix branch
git checkout -b hotfix/critical-bug
# Make minimal fix
# Test thoroughly
git push

# Step 5: Create PR, get review, merge to main

# Step 6: Tag and build
git tag -a v1.0.1 -m "Hotfix: critical bug"
npm run build

# Step 7: Upload new version to Web Store
# In webstore/devconsole:
# - Upload .plasmo/chrome-mv3-prod as zip
# - Increment version to 1.0.1
# - Submit for review

# Step 8: Monitor rollout
# - Check error rate
# - Monitor user feedback
# - Watch Web Store reviews
```

### 2. Emergency Disable

If extension is causing widespread issues:

```
1. Log into webstore/devconsole
2. Find SPECKULA extension
3. Click "Remove item from Chrome Web Store"
4. Confirm removal

This removes from public store but existing installs continue working.

Notify users:
  - Email: "We've temporarily removed SPECKULA from Web Store
            while we fix an issue. Please uninstall and wait for
            the update."
  - Twitter: "We've identified an issue and removed SPECKULA from
             Web Store temporarily. Fix coming soon."
```

### 3. User Communication Template

```
If major issue post-launch:

Subject: SPECKULA Extension - Important Update

Body:
We've identified an issue affecting some users of the SPECKULA
extension and have temporarily removed it from the Chrome Web Store
while we implement a fix.

What you should do:
1. Uninstall SPECKULA from your extensions (right-click icon → Remove)
2. Wait for our next update notification
3. Reinstall when we re-launch

Expected timeline:
- Issue identified: [time]
- Fix implemented: [time] EST
- Resubmitted to Chrome: [time] EST
- Back in Web Store: [time] EST

We apologize for any disruption. Thank you for your patience.

Questions? Email support@speckula.ai
```

---

## TROUBLESHOOTING DEPLOYMENT ISSUES

### Issue 1: Extension Won't Load Unpacked

```
Error: "Manifest file is missing or unreadable"

Solution:
  1. Verify .plasmo/chrome-mv3-prod/ exists
  2. Check manifest.json syntax: npm run build
  3. Verify all required files:
     - manifest.json
     - background.js
     - popup.html
     - popup.js
     - content-script.js
  4. Check file permissions: chmod 644 *
  5. Try in new Chrome profile: chrome://profile-picker/
```

### Issue 2: Content Script Not Injecting

```
Error: Content script not running on pages

Debug:
  1. Check manifest.json has:
     "host_permissions": ["<all_urls>"]
  2. Verify content.ts is in src/content/
  3. Check Chrome DevTools Console (not popup console)
  4. Look for injection errors
  
Fix:
  1. Hard reload extension (click icon → refresh)
  2. Reload page (F5)
  3. Check for CSP conflicts
  4. Verify no errors in background service worker
```

### Issue 3: Messages Not Passing

```
Error: chrome.runtime.sendMessage returns undefined

Debug:
  1. Verify listener exists in background:
     chrome.runtime.onMessage.addListener(...)
  2. Check message type is correct
  3. Verify return true in listener (keeps channel open)
  4. Check for errors in background console
  
Fix:
  // In background.ts
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_PAGE') {
      console.log('Got message:', request)  // Add logging
      sendResponse({ success: true })
    }
    return true  // CRITICAL: Keep channel open
  })
```

### Issue 4: API Calls Failing

```
Error: 401 Unauthorized or network error

Debug:
  1. Check .env.local has correct API_URL
  2. Verify auth token exists:
     chrome.storage.local.get('speckula_auth_token', console.log)
  3. Check token expiry: Is it recent?
  4. Look at Network tab for actual error response
  
Fix:
  - For 401: Token expired, user needs to re-authenticate
  - For CORS: Backend must include CORS headers
  - For network: Check localhost backend is running
  
Backend CORS fix (Fastify):
  import cors from '@fastify/cors'
  
  app.register(cors, {
    origin: 'chrome-extension://*',
    credentials: true
  })
```

### Issue 5: Service Worker Not Staying Alive

```
Error: Background script terminates before job completes

Problem: MV3 service workers shut down after ~5 minutes

Solution: Design for restarts
  1. Persist job state BEFORE async operations
  2. Check for incomplete jobs on message receive
  3. Resume polling if service worker restarted
  
Code fix:
  // Always write to storage FIRST
  jobQueue.createJob({ jobId, status: 'queued' })
  
  // Then start async work
  processJobAsync(jobId, payload)
  
  // On resume, check for incomplete jobs
  let initialized = false
  chrome.runtime.onMessage.addListener((request) => {
    if (!initialized) {
      resumeIncompleteJobs()
      initialized = true
    }
  })
```

### Issue 6: Chrome Web Store Rejection

```
Common rejection reasons:

"Excessive permissions":
  - Only request permissions you use
  - Remove "webRequest" if not needed
  - Justify "activeTab" and "scripting"

"Privacy policy missing":
  - Add Privacy Policy URL to manifest
  - Explain data collection

"Misleading description":
  - Avoid "Free forever" (can't guarantee)
  - Don't claim results you can't deliver
  - Be honest about data usage

"Functionality issues":
  - Test all user flows before submit
  - Verify on Windows, Mac, Linux
  - Check on various Chrome versions

Solution:
  1. Read rejection email carefully
  2. Fix specific issue
  3. Update manifest/description
  4. Resubmit for review
  5. No need to wait between resubmits
```

---

## DEPLOYMENT CHECKLIST

### Pre-Launch
- [ ] All tests passing
- [ ] No console errors
- [ ] Performance targets met
- [ ] Security review done
- [ ] Privacy policy written
- [ ] Screenshots created
- [ ] Store description written
- [ ] Icons created
- [ ] Email template prepared
- [ ] Twitter/social posts drafted

### Launch Day
- [ ] Build production bundle
- [ ] Tag release in Git
- [ ] Upload to Chrome Web Store
- [ ] Submit for review
- [ ] Monitoring dashboards ready
- [ ] Error tracking configured
- [ ] Analytics configured
- [ ] Support email monitored
- [ ] Team on standby for issues

### Post-Launch (Week 1)
- [ ] Monitor crash rate (<1%)
- [ ] Monitor error rate (<5%)
- [ ] Read user reviews carefully
- [ ] Respond to feedback
- [ ] Check Chrome Web Store analytics
- [ ] Review Sentry errors
- [ ] Watch API latency
- [ ] Plan Week 2 improvements

---

## NEXT STEPS

1. **Set up CI/CD** — Implement GitHub Actions workflow
2. **Create test suite** — Unit + integration tests
3. **Deploy to staging** — Test full workflow
4. **Prepare Web Store listing** — Write copy, create screenshots
5. **Set up monitoring** — Sentry + analytics
6. **Plan launch** — Timing, announcement, support

Once you have these in place, you're ready to ship with confidence.

