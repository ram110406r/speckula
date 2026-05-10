# SPECKULA BROWSER EXTENSION
## Architectural Design Rationale

---

## TABLE OF CONTENTS

1. [The Core Problem & Solution](#the-core-problem--solution)
2. [Why This Architecture Exists](#why-this-architecture-exists)
3. [The Three-Process Boundary](#the-three-process-boundary)
4. [MV3 & Service Worker Constraints](#mv3--service-worker-constraints)
5. [Why Plasmo](#why-plasmo)
6. [The Async Job Queue Pattern](#the-async-job-queue-pattern)
7. [Content Extraction & Classification](#content-extraction--classification)
8. [Authentication & Firebase Integration](#authentication--firebase-integration)
9. [Backend Requirements](#backend-requirements)
10. [Phase Sequence Justification](#phase-sequence-justification)
11. [Critical Risks & Mitigations](#critical-risks--mitigations)
12. [The Architectural Thesis](#the-architectural-thesis)

---

## THE CORE PROBLEM & SOLUTION

### The Discovery-to-Capture Friction Loop

Right now, when a SPECKULA user discovers valuable product intelligence, the workflow is:

1. Find something useful on the web (competitor pricing page, Reddit thread, Product Hunt launch, review site)
2. Copy the relevant text/link
3. Switch to SPECKULA dashboard (alt-tab or new tab)
4. Paste into research block or annotation
5. Tag, categorize, and connect to workspace
6. Switch back to original tab (or lose it)

This is a **context-switch tax**. Every step breaks focus and interrupts the discovery momentum. Users end up:

- Copying less than they notice
- Saving links without context
- Losing half-discovered insights
- Treating SPECKULA as a destination ("I should remember to add this later") rather than a flow ("This goes straight in while I'm reading")

### The Extension Solution

The extension removes the context switch:

```
Find something → Right-click → [Analyze with SPECKULA] → Insight appears → Continue reading
                                (no tab switch, no copy-paste, no context loss)
```

The extension stays in the browser. It extracts, analyzes, and captures without interrupting the user's discovery flow.

### Why This Matters for Product Strategy

SPECKULA can only become **habit-forming** if it reduces friction at the moment of maximum engagement. A user won't interrupt their research to open a dashboard. But they will right-click and wait 3 seconds for an insight to appear inline. The extension is not a feature—it's a **distribution channel** for SPECKULA into the user's natural workflow.

---

## WHY THIS ARCHITECTURE EXISTS

### Principle 1: Zero Context Switching

Every architectural choice prioritizes avoiding tab switches:

- **Async job queue** → Work happens in background; popup stays responsive
- **Content script injection** → DOM extraction happens without page reload
- **Firebase Bearer tokens** → Auth persists; no sign-in interruption mid-flow
- **Realtime progress UI** → User sees analysis happening; no black box

### Principle 2: Survive Service Worker Restarts

MV3 service workers can be killed by Chrome at any time. Jobs must survive this:

- **Job state in storage first** → Job exists even if service worker dies
- **Polling for job status** → Popup can re-attach to orphaned jobs
- **Backend as source of truth** → Analysis continues server-side even if client dies

### Principle 3: Extensibility Without Complexity

The extension is a foundation for future autonomous features. It must support:

- **Layered extraction** → Different extraction pipelines for different page types
- **Pluggable analysis** → Custom prompt templates per insight type
- **Scheduled monitoring** → Future phases for automatic competitor tracking
- **Workspace context** → Save insights to the right place without user friction

---

## THE THREE-PROCESS BOUNDARY

This is the **single most important architectural constraint**. You must internalize it.

### The Three Isolated Contexts

```
┌──────────────────────────────────────────────────────────────┐
│                    POPUP PROCESS                             │
│                                                              │
│  - React component tree                                     │
│  - User-facing UI (buttons, status, previews)               │
│  - Can: Read chrome.storage, send messages, call APIs       │
│  - Cannot: Access page DOM, call background functions       │
│  - Lifecycle: Destroyed when user clicks away               │
│  - Memory: ~5MB                                             │
└──────────────────────────────────────────────────────────────┘
                             ▲
                             │ chrome.runtime.sendMessage()
                             │ chrome.runtime.onMessage.addListener()
                             │
┌──────────────────────────────────────────────────────────────┐
│              BACKGROUND SERVICE WORKER                       │
│                                                              │
│  - Orchestration hub                                        │
│  - Message router (popup ↔ content)                         │
│  - API caller                                               │
│  - Job queue manager                                        │
│  - Can: Access all Chrome APIs, call APIs, manage storage   │
│  - Cannot: Access page DOM, render UI                       │
│  - Lifecycle: Can be restarted by Chrome anytime            │
│  - Memory: <10MB (short-lived)                              │
└──────────────────────────────────────────────────────────────┘
         ▲                                      ▲
         │ chrome.tabs.sendMessage()           │
         │ chrome.tabs.onMessage.addListener()  │
         │                                      │
         │                                 chrome.scripting.executeScript()
         │                                      │
┌────────┴──────────────────────────────────────┴──────────────┐
│                   CONTENT SCRIPT                             │
│          (Injected into each tab's page context)            │
│                                                              │
│  - DOM access (can read/manipulate page)                    │
│  - Sandboxed from page's own JavaScript                     │
│  - Content extraction pipeline                              │
│  - Can: Access DOM, send messages                           │
│  - Cannot: Access chrome.storage, chrome APIs, call page JS │
│  - Lifecycle: Destroyed when tab closes or navigates        │
│  - Memory: ~5MB per tab                                     │
└──────────────────────────────────────────────────────────────┘
         │
         │ Full access to:
         │ - document, window, DOM elements
         │ - Meta tags, structure, text
         │ - Accessibility tree
         │
         └─→ PAGE DOM (user cannot access from content script's JS)
```

### Why This Boundary Exists

The three-process boundary is **security by design**:

- **Popup can't touch page DOM** → Prevents popup code from stealing page content or injecting malicious JS
- **Content script can't call Chrome APIs** → Prevents malicious pages from accessing user's browser state
- **Service worker is sandboxed** → Prevents any process from monopolizing system resources

The extension must work *with* this boundary, not fight it.

### The Communication Pattern

Since you can't call functions across the boundary, you use **message passing**:

```typescript
// Popup sends a message to background
chrome.runtime.sendMessage({
  type: 'ANALYZE_PAGE',
  payload: { content, pageType }
})

// Background listens and responds
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_PAGE') {
    handleAnalyzePage(request.payload)
      .then(response => sendResponse(response))
  }
  return true // Keep channel open for async response
})

// Background sends to content script in a specific tab
chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' })

// Content script listens and responds
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_PAGE') {
    const content = extractPageContent()
    sendResponse(content)
  }
})
```

Every feature you build must map to this message flow:

- **Feature: Extract page content**
  - Popup sends EXTRACT_PAGE to background
  - Background sends EXTRACT_PAGE to content script
  - Content script extracts and returns
  - Background processes and stores
  - Popup reads from storage or receives response

- **Feature: Analyze content**
  - Background receives ANALYZE_PAGE from popup
  - Background calls API (async)
  - Background polls for completion
  - Background updates job state in storage
  - Popup polls storage for status changes

If your feature doesn't fit this message-passing pattern, you need to **break it into smaller features that do**.

---

## MV3 & SERVICE WORKER CONSTRAINTS

### Why MV3 (Not MV2)

**MV2 is deprecated.** Chrome will no longer accept MV2 uploads to the Web Store as of February 2024. MV3 is the only option for new extensions.

MV2 architecture:
```
Background Page (persistent) ← can hold state indefinitely
├── In-memory variables
├── DOM (can have elements)
└── Can be accessed like a webpage
```

MV3 architecture:
```
Service Worker (ephemeral) ← can be killed by Chrome anytime
├── No persistent context
├── No DOM
├── No in-memory state across restarts
```

### The Service Worker Lifecycle Problem

Chrome kills service workers to save memory. You cannot rely on them staying alive:

```
Timeline:
T+0s   User clicks extension button
       Service worker starts
       
T+5s   Popup makes API call
       Service worker is active
       
T+10s  API still processing
       Chrome decides to kill service worker (memory pressure)
       Service worker dies
       → API call is orphaned
       → Job state is lost (if it was only in memory)
       
T+15s  User closes popup
       
T+20s  User reopens popup
       Service worker restarts
       → But the job? Lost. Forever.
```

### The Mitigation: Persist State Before Async Operations

Every job must be written to `chrome.storage.local` **before** the async operation starts, not after:

```typescript
// ❌ WRONG: State only in memory
async function handleAnalyzePage(payload) {
  const job = { jobId, status: 'processing' }  // Only in memory!
  
  const response = await api.post('/analyses/jobs', payload)
  
  job.backendJobId = response.jobId  // Still only in memory
  // If service worker dies here, job is lost
}

// ✅ CORRECT: State in storage first
async function handleAnalyzePage(payload) {
  const jobId = generateId()
  
  // Write to storage FIRST
  jobQueue.createJob({
    jobId,
    status: 'queued',
    url: payload.url
  })
  // Job now survives service worker restart
  
  // Then make the API call
  processJobAsync(jobId, payload)
  // If service worker dies, job still exists in storage
}

async function processJobAsync(jobId, payload) {
  try {
    jobQueue.updateJob(jobId, { status: 'processing' })
    
    const response = await api.post('/analyses/jobs', payload)
    
    jobQueue.updateJob(jobId, { backendJobId: response.jobId })
    // Store the backend job ID so we can poll for it later
    
    // Then poll for completion
    await pollJobCompletion(jobId, response.jobId)
    
  } catch (error) {
    jobQueue.updateJob(jobId, { status: 'error', error: error.message })
  }
}
```

### The Pattern: Idempotent Restarts

Design every operation as if it will be restarted:

```typescript
// On service worker wake-up, check for incomplete jobs
chrome.runtime.onStartup?.() // (This doesn't exist in MV3, but the pattern applies)

// Instead, check for incomplete jobs on first message after restart
let initialized = false

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!initialized) {
    // Service worker just woke up
    const jobs = jobQueue.getAllJobs()
    const incomplete = jobs.filter(j => j.status === 'processing')
    
    // Resume polling on all incomplete jobs
    incomplete.forEach(job => {
      if (job.backendJobId) {
        pollJobCompletion(job.jobId, job.backendJobId)
      }
    })
    
    initialized = true
  }
  
  // Handle the incoming message
  // ...
})
```

### Storage Constraints in MV3

`chrome.storage.local` is your persistent state layer:

- **Size limit**: 10 MB per extension
- **Sync**: Synchronous read (but async write)
- **Lifecycle**: Survives service worker restarts
- **Access**: Available to popup, background, and content script (though content script should not use it)

Design your storage schema with limits in mind:

```typescript
// ❌ BAD: Store full page HTML
chrome.storage.local.set({
  jobs: [{
    jobId: 'job_123',
    pageHTML: '<html>... 50KB ...</html>'  // Wastes space!
  }]
})

// ✅ GOOD: Store only metadata + backend reference
chrome.storage.local.set({
  jobs: [{
    jobId: 'job_123',
    backendJobId: 'backend_xyz',
    url: 'https://linear.app/pricing',
    status: 'processing',
    createdAt: 1705334400000
  }]
})
```

---

## WHY PLASMO

### The Build Pipeline Problem Without Plasmo

Building an MV3 extension from scratch requires:

1. **Hand-write manifest.json** with all entry points, permissions, and Web Accessible Resources
2. **Webpack config** for content script (separate from background)
3. **Service worker bundling** (different from regular JS bundling)
4. **Hot reload** (extensions don't auto-reload on file change)
5. **Type safety** (TypeScript + MV3 has quirks)
6. **Testing setup** (message passing is hard to test)

This is ~2 weeks of build system work before you write a single line of extension code.

### What Plasmo Gives You

Plasmo reads your file structure and generates all of this automatically:

```
src/
├── background/background.ts       → Plasmo: Service Worker entry point
├── content/content.ts             → Plasmo: Content script entry point
├── popup/Popup.tsx                → Plasmo: Popup HTML + component
└── options/Options.tsx            → Plasmo: Options page

Plasmo runs build and outputs:
├── manifest.json                  (auto-generated)
├── background.js                  (bundled service worker)
├── content-script.js              (bundled content script)
├── popup.html + popup.js          (bundled popup)
└── options.html + options.js      (bundled options page)
```

You define your entry points by file convention. Plasmo handles the build.

### The Tradeoffs

**Pros:**
- 80% less boilerplate
- Automatic manifest generation
- Built-in hot reload
- TypeScript support out-of-box
- Faster iteration

**Cons:**
- Another abstraction layer (Plasmo config, not just webpack)
- Less control over bundle details
- Debugging build issues requires understanding Plasmo's pipeline

For Phase 1, the speed gain outweighs the abstraction cost. You can always eject to manual webpack later if needed (unlikely).

### Plasmo Version & Stability

- Use Plasmo v0.80+
- Active maintenance and good Discord community
- Chrome Web Store deployments are straightforward

---

## THE ASYNC JOB QUEUE PATTERN

### Why Polling, Not Promises

The naive approach:

```typescript
// ❌ WRONG: Popup awaits async operation
async function analyzeAndWait() {
  const result = await chrome.runtime.sendMessage({
    type: 'ANALYZE_PAGE',
    payload
  })
  // Popup blocks here for 5-30 seconds
  // User sees frozen UI
  // If popup closes, Promise dies
  setInsight(result)
}
```

Problems:
- **Frozen UI** while waiting for API
- **Job lost** if user closes popup mid-wait
- **UX failure** — user thinks extension is broken

### The Job Queue Solution

```typescript
// ✅ CORRECT: Async background work, polling for status

// Popup sends message and immediately returns
chrome.runtime.sendMessage({
  type: 'ANALYZE_PAGE',
  payload
}, (response) => {
  // Response comes immediately: { jobId, status: 'queued' }
  setCurrentJobId(response.jobId)
})

// Popup starts polling for job status
const pollStatus = async () => {
  const job = await chrome.runtime.sendMessage({
    type: 'GET_JOB_STATUS',
    jobId: currentJobId
  })
  
  setJobStatus(job.status)
  
  if (job.status === 'completed') {
    setInsight(job.insight)
    return // Stop polling
  }
  
  if (job.status === 'error') {
    setError(job.error)
    return // Stop polling
  }
  
  // Still processing, poll again
  setTimeout(pollStatus, 1000)
}

pollStatus()
```

### State Flow Diagram

```
Time    Popup             Storage           Background       API
────    ─────             ───────           ──────────       ───
T+0     User clicks
        [Analyze]
        
T+0.1   Sends message   
        to background
                                            Receives message
                                            Creates job: {
                                              status: 'queued'
                                            }
                                                                 
T+0.2                     Writes job
                          to storage
                          (survives
                          restart!)
                          
T+0.3   Receives          Starts reading
        jobId             job status
        Starts polling     every 1s
        
T+0.4                                       Calls API
                                                         → POST /analyses/jobs
                                                           Returns jobId
                          Updates job:
                          status: 'processing'
                          backendJobId: xyz
                          
T+0.5   Polls storage:                     Polling for
        status = processing                completion
        Shows spinner
        
T+0.6   Polls again
        status = processing
        
...     [User can close   Job data persists  API still working
        popup here,       in storage         on backend
        job continues]
        
T+5.0                                       Backend job
                                            completes!
                                            
        [If popup was      Updates job:
        closed, job        status: 'completed'
        data still         insight: { ... }
        exists]
        
T+5.1   User reopens       Finds existing    
        popup              job in storage
        Resumes polling     
        
T+5.2   Polls storage:
        status = completed
        
T+5.3   Shows insight!
        Fully loaded
```

### Polling Intervals & Timeouts

```typescript
// Poll every 1-2 seconds (fast enough for perceived responsiveness)
const POLL_INTERVAL = 1000  // 1 second

// Timeout after 5 minutes (longer analyses have backend timeout)
const MAX_POLL_ATTEMPTS = 300  // 5 minutes / 1 second
let pollAttempts = 0

const poll = async () => {
  pollAttempts++
  
  if (pollAttempts > MAX_POLL_ATTEMPTS) {
    setError('Analysis took too long. Please try again.')
    return
  }
  
  const job = await getJobStatus(jobId)
  
  if (job.status === 'completed' || job.status === 'error') {
    // Done polling
    return
  }
  
  // Still processing, continue
  setTimeout(poll, POLL_INTERVAL)
}
```

---

## CONTENT EXTRACTION & CLASSIFICATION

### Why Extraction Isn't a Simple Scrape

The web is messy. `document.body.innerText` gives you:

```
[Nav links] [Cookie banner] [Actual content] [Footer] [Ads] [More noise]
```

Useful insights require clean data. The extraction strategy is layered:

### Layer 1: Structured Data (Highest Signal)

```typescript
// Extract JSON-LD (schema.org structured data)
// Example: <script type="application/ld+json">{"@type":"Product",...}</script>

const structuredData = Array.from(
  document.querySelectorAll('script[type="application/ld+json"]')
)
  .map(script => {
    try {
      return JSON.parse(script.textContent)
    } catch {
      return null
    }
  })
  .filter(Boolean)
```

Why: Schema.org data is author-curated, machine-readable, and low-noise. If the page author provided JSON-LD, use it.

### Layer 2: Meta Tags (Author-Curated Summaries)

```typescript
// og:title, og:description, twitter:description
// These are what the author wants you to see

const metadata = {
  ogTitle: document.querySelector('meta[property="og:title"]')?.content,
  ogDescription: document.querySelector('meta[property="og:description"]')?.content,
  twitterCard: document.querySelector('meta[name="twitter:card"]')?.content,
}
```

Why: Open Graph tags are author-intentional summaries used for link previews. High signal, low noise.

### Layer 3: Content Region Detection (Semantic HTML)

```typescript
// Find the main content region
const contentRegion = document.querySelector('main')
  || document.querySelector('article')
  || document.querySelector('[role="main"]')
  || document.querySelector('.post-content')  // Common site pattern
  || document.body

// Clone and sanitize
const clone = contentRegion.cloneNode(true)
Array.from(clone.querySelectorAll('script, style, nav, footer, .ad, .comment')).forEach(el => el.remove())
```

Why: `<main>` or `<article>` is semantic HTML that usually marks the actual content. Clone it, remove noise, extract.

### Layer 4: Heading Tree (Document Structure)

```typescript
// Extract h1, h2, h3 to understand document hierarchy
const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
  .map(h => ({
    level: parseInt(h.tagName[1]),
    text: h.innerText,
    id: h.id
  }))
```

Why: Headings are the outline. They give the AI context about the document's structure without requiring full body text.

### Layer 5: Text Extraction (Cleaned Prose)

```typescript
// After identifying content region, extract plain text
const text = contentRegion.innerText
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .join('\n')
```

Why: Plain text is compact, API-friendly, and removes formatting noise.

### The Extraction Pipeline

```typescript
export function extractPageContent(): PageContent {
  return {
    url: window.location.href,
    title: document.title,
    
    // Layer 1: Structured data
    structured: extractStructuredData(),
    
    // Layer 2: Meta tags
    metadata: extractMetadata(),
    
    // Layer 3: Heading tree
    headings: extractHeadings(),
    
    // Layer 4: Prose
    text: extractText(),
    
    // Layer 5: Visual context
    images: extractImages(),
    links: extractLinks(),
  }
}
```

The AI gets:
1. Clean structured data if available
2. Author meta-descriptions as fallback
3. Document structure (headings)
4. Full text for context
5. Visual and link data for additional signals

This is expensive (5-10 network calls worth of API tokens), but it produces high-signal input.

### Page Classification

Before expensive extraction, classify the page type. Different page types need different extraction strategies:

```typescript
type PageType = 
  | 'pricing_page'      // Extract pricing tables, tier names, features
  | 'landing_page'      // Extract value prop, CTA, positioning
  | 'product_page'      // Extract product data schema
  | 'documentation'     // Extract API reference, guides
  | 'reddit'            // Extract comments, sentiment
  | 'product_hunt'      // Extract product data, reviews
  | 'review_site'       // Extract ratings, review text
  | 'blog'              // Extract article metadata, prose
  | 'social_media'      // Extract post text, engagement
  | 'unknown'

// Classifier runs first (cheap)
const pageType = classifyPageType(url, title, metadata)

// Then extraction strategy adapts
switch (pageType) {
  case 'pricing_page':
    // Extract pricing tables specifically
    extractPricingTables()
    extractFeatureComparisons()
    break
    
  case 'reddit':
    // Extract comment threads
    extractComments()
    extractSentiment()
    break
    
  // ...
}
```

Why this matters: A pricing page doesn't need comment extraction. A Reddit thread doesn't have pricing tables. The extraction strategy should specialize per page type.

---

## AUTHENTICATION & FIREBASE INTEGRATION

### Why Firebase Bearer Tokens

SPECKULA already uses Firebase Auth. The extension needs to call the same Fastify backend that the web app calls.

**Options:**

1. **OAuth-style flow** → User signs in via Firebase, extension gets ID token
2. **Session cookies** → Doesn't work cross-origin (extension and web app are different origins)
3. **Custom credentials** → Need to manage separate auth system
4. **Federated identity** → Overkill complexity

**Solution: Firebase ID tokens as Bearer tokens**

This reuses the existing Firebase project without adding new auth infrastructure.

### The Auth Flow

```
Extension Install
  ↓
Check chrome.storage.local for token
  ├─ Token exists + not expired
  │   ↓
  │   Use token, call API
  │
  └─ No token or expired
      ↓
      Show "Sign in" popup
      ↓
      User clicks "Sign in with Google"
      ↓
      Open Firebase Auth flow in popup window
      ↓
      User authenticates with Google
      ↓
      Firebase returns ID token
      ↓
      Store ID token + refresh token in chrome.storage.local
      ↓
      Close popup window
      ↓
      Continue with analysis
```

### Token Management

```typescript
// src/api/auth.ts

let cachedToken: string | null = null
let tokenExpiry: number = 0

export async function getAuthToken(): Promise<string> {
  // Check cache first
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }
  
  // Get from storage
  const stored = await StorageManager.get('speckula_auth_token')
  if (stored && Date.now() < stored.expiry) {
    cachedToken = stored.token
    tokenExpiry = stored.expiry
    return stored.token
  }
  
  // Token expired, refresh
  const refreshToken = await StorageManager.get('speckula_refresh_token')
  if (!refreshToken) {
    throw new Error('Not authenticated')
  }
  
  const newToken = await refreshTokenSilently(refreshToken)
  
  cachedToken = newToken.token
  tokenExpiry = newToken.expiry
  
  await StorageManager.set('speckula_auth_token', {
    token: newToken.token,
    expiry: newToken.expiry
  })
  
  return newToken.token
}

async function refreshTokenSilently(refreshToken: string) {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  
  if (!response.ok) {
    // Refresh failed, need to re-authenticate
    await StorageManager.remove('speckula_auth_token')
    await StorageManager.remove('speckula_refresh_token')
    throw new Error('Authentication expired')
  }
  
  const data = await response.json()
  
  return {
    token: data.idToken,
    expiry: data.expiresAt
  }
}
```

### Token Storage Security

**Risk:** `chrome.storage.local` is accessible to any code in the extension.

**Mitigation:** 
- Store short-lived ID tokens (expiry in 1 hour), not long-term credentials
- Store refresh tokens separately, use only server-side
- Never store raw passwords or API keys
- This security model is the same as storing Firebase session in IndexedDB on the web app

**Best practice:**
```typescript
// ✅ OK: Short-lived token
chrome.storage.local.set({
  speckula_auth_token: {
    token: 'eyJhbGciOiJIUzI1NiIs...',  // Expires in 1 hour
    expiry: Date.now() + 3600000
  }
})

// ❌ WRONG: Long-term token or password
chrome.storage.local.set({
  speckula_api_key: 'sk-abcd1234...'    // Never store this!
})
```

### Firebase Integration

The Fastify backend already validates Firebase tokens:

```typescript
// Backend (fastify/firebase-admin)
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const app = initializeApp({
  credential: cert(serviceAccount)
})

const auth = getAuth(app)

// Validate incoming token
app.post('/api/extension/analyze', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
  
  try {
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid
    
    // Proceed with analysis
    // ...
    
  } catch (error) {
    return reply.code(401).send({ error: 'Invalid token' })
  }
})
```

The extension doesn't need to change Firebase setup — it just needs the new routes.

---

## BACKEND REQUIREMENTS

The extension cannot work without new backend routes. Here's what's critical for each phase:

### Phase 2: Analysis Route (CRITICAL)

```typescript
// POST /api/extension/analyze
// Called by extension when user clicks "Analyze"

interface AnalyzeRequest {
  pageType: string        // 'pricing_page', 'reddit', etc.
  url: string            // Source URL
  content: {
    text: string         // Extracted text
    structured?: any[]   // JSON-LD data
    metadata?: Record    // Meta tags
  }
  selectedText?: string  // Highlighted text (Phase 5+)
  workspaceId?: string   // Optional: which workspace to save to
}

interface AnalyzeResponse {
  jobId: string          // Backend job ID for polling
  status: 'processing' | 'completed' | 'failed'
  insight?: {
    type: InsightType
    summary: string
    evidence: string[]
    tags: string[]
    confidence: number
  }
  error?: string
}

// Inside Fastify handler:
// 1. Validate Firebase token (extension already has this)
// 2. Queue the analysis (async job)
// 3. Return jobId immediately
// 4. Run BMAD pipeline asynchronously
// 5. Store result or error
```

### Phase 2: Job Status Route

```typescript
// GET /api/extension/jobs/{jobId}
// Extension polls this every 1-2 seconds

interface JobStatusResponse {
  jobId: string
  status: 'processing' | 'completed' | 'failed' | 'expired'
  progress?: number            // 0-100
  currentStage?: string        // For UI display
  insight?: AnalysisResult     // When completed
  error?: string               // When failed
}
```

### Phase 3: Capture Route (CRITICAL)

```typescript
// POST /api/extension/capture
// Extension saves analyzed insight to Firestore

interface CaptureRequest {
  insight: AnalysisResult    // Result from /api/extension/analyze
  workspaceId: string        // Which workspace to save to
  tags?: string[]            // Additional tags
  sourceUrl: string          // Original page URL
}

interface CaptureResponse {
  insightId: string          // New document ID in Firestore
  workspaceId: string
  created: string            // ISO timestamp
  deeplink: string           // Link back to this insight in web app
}

// Inside Fastify handler:
// 1. Validate Firebase token
// 2. Create new Firestore document in workspace
// 3. Return insightId + deeplink
// 4. Extension shows "Saved! [View in SPECKULA]" button
```

### Phase 3: User Context Route

```typescript
// GET /api/extension/user/context
// Extension calls this on startup to get user's workspaces

interface UserContextResponse {
  userId: string
  workspaces: {
    workspaceId: string
    name: string
    icon?: string
  }[]
  defaultWorkspace: string   // Where to save by default
}

// Inside Fastify handler:
// 1. Validate Firebase token
// 2. Query Firestore for user's workspaces
// 3. Return list
// 4. Extension uses this in workspace selector
```

### What If These Routes Don't Exist Yet?

**Phase 1** can proceed without any backend work:
- Extraction ✓ (runs locally)
- Classification ✓ (runs locally)
- Auth ✓ (uses existing Firebase)

**Phase 2** (Analysis) **requires:**
- `/api/extension/analyze` endpoint
- `/api/extension/jobs/{jobId}` endpoint
- Full BMAD pipeline implementation

**Phase 3** (Save) **requires:**
- `/api/extension/capture` endpoint
- Firestore write logic

**Timeline:**
- Phase 1 (Weeks 1-2): No backend needed
- Phase 2 (Weeks 3-4): Backend must have `/analyze` and `/jobs` routes
- Phase 3 (Weeks 5-6): Backend must have `/capture` route

Plan backend work in parallel with Phases 1-2 to unblock Phase 3.

---

## PHASE SEQUENCE JUSTIFICATION

### Why This Order (Not Some Other Order)

```
Phase 1: Foundation & Infrastructure
├─ Why: Everything depends on message routing working correctly
├─ If skipped: Every later phase will fail mysteriously
├─ No user value yet (invisible)
└─ Duration: 1-2 weeks

Phase 2: Content Extraction & Classification
├─ Why: Extraction strategy must work before AI analysis
├─ Dependencies: Phase 1 (message passing)
├─ User value: Can see extracted content in popup (debug UI)
└─ Duration: 1-2 weeks

Phase 3: AI Analysis & Job Queue
├─ Why: This is the core feature (where insights come from)
├─ Dependencies: Phase 1 (jobs + storage), Phase 2 (extraction)
├─ User value: ✨ One-click PM intelligence analysis
├─ Backend requirement: /api/extension/analyze route
└─ Duration: 1-2 weeks

Phase 4: Capture & Dashboard Sync
├─ Why: Without saving, analysis is a demo (no retention)
├─ Dependencies: Phase 3 (insights exist), auth already set up
├─ User value: Insights persist in SPECKULA dashboard
├─ Backend requirement: /api/extension/capture route
└─ Duration: 1 week

Phase 5: Context Menu & UX Polish
├─ Why: Surface-level feature that reuses core pipeline
├─ Dependencies: Phase 1-4 (all working)
├─ User value: Right-click menu is more discoverable
├─ Browser requirement: contextMenus permission (already in manifest)
└─ Duration: 1 week

Phase 6: Smart Suggestions (Future)
├─ Why: Proactive intel requires understanding user patterns
├─ Dependencies: Real user data from Phase 1-5
├─ Research needed: When to interrupt user? How to prioritize?
└─ Not in 2025 roadmap

Phase 7: Collaborative Features (Future)
├─ Why: Requires multi-user backend logic
├─ Dependencies: Phase 1-5 stable, real usage patterns
└─ Not in 2025 roadmap
```

### What If You Skip a Phase?

**Skip Phase 1:** ❌
Every later phase fails. Message passing is broken, storage schema is wrong, you'll rebuild everything. Don't skip.

**Skip Phase 2:** ❌
Phase 3 (analysis) has no input data. You can't analyze garbage input, so you'll have to backfill extraction logic later.

**Skip Phase 3 for Phase 4:** ❌
You can't save insights that don't exist. Phase 3 is the core; Phase 4 is dependent.

**Skip Phase 4 and jump to Phase 5:** ⚠️
Technically possible (Phase 5 doesn't depend on Phase 4), but users can't save, so why use the extension? Don't skip.

**Skip Phase 5, jump to Phase 6:** ✓
Possible, but Phase 5 (context menu) is a UX win. Do Phase 5 first.

---

## CRITICAL RISKS & MITIGATIONS

### Risk 1: Service Worker Lifecycle Unpredictability

**What goes wrong:**
Chrome kills the service worker mid-analysis. Job is lost. User sees a spinner that never resolves.

**Mitigation:**
- Persist job to storage before API call
- Design operations as idempotent (can retry safely)
- Check for orphaned jobs on service worker wake-up
- Show "job not found, please retry" error gracefully

**Test:** 
- Kill service worker manually (chrome://extensions, DevTools for service worker)
- Verify job still exists in storage
- Verify popup can reattach and poll

---

### Risk 2: Content Security Policy Conflicts

**What goes wrong:**
Page has strict CSP that blocks `chrome.scripting.executeScript()`. Content script injection fails. No extraction.

**Example CSP header:**
```
Content-Security-Policy: script-src 'self'; object-src 'none';
```

This blocks:
- Dynamic script injection
- Eval and unsafe-inline
- External scripts

**Mitigation:**
- Design extraction to work with content script only (no need for executeScript)
- Graceful fallback: if full extraction fails, use meta tags only
- Show user degraded state instead of error: "Could only extract limited content from this page"

**Test:**
- Test on banking sites (strict CSP)
- Test on enterprise SaaS (strict CSP)
- Test on public sites (loose CSP)

---

### Risk 3: Firebase Token Expiry in Long Sessions

**What goes wrong:**
User opens popup after 2 hours. Token expired. API call fails with 401. User has to re-sign in, which is jarring in a popup.

**Mitigation:**
- Check token expiry before every API call
- Silently refresh using refresh token before call
- Only show sign-in UI if refresh fails
- Log the "refresh failed" error so you know it happened

**Test:**
- Store token in localStorage
- Wait for expiry (or mock expiry)
- Open popup
- Verify refresh happens silently

---

### Risk 4: API Rate Limiting

**What goes wrong:**
User clicks "Analyze" 10 times in a row. API quota exhausted. User is blocked.

**Mitigation:**
- Rate limit on client side: disable Analyze button while job is in progress
- Rate limit on server side: reject requests from same user if >N/minute
- Show user a helpful error: "Too many analyses. Please wait 1 minute."
- Queue requests instead of rejecting

**Test:**
- Rapid-fire clicks on Analyze button
- Verify button is disabled while job is in progress
- Monitor API usage in logs

---

### Risk 5: Chrome Storage Quota Exceeded

**What goes wrong:**
After 1000 analyses, chrome.storage.local is full (10 MB limit). New jobs can't be saved. Extension breaks.

**Mitigation:**
- Periodically clean up old jobs (delete after 30 days)
- Show warning when storage is >80% full
- Offer manual "Clear old analyses" button in settings

**Test:**
- Create many jobs to fill storage
- Verify cleanup works
- Verify warning shows at 80%

---

## THE ARCHITECTURAL THESIS

### What This Extension Is

The SPECKULA extension is **a thin client over your existing backend**, optimized for the specific constraints of the Chrome extension platform.

It is NOT:
- A fully autonomous agent (AI stays server-side)
- A replacement for the web app (it feeds data to the web app)
- A standalone product (it requires Firestore + Fastify + Firebase Auth)

It IS:
- A distribution channel for SPECKULA into the user's browser
- A context-switch remover (discover → capture without alt-tab)
- A data collection pipeline (feeds the web app with structured intelligence)

### Why This Architecture Works

1. **Removes friction at the moment of engagement** → User captures insights while reading, not later
2. **Survives platform constraints** → Service worker restarts don't break jobs
3. **Reuses existing infrastructure** → No new databases, no new auth system, no new API server
4. **Scales with complexity** → Phases 1-5 ship a coherent feature each week; Phases 6-7 can be added later when you understand user patterns

### The Architectural Narrative

```
Week 1-2: Foundation
Build the message-passing infrastructure. Nobody sees this work, but everything depends on it.

Week 3-4: Extraction
Teach the extension to extract valuable signals from any webpage. Show users they can see clean data in the popup.

Week 5-6: Intelligence
Wire up the AI analysis. Users now see structured PM insights appear in the popup in 5-30 seconds.

Week 7-8: Persistence
Let users save insights to their dashboard. The extension becomes a capture device for the web app.

Week 9-10: Discovery
Right-click menu makes the extension more discoverable. Context menu is a UX pattern users expect.

Week 11+: Autonomy (Future)
Once you have real usage data, build autonomous monitoring. But only after the core is validated.
```

### The Build vs. Integrate Decision

Should the extension have its own AI models (run locally), or call the backend?

**Local AI (in extension):**
- Pro: Instant analysis, works offline
- Con: Large model files (100MB+), high CPU, quick battery drain, difficult updates

**Backend AI (call Fastify):**
- Pro: Smaller bundle, powerful models, easy updates, monitoring
- Con: Network dependency

**Decision: Backend AI**

The 5-30 second latency is acceptable. The benefits of server-side AI outweigh instant local analysis. If future usage shows users need sub-second response, you can cache results or pre-analyze top competitors.

---

## NEXT CHECKPOINT

Before Phase 1, align on:

1. **Backend routes**: Confirm `/api/extension/analyze` will be ready by Week 3
2. **Firestore schema**: Agree on insight document structure
3. **Firebase project**: Verify SPECKULA's existing Firebase project is used
4. **Plasmo version**: Use latest v0.80+
5. **Team**: Designer (for popup UI), Backend eng (for routes), Frontend eng (for extension)

Everything else follows from the architecture described here.

