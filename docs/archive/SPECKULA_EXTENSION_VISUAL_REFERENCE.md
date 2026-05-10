# SPECKULA EXTENSION
## Visual Architecture & Quick Reference

---

## TABLE OF CONTENTS

1. [Message Flow Diagrams](#message-flow-diagrams)
2. [Component Relationship Map](#component-relationship-map)
3. [Data Flow Timeline](#data-flow-timeline)
4. [API Routes Quick Reference](#api-routes-quick-reference)
5. [TypeScript Type Quick Reference](#typescript-type-quick-reference)
6. [Chrome Storage Schema](#chrome-storage-schema)
7. [Error Handling Matrix](#error-handling-matrix)
8. [Performance Targets](#performance-targets)

---

## MESSAGE FLOW DIAGRAMS

### Flow 1: User Clicks "Analyze with SPECKULA"

```
┌─────────────────────────────────────────────────────────────┐
│                         USER ACTION                         │
│                  Right-click on webpage                     │
│                                                             │
│  Context Menu: [Analyze with SPECKULA]                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICE                       │
│                    (background.ts)                          │
│                                                             │
│  1. contextMenu.handleClick() fires                        │
│  2. chrome.tabs.query(activeTab)                           │
│  3. Open popup.html for user                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    POPUP UI OPENS                           │
│                    (Popup.tsx)                              │
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │  SPECKULA - Product Intelligence    │                  │
│  │                                      │                  │
│  │  [Analyze This Page]  [Settings]     │                  │
│  └──────────────────────────────────────┘                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
          User clicks: [Analyze This Page]
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      POPUP LOGIC                            │
│                    (Popup.tsx)                              │
│                                                             │
│  1. handleAnalyzeClick()                                   │
│  2. chrome.tabs.sendMessage(tab.id, EXTRACT_PAGE)          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   CONTENT SCRIPT                            │
│                   (content.ts)                              │
│                                                             │
│  1. Receive EXTRACT_PAGE message                           │
│  2. Call extractPageContent()                              │
│  3. Call classifyPageType()                                │
│  4. Return content + pageType                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      POPUP RECEIVES                         │
│                   Content + PageType                        │
│                                                             │
│  1. Store in state                                         │
│  2. Show: "Sending to SPECKULA..."                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  POPUP MESSAGES BACKGROUND                  │
│                     ANALYZE_PAGE                            │
│                                                             │
│  Message: {                                                │
│    type: 'ANALYZE_PAGE',                                   │
│    payload: {                                              │
│      content,                                              │
│      metadata,                                             │
│      pageType,                                             │
│      selectedText                                          │
│    }                                                       │
│  }                                                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKGROUND WORKER                        │
│                   (background.ts)                           │
│                                                             │
│  1. handleAnalyzePage(payload)                             │
│  2. Create local job in queue                              │
│  3. Return jobId to popup                                  │
│  4. processJobAsync() in background                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      POPUP UPDATES                          │
│                                                             │
│  Display: AnalysisStatus component                         │
│                                                             │
│  ✓ Extracting Content                                      │
│  ✓ Detecting Page Type                                     │
│  • Analyzing Positioning                                   │
│  • Generating Insights                                     │
│  • Saving to SPECKULA                                      │
│                                                             │
│  [Cancel]                                                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                    (In background...)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   API CALL (Async)                          │
│              (from Background Worker)                       │
│                                                             │
│  POST /analyses/jobs                                       │
│  {                                                         │
│    url,                                                    │
│    content,                                                │
│    pageType,                                               │
│    metadata                                                │
│  }                                                         │
│                                                             │
│  ↓ Response: { jobId, status: 'processing' }              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   POLL JOB STATUS                           │
│            (background.ts every 2.5 seconds)               │
│                                                             │
│  GET /analyses/jobs/{backendJobId}                         │
│                                                             │
│  ↓ Response: { status: 'processing' | 'completed' }       │
└────────────────────────────┬────────────────────────────────┘
                             │
                   Job completed on backend
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKGROUND UPDATES JOB STATE                   │
│                                                             │
│  jobQueue.updateJob(jobId, {                              │
│    status: 'completed',                                    │
│    insight: { ... }                                        │
│  })                                                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         BACKGROUND NOTIFIES POPUP (Message)                 │
│                                                             │
│  chrome.runtime.sendMessage({                              │
│    type: 'JOB_COMPLETED',                                  │
│    jobId                                                   │
│  })                                                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     POPUP UPDATES                           │
│                                                             │
│  Display: InsightPreview component                         │
│                                                             │
│  Insight Card:                                             │
│  ┌────────────────────────────────────────┐               │
│  │ Competitor Positioning: Linear         │               │
│  │                                        │               │
│  │ "Strong developer-focused..."          │               │
│  │                                        │               │
│  │ Tags: UX, Developer Tools, B2B SaaS   │               │
│  │ Confidence: 85%                        │               │
│  │                                        │               │
│  │ [Save to Dashboard]  [Close]           │               │
│  └────────────────────────────────────────┘               │
└────────────────────────────┬────────────────────────────────┘
                             │
                    User clicks: [Save to Dashboard]
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              POPUP SENDS SAVE REQUEST                       │
│                                                             │
│  POST /insights                                            │
│  {                                                         │
│    insight,                                                │
│    workspace_id,                                           │
│    tags,                                                   │
│    source_url                                              │
│  }                                                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND SAVES                            │
│                                                             │
│  Response: { insightId, saved: true }                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  POPUP SUCCESS STATE                        │
│                                                             │
│  ✓ Insight saved to SPECKULA!                             │
│                                                             │
│  [Open Dashboard]  [Analyze Another]                       │
└─────────────────────────────────────────────────────────────┘
```

---

## COMPONENT RELATIONSHIP MAP

```
Extension Root
│
├── Background Service Worker (background.ts)
│   ├── setupContextMenu() → contextMenu.ts
│   ├── JobQueue (jobQueue.ts)
│   ├── APIClient (api/client.ts)
│   └── Message Router
│       ├── ANALYZE_PAGE → handleAnalyzePage()
│       ├── GET_JOB_STATUS → getJobStatus()
│       └── CANCEL_JOB → cancelJob()
│
├── Content Script (content.ts)
│   ├── extractPageContent() → extractor.ts
│   │   ├── extractMetadata()
│   │   ├── extractMainContent()
│   │   ├── extractText()
│   │   ├── extractStructuredData()
│   │   └── extractLinks()
│   │
│   ├── classifyPageType() → classifier.ts
│   │   ├── URL pattern matching
│   │   ├── Text-based classification
│   │   └── Return PageType enum
│   │
│   └── Message Listener
│       └── EXTRACT_PAGE → return content + pageType
│
├── Popup UI (popup/Popup.tsx)
│   ├── View States
│   │   ├── Home View
│   │   │   ├── Analyze Button
│   │   │   ├── Dashboard Button
│   │   │   └── Settings Button
│   │   │
│   │   ├── Analyzing View
│   │   │   └── AnalysisStatus.tsx
│   │   │       ├── Progress Stages
│   │   │       └── Cancel Button
│   │   │
│   │   ├── Result View
│   │   │   └── InsightPreview.tsx
│   │   │       ├── Insight Card
│   │   │       ├── Save Button
│   │   │       └── Close Button
│   │   │
│   │   └── Settings View
│   │       └── Settings.tsx
│   │           ├── Auth Form
│   │           └── Preferences
│   │
│   └── Message Sender
│       ├── chrome.tabs.sendMessage (EXTRACT_PAGE)
│       └── chrome.runtime.sendMessage (ANALYZE_PAGE)
│
├── API Layer (api/)
│   ├── APIClient (client.ts)
│   │   ├── post()
│   │   ├── get()
│   │   ├── put()
│   │   └── delete()
│   │
│   ├── Auth (auth.ts)
│   │   ├── getAuthToken()
│   │   ├── setAuthToken()
│   │   ├── isTokenExpired()
│   │   └── refreshToken()
│   │
│   └── Types (types.ts)
│       ├── AnalysisJobRequest
│       ├── AnalysisJobResponse
│       └── Insight
│
└── Utilities (utils/)
    ├── StorageManager (storage.ts)
    ├── Logger (logger.ts)
    ├── Validators (validators.ts)
    └── Constants (constants.ts)
```

---

## DATA FLOW TIMELINE

```
Time  Component              Action
────  ──────────────────────────────────────────────────────────
T+0s  Popup                  User clicks [Analyze This Page]
      
T+0.1s Popup → Content       chrome.tabs.sendMessage(EXTRACT_PAGE)
      
T+0.2s Content Script        Extracts page content
                             Classifies page type
      
T+0.3s Content → Popup       Returns { content, pageType }
      
T+0.4s Popup                 chrome.runtime.sendMessage(ANALYZE_PAGE)
      
T+0.5s Popup                 Shows AnalysisStatus (3 stages completed)
      
T+0.6s Background            handleAnalyzePage(payload)
                             Creates local job in queue
                             Returns jobId
      
T+0.7s Background            processJobAsync() starts
      
T+0.8s API Call              POST /analyses/jobs
                             (Network latency: 100-500ms)
      
T+1.3s Backend               Receives job
                             Creates async task
                             Returns { jobId, status: 'processing' }
      
T+1.4s Background            pollJobCompletion(jobId)
                             First poll attempt
      
T+1.4s to T+3.9s             AI Pipeline Processing
      Backend                 (Phase 2-3 of BMAD pipeline)
                             (Human approval gates)
                             (Typical time: 5-20 seconds)
      
T+4.0s Backend               Job completed
                             Stores insight
      
T+4.1s Background (poll)     GET /analyses/jobs/{jobId}
                             Receives { status: 'completed', insight }
      
T+4.2s Background            Updates local job queue
                             Calls notifyJobCompletion(jobId)
      
T+4.3s Background → Popup    chrome.runtime.sendMessage(JOB_COMPLETED)
      
T+4.4s Popup                 showJobCompletion()
                             Switch view to result
      
T+4.5s Popup                 Render InsightPreview
      
T+4.6s User                  Sees completed insight!
                             Can save to dashboard or analyze another

T+5.0s User Action           Clicks [Save to Dashboard]
      
T+5.1s Popup → Backend       POST /insights { insight }
      
T+5.5s Backend               Saves insight
      
T+5.6s Popup                 Shows success message
      
T+6.0s                       ✓ Complete!
```

---

## API ROUTES QUICK REFERENCE

### Job Management Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/analyses/jobs` | POST | Create new analysis job | JWT |
| `/analyses/jobs/{jobId}` | GET | Check job status | JWT |
| `/analyses/jobs/{jobId}` | DELETE | Cancel job | JWT |
| `/insights` | POST | Save insight to dashboard | JWT |
| `/insights` | GET | List user's insights | JWT |
| `/insights/{insightId}` | GET | Get single insight | JWT |
| `/insights/{insightId}` | PUT | Update insight | JWT |
| `/insights/{insightId}` | DELETE | Delete insight | JWT |

### Request/Response Examples

**POST /analyses/jobs**
```json
Request:
{
  "url": "https://linear.app/pricing",
  "content": { "html": "...", "text": "...", "metadata": {...} },
  "pageType": "pricing_page",
  "selectedText": ""
}

Response (Success):
{
  "jobId": "job_abc123",
  "status": "processing"
}

Response (Error):
{
  "error": "Invalid URL",
  "code": "INVALID_REQUEST"
}
```

**GET /analyses/jobs/{jobId}**
```json
Response (Processing):
{
  "jobId": "job_abc123",
  "status": "processing",
  "currentStage": "analyzing_positioning",
  "progress": 60
}

Response (Completed):
{
  "jobId": "job_abc123",
  "status": "completed",
  "insight": {
    "id": "insight_xyz789",
    "type": "competitor_positioning",
    "summary": "Linear emphasizes...",
    "evidence": ["Fast", "Minimal UI"],
    "tags": ["UX", "Developer Tools"],
    "confidence": 0.85,
    "sourceUrl": "https://linear.app/pricing",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

Response (Error):
{
  "jobId": "job_abc123",
  "status": "failed",
  "error": "AI processing failed"
}
```

---

## TYPESCRIPT TYPE QUICK REFERENCE

### Job Types

```typescript
// Local job (extension)
interface Job {
  jobId: string              // Local ID: job_123456789
  backendJobId?: string      // Backend ID: xyz789
  url: string                // Source URL
  status: JobStatus          // pending | processing | completed | error | cancelled
  insight?: Insight          // Result (when completed)
  error?: string             // Error message (if failed)
  createdAt: number          // Timestamp
  completedAt?: number       // Completion timestamp
  tabId?: number             // Chrome tab ID
}

type JobStatus = 'pending' | 'processing' | 'completed' | 'error' | 'cancelled'
```

### Content Types

```typescript
interface PageContent {
  url: string
  title: string
  metadata: PageMetadata
  html: string               // Raw HTML (stripped of noise)
  text: string               // Plain text extraction
  structured: any[]          // JSON-LD structured data
  images: string[]           // Image URLs
  links: string[]            // Link URLs
  accessibility: string      // Accessibility tree
}

interface PageMetadata {
  url: string
  title: string
  description: string | null
  ogImage: string | null
  ogTitle: string | null
  ogDescription: string | null
  favicon: string | null
  lang: string
  viewport: string | null
}
```

### Insight Types

```typescript
interface Insight {
  id: string                 // Unique ID
  type: InsightType          // Category
  company?: string           // Company mentioned
  summary: string            // Main finding
  evidence: string[]         // Supporting details
  tags: string[]             // Categories/tags
  confidence: number         // 0.0-1.0 confidence score
  sourceUrl: string          // Original page
  timestamp: string          // ISO timestamp
  metadata?: Record<string, any>  // Extensible
}

type InsightType = 
  | 'competitor_positioning'
  | 'pricing_analysis'
  | 'ux_analysis'
  | 'market_signal'
  | 'gtm_analysis'
  | 'feature_intelligence'

type PageType = 
  | 'pricing_page'
  | 'landing_page'
  | 'product_page'
  | 'documentation'
  | 'reddit'
  | 'product_hunt'
  | 'review_site'
  | 'blog'
  | 'social_media'
  | 'unknown'
```

### Message Types

```typescript
// Chrome message format
interface ChromeMessage {
  type: MessageType
  payload?: any
  jobId?: string
}

type MessageType = 
  | 'EXTRACT_PAGE'
  | 'ANALYZE_PAGE'
  | 'GET_JOB_STATUS'
  | 'CANCEL_JOB'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
```

---

## CHROME STORAGE SCHEMA

### Local Storage Layout

```
chrome.storage.local = {
  // Authentication
  "speckula_auth_token": "eyJhbGciOiJIUzI1NiIs...",
  "speckula_user_id": "user_abc123",
  "speckula_workspace_id": "ws_xyz789",
  
  // Jobs queue
  "speckula_jobs": {
    "job_1234567890_abc123": {
      jobId: "job_1234567890_abc123",
      url: "https://linear.app/pricing",
      status: "completed",
      insight: { ... },
      createdAt: 1705334400000,
      completedAt: 1705334450000
    },
    "job_1234567891_def456": {
      jobId: "job_1234567891_def456",
      url: "https://reddit.com/r/startup",
      status: "processing",
      createdAt: 1705334500000
    }
  },
  
  // Settings
  "speckula_settings": {
    autoSaveInsights: true,
    showNotifications: true,
    enableAnalytics: true
  },
  
  // Recent analysis history
  "speckula_recent": [
    {
      jobId: "job_1234567890_abc123",
      url: "https://linear.app/pricing",
      title: "Linear Pricing",
      pageType: "pricing_page",
      timestamp: 1705334400000
    },
    // ... up to 20 recent
  ]
}
```

### Storage Limits

- **Total**: 10 MB per extension
- **Recommended usage**: <5 MB
- **Job retention**: Delete after 30 days

---

## ERROR HANDLING MATRIX

| Scenario | Component | Error Message | Recovery |
|----------|-----------|---------------|----------|
| No auth token | Popup | "Not authenticated. Sign in in settings." | Show Settings view |
| Content extraction fails | Content Script | "Unable to extract page content" | Retry or manual paste |
| API request fails (network) | APIClient | "Network error. Check connection." | Auto-retry with backoff |
| API request fails (401) | APIClient | "Authentication failed. Re-login." | Refresh token or re-auth |
| Job timeout (>5 min) | Background | "Analysis taking too long" | Offer cancel option |
| Backend job fails | Background (poll) | "Analysis failed: {error}" | Show error in popup |
| Job cancelled by user | Popup | "Analysis cancelled" | Return to home view |
| Chrome storage quota exceeded | Storage Manager | "Storage full. Clear old analyses." | Offer cleanup UI |

---

## PERFORMANCE TARGETS

### Phase 1 Benchmarks

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Extension load time | <500ms | chrome://extensions, DevTools Lighthouse |
| Content extraction | <500ms | Time from EXTRACT_PAGE to response |
| Page classification | <100ms | Time for classifyPageType() |
| Popup open time | <200ms | User perceivable delay |
| Message round-trip (popup→bg→content) | <1s | Console timing |
| Memory footprint | <20MB | Chrome Task Manager |
| Extension bundle size | <2MB | npm run build output |

### Phase 2+ Benchmarks

| Metric | Target |
|--------|--------|
| Full job processing time | <30 seconds |
| Job status polling latency | <2 seconds |
| Insight save time | <5 seconds |
| Dashboard link open | <1 second |

### Resource Limits

```
Background Service Worker:
  - CPU: Minimal (polling every 2.5s only)
  - Memory: <10MB
  - Network: 1 active request max

Content Script:
  - CPU: Minimal (runs on demand)
  - Memory: <5MB
  - Network: 1 request per analysis

Popup:
  - React render time: <100ms
  - Memory: <5MB
  - Local storage reads: <10ms
```

---

## QUICK DECISION TREE

**"Why isn't my extension working?"**

```
Does it load in Chrome?
├─ No → Check manifest.json syntax
│       Check build output for errors
│       Check Chrome console for permission errors
│
└─ Yes → Does popup open?
   ├─ No → Check popup.html exists
   │       Check popup.tsx renders
   │       Check permissions in manifest
   │
   └─ Yes → Does "Analyze" button work?
      ├─ No → Check content script loads
      │       Check message type matches
      │       Check sendMessage syntax
      │
      └─ Yes → Does job queue?
         ├─ No → Check background.ts listens for messages
         │       Check background.ts creates jobs
         │       Check Chrome storage available
         │
         └─ Yes → Does API call work?
            ├─ No → Check API URL in .env
            │       Check auth token exists
            │       Check network tab for failures
            │
            └─ Yes → Does status polling work?
               └─ Check polling interval (2.5s)
                  Check backend returns correct response
```

---

## GLOSSARY

| Term | Definition |
|------|-----------|
| **Manifest** | Extension configuration file (manifest.json) |
| **Service Worker** | Background script that runs continuously |
| **Content Script** | Script injected into webpage DOM |
| **Popup** | Small UI window that appears on extension click |
| **Message** | Communication between components via `chrome.runtime.sendMessage` |
| **Job** | Single analysis request (local or backend) |
| **Job ID** | Unique identifier for analysis job |
| **Insight** | Final analysis result with structured data |
| **Page Type** | Classification of webpage (pricing, landing, etc.) |
| **JWT Token** | JSON Web Token for API authentication |

