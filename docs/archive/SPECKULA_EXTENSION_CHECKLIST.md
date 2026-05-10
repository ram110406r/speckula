# SPECKULA EXTENSION
## Implementation Checklist & Developer Guide

---

## TABLE OF CONTENTS

1. [Phase 1 Checklist](#phase-1-checklist)
2. [Code Scaffolding Templates](#code-scaffolding-templates)
3. [Development Workflows](#development-workflows)
4. [Testing Strategy](#testing-strategy)
5. [Debugging Guide](#debugging-guide)
6. [API Contract Template](#api-contract-template)

---

## PHASE 1 CHECKLIST

### Week 1: Project Setup & Scaffolding

- [ ] Initialize Plasmo project
  - [ ] Run `plasmo init speckula-extension`
  - [ ] Choose React + TypeScript
  - [ ] Verify build works: `npm run build`

- [ ] Project Structure
  - [ ] Create `/src/background`, `/src/content`, `/src/popup`, `/src/api` directories
  - [ ] Create `/src/types` for TypeScript definitions
  - [ ] Create `/src/utils` for helpers
  - [ ] Create `/public/icons` for extension icons

- [ ] Configuration Files
  - [ ] Create `.env.example` with API URL placeholder
  - [ ] Create `.eslintrc.json` for code quality
  - [ ] Create `.prettierrc` for formatting
  - [ ] Update `tsconfig.json` with strict mode

- [ ] Package Dependencies
  - [ ] Install React 18+
  - [ ] Install TypeScript 5+
  - [ ] Install Tailwind CSS
  - [ ] Install shadcn/ui components (optional, for polish)

**Acceptance**: `npm run build` produces clean build with no errors

---

### Week 1-2: Content Extractor Implementation

- [ ] Implement `src/content/extractor.ts`
  - [ ] `extractPageContent()` function
  - [ ] `extractMetadata()` for meta tags
  - [ ] `extractText()` for main content
  - [ ] `extractStructuredData()` for JSON-LD
  - [ ] `extractLinks()` for navigation
  - [ ] `extractImages()` for visual context

- [ ] Implement `src/content/classifier.ts`
  - [ ] `classifyPageType()` function
  - [ ] URL pattern matching (pricing, docs, Reddit, ProductHunt)
  - [ ] Text-based classification (keywords, structure)
  - [ ] Return PageType enum

- [ ] Test Extractor on Pages
  - [ ] Test on Linear (saas pricing page)
  - [ ] Test on Reddit thread
  - [ ] Test on ProductHunt launch
  - [ ] Test on Notion landing page
  - [ ] Test on blog post
  - [ ] Verify extraction accuracy

- [ ] Type Definitions
  - [ ] Create `src/types/analysis.ts` with PageContent, PageMetadata
  - [ ] Create `src/types/api.ts` with API request/response types
  - [ ] Create `src/types/extension.ts` for Chrome-specific types

**Acceptance**: Extractor extracts >90% of useful content; classifier accurate on 5+ page types

---

### Week 2: Background Service Worker

- [ ] Implement `src/background/background.ts`
  - [ ] Extension install handler
  - [ ] Message listener for ANALYZE_PAGE
  - [ ] Message listener for GET_JOB_STATUS
  - [ ] Message listener for CANCEL_JOB
  - [ ] Error handling for all paths

- [ ] Implement `src/background/contextMenu.ts`
  - [ ] Add context menu item "Analyze with SPECKULA"
  - [ ] Handle context menu click
  - [ ] Send message to popup or background

- [ ] Implement `src/background/jobQueue.ts`
  - [ ] JobQueue class with Map storage
  - [ ] `createJob()` method
  - [ ] `getJob()` and `updateJob()` methods
  - [ ] `getAllJobs()` and `getActiveJobs()` methods
  - [ ] Persistence to Chrome storage

- [ ] Implement `src/background/storage.ts`
  - [ ] `get()` and `set()` for Chrome storage
  - [ ] Async/Promise-based API
  - [ ] Error handling for quota exceeded

**Acceptance**: Messages flow between popup → background → content script; jobs persist in storage

---

### Week 2: Content Script

- [ ] Implement `src/content/content.ts`
  - [ ] Listen for EXTRACT_PAGE message
  - [ ] Call extractor and classifier
  - [ ] Return structured content
  - [ ] Error handling

- [ ] Verify Communication
  - [ ] Test message passing popup → content script
  - [ ] Test message passing content script → background
  - [ ] Check Chrome DevTools for no errors

**Acceptance**: Content script loads on all pages; extraction messages work without errors

---

### Week 2-3: API Client

- [ ] Implement `src/api/client.ts`
  - [ ] APIClient class
  - [ ] `post()`, `get()`, `put()`, `delete()` methods
  - [ ] Request/response handling
  - [ ] Error handling
  - [ ] Timeout handling

- [ ] Implement `src/api/auth.ts`
  - [ ] `getAuthToken()` from Chrome storage
  - [ ] `setAuthToken()` and `removeAuthToken()`
  - [ ] `isTokenExpired()` check
  - [ ] `refreshToken()` logic (if needed)

- [ ] Implement `src/api/endpoints.ts`
  - [ ] Define endpoint URLs
  - [ ] Document request/response schemas
  - [ ] Comments for each endpoint

**Acceptance**: API client can make authenticated requests; token management works

---

### Week 3: Popup UI (Basic)

- [ ] Implement `src/popup/Popup.tsx`
  - [ ] Home view with Analyze button
  - [ ] Settings view for auth
  - [ ] View state management
  - [ ] Message sending to background

- [ ] Implement `src/popup/AnalysisStatus.tsx`
  - [ ] Display job status
  - [ ] Show analysis stages
  - [ ] Cancel button
  - [ ] Visual progress indicator

- [ ] Create `src/popup/popup.css` or `popup.module.css`
  - [ ] Basic styling for popup (300px width)
  - [ ] Button styles
  - [ ] Status stages display
  - [ ] Loading spinner

- [ ] Create `public/popup.html`
  - [ ] Root div for React
  - [ ] Script tags for React + popup.tsx

**Acceptance**: Popup opens, shows Analyze button, can click to trigger analysis

---

### Testing Phase 1

- [ ] Unit Tests
  - [ ] `extractor.test.ts` - test extraction on sample HTML
  - [ ] `classifier.test.ts` - test page type classification
  - [ ] `jobQueue.test.ts` - test job CRUD operations

- [ ] Integration Tests
  - [ ] Test message flow: popup → background → content script
  - [ ] Test job creation and status retrieval
  - [ ] Test error scenarios

- [ ] Manual Testing
  - [ ] Load unpacked extension in Chrome
  - [ ] Test on 5+ real websites
  - [ ] Check Chrome DevTools for errors
  - [ ] Verify popup UI renders

**Acceptance**: All tests pass; extension loads with no errors; basic flow works end-to-end

---

## CODE SCAFFOLDING TEMPLATES

### Template 1: Basic Content Extractor

```typescript
// src/content/extractor.ts
export interface PageContent {
  url: string
  title: string
  text: string
  metadata: any
}

export function extractPageContent(): PageContent {
  return {
    url: window.location.href,
    title: document.title,
    text: extractMainText(),
    metadata: extractMetadata()
  }
}

function extractMainText(): string {
  // Get the main content area
  const main = document.querySelector('main, article, [role="main"]')
  if (main) {
    return main.innerText
  }
  return document.body.innerText
}

function extractMetadata(): Record<string, string> {
  const metadata: Record<string, string> = {}
  
  // Extract all meta tags
  document.querySelectorAll('meta').forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property')
    const content = meta.getAttribute('content')
    if (name && content) {
      metadata[name] = content
    }
  })

  return metadata
}
```

### Template 2: Basic Page Classifier

```typescript
// src/content/classifier.ts
export type PageType = 'pricing' | 'landing' | 'blog' | 'product' | 'unknown'

export function classifyPageType(url: string, title: string): PageType {
  const urlLower = url.toLowerCase()
  const titleLower = title.toLowerCase()

  // Check URL patterns
  if (urlLower.includes('pricing') || urlLower.includes('plans')) {
    return 'pricing'
  }

  if (urlLower.includes('blog')) {
    return 'blog'
  }

  if (urlLower.includes('product') || urlLower.includes('docs')) {
    return 'product'
  }

  // Check title patterns
  if (titleLower.includes('price') || titleLower.includes('plans')) {
    return 'pricing'
  }

  return 'landing'
}
```

### Template 3: Basic API Client

```typescript
// src/api/client.ts
export class APIClient {
  private baseUrl: string
  private authToken: string | null = null

  constructor(baseUrl: string = 'https://api.speckula.ai') {
    this.baseUrl = baseUrl
    this.loadAuthToken()
  }

  private loadAuthToken(): void {
    chrome.storage.local.get('auth_token', (result) => {
      this.authToken = result.auth_token || null
    })
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return await response.json()
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return await response.json()
  }
}
```

### Template 4: Basic Background Worker

```typescript
// src/background/background.ts
import { APIClient } from '../api/client'
import { JobQueue } from './jobQueue'

const api = new APIClient()
const jobs = new JobQueue()

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_PAGE') {
    handleAnalyzePage(request.payload, sender.tab)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }))
    return true
  }

  if (request.type === 'GET_JOB_STATUS') {
    const job = jobs.getJob(request.jobId)
    sendResponse(job)
  }
})

async function handleAnalyzePage(payload: any, tab: any) {
  // Create local job
  const jobId = jobs.createJob({
    url: payload.url,
    status: 'processing',
    createdAt: Date.now()
  })

  // Send to backend asynchronously
  processJobAsync(jobId, payload)

  return { jobId, status: 'queued' }
}

async function processJobAsync(jobId: string, payload: any) {
  try {
    const response = await api.post('/analyses/jobs', payload)
    jobs.updateJob(jobId, { backendJobId: response.jobId })
    
    // Poll for completion
    await pollJobStatus(jobId, response.jobId)
  } catch (error) {
    jobs.updateJob(jobId, { status: 'error', error: error.message })
  }
}

async function pollJobStatus(jobId: string, backendJobId: string) {
  const status = await api.get(`/analyses/jobs/${backendJobId}`)
  
  if (status.status === 'completed') {
    jobs.updateJob(jobId, { status: 'completed', insight: status.insight })
  } else if (status.status === 'failed') {
    jobs.updateJob(jobId, { status: 'error', error: status.error })
  } else {
    // Still processing, retry after delay
    setTimeout(() => pollJobStatus(jobId, backendJobId), 2000)
  }
}
```

### Template 5: Basic Popup Component

```typescript
// src/popup/Popup.tsx
import React, { useState, useEffect } from 'react'
import './popup.css'

export function Popup() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    // Check auth on mount
    chrome.storage.local.get('auth_token', (result) => {
      setIsAuthenticated(!!result.auth_token)
      setLoading(false)
    })
  }, [])

  const handleAnalyze = async () => {
    if (!isAuthenticated) {
      alert('Please authenticate first')
      return
    }

    setAnalyzing(true)

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // Request extraction from content script
      const result = await chrome.tabs.sendMessage(tab.id!, {
        type: 'EXTRACT_PAGE'
      })

      // Send to background for processing
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE',
        payload: result
      })

      alert(`Analysis started! Job ID: ${response.jobId}`)

    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return <div className="popup">Loading...</div>
  }

  return (
    <div className="popup">
      <h1>SPECKULA</h1>
      <p>Product Intelligence</p>

      {isAuthenticated ? (
        <button onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Analyze This Page'}
        </button>
      ) : (
        <p>Please authenticate in settings</p>
      )}
    </div>
  )
}
```

---

## DEVELOPMENT WORKFLOWS

### Local Development Setup

```bash
# 1. Clone and setup
git clone <repo>
cd speckula-extension
npm install

# 2. Create .env file
cp .env.example .env.local
# Edit .env.local with your API URL

# 3. Start dev server with hot reload
npm run dev

# 4. Load in Chrome
# - Open chrome://extensions
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the extension folder
```

### Hot Reload Workflow

With Plasmo, changes automatically reload. For manual reloads:

1. Content script changes → Reload extension
2. Background script changes → Reload extension
3. Popup UI changes → Close and reopen popup

### Testing Content Extraction

```javascript
// In Chrome console on any website:
// Assumes content script is loaded

// Extract content
const content = window.__speckula_extract?.()

// Classify page
const pageType = window.__speckula_classify?.()

// Send to background
chrome.runtime.sendMessage({
  type: 'EXTRACT_PAGE'
}, (response) => {
  console.log('Extraction result:', response)
})
```

### Debugging Message Flow

```typescript
// In background.ts, add logging:
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[BG] Message received:', {
    type: request.type,
    sender: sender.url,
    payload: request.payload
  })

  // Handle request...

  console.log('[BG] Sending response:', response)
  sendResponse(response)
})

// In popup.tsx, add logging:
const response = await chrome.runtime.sendMessage({
  type: 'ANALYZE_PAGE',
  payload
})

console.log('[POPUP] Got response:', response)
```

### Testing API Integration

Mock the API for Phase 1:

```typescript
// src/api/client.ts (development mode)

export class APIClient {
  async post(endpoint: string, data: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Mock POST', endpoint, data)
      
      // Return mock response
      if (endpoint === '/analyses/jobs') {
        return {
          jobId: `mock_${Date.now()}`,
          status: 'processing'
        }
      }
    }
    // ... real API call
  }
}
```

---

## TESTING STRATEGY

### Unit Tests

```typescript
// src/content/extractor.test.ts
import { describe, it, expect } from 'vitest'
import { extractPageContent } from './extractor'

describe('Content Extractor', () => {
  it('should extract page metadata', () => {
    document.title = 'Test Page'
    
    const content = extractPageContent()
    
    expect(content.title).toBe('Test Page')
    expect(content.url).toBeDefined()
  })

  it('should extract text content', () => {
    document.body.innerHTML = '<p>Hello World</p>'
    
    const content = extractPageContent()
    
    expect(content.text).toContain('Hello')
  })
})
```

### Integration Tests

```typescript
// tests/popup-flow.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('Popup Analysis Flow', () => {
  beforeEach(() => {
    // Setup mock Chrome API
    global.chrome = {
      runtime: { sendMessage: vi.fn() },
      storage: { local: { get: vi.fn() } }
    }
  })

  it('should send analyze message when button clicked', async () => {
    // Render popup
    // Click analyze button
    // Verify message sent
  })
})
```

### Manual Testing Checklist

- [ ] Extract content from pricing page (Linear)
- [ ] Extract content from blog post (Medium article)
- [ ] Extract content from Reddit thread
- [ ] Extract content from ProductHunt launch
- [ ] Verify classification on each page
- [ ] Test with long-form content (>10k words)
- [ ] Test with minimal content (<100 words)
- [ ] Test with images and videos
- [ ] Test popup opens and closes cleanly
- [ ] Verify no console errors

---

## DEBUGGING GUIDE

### Chrome DevTools

1. **Extension Popup**
   - Right-click popup → Inspect
   - See React component errors
   - Check console for messages

2. **Background Service Worker**
   - chrome://extensions → SPECKULA → Details
   - Click "Inspect views: service_worker"
   - See background.ts errors
   - Verify message flows

3. **Content Script**
   - Open webpage
   - DevTools → Console
   - Check for content script errors
   - Verify DOM extraction

### Common Issues

**Issue: Message not received in background**

```typescript
// Verify sender and message type
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received from:', sender.url) // Check it's the right page
  console.log('Request type:', request.type) // Check exact type
  
  if (request.type !== 'ANALYZE_PAGE') {
    console.warn('Unknown message type')
    return
  }
})
```

**Issue: API call failing**

```typescript
// Add detailed error logging
async post(endpoint: string, data: any) {
  try {
    console.log(`[API] POST ${endpoint}`)
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.authToken}` },
      body: JSON.stringify(data)
    })
    
    console.log(`[API] Status: ${response.status}`)
    
    if (!response.ok) {
      const error = await response.text()
      console.error(`[API] Error: ${error}`)
      throw new Error(error)
    }
    
    return await response.json()
  } catch (error) {
    console.error('[API] Exception:', error)
    throw error
  }
}
```

**Issue: Content extraction not working**

```typescript
// Test in console
// On any webpage:
document.querySelectorAll('main, article, [role="main"]').forEach(el => {
  console.log('Found content area:', el.tagName, el.className)
})

// Verify meta tags
document.querySelectorAll('meta').forEach(meta => {
  console.log(`${meta.name || meta.getAttribute('property')}: ${meta.content}`)
})
```

---

## API CONTRACT TEMPLATE

### POST /analyses/jobs

**Request**:
```json
{
  "url": "https://linear.app/pricing",
  "content": {
    "html": "<html>...</html>",
    "text": "Pricing page content...",
    "metadata": {
      "title": "Linear Pricing",
      "description": "..."
    }
  },
  "pageType": "pricing_page",
  "selectedText": "optional highlighted text"
}
```

**Response**:
```json
{
  "jobId": "job_abc123",
  "status": "processing",
  "message": "Analysis queued"
}
```

**Error**:
```json
{
  "error": "Invalid content",
  "message": "URL is required"
}
```

---

### GET /analyses/jobs/{jobId}

**Response**:
```json
{
  "jobId": "job_abc123",
  "status": "completed",
  "insight": {
    "type": "competitor_positioning",
    "summary": "Linear emphasizes developer velocity...",
    "evidence": ["Fast", "Minimal UI"],
    "tags": ["Developer Tools", "B2B SaaS"],
    "confidence": 0.85,
    "sourceUrl": "https://linear.app/pricing",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## SUCCESS METRICS FOR PHASE 1

| Metric | Target |
|--------|--------|
| Extension loads without errors | 100% |
| Content extraction accuracy | >90% on diverse pages |
| Page classification accuracy | >80% |
| Popup renders correctly | 100% |
| Message flow works end-to-end | 100% |
| No console errors | 100% |
| API client makes requests | ✓ (with mock backend) |

---

## NEXT CHECKPOINT

After Phase 1, you should have:

- ✅ Working extension that loads in Chrome
- ✅ Content extraction from arbitrary webpages
- ✅ Page type classification
- ✅ Basic popup UI with Analyze button
- ✅ Message flow from popup → background → content script
- ✅ Job queue system
- ✅ API client (ready for real backend)

**Ready for Phase 2: Async Job Processing & Backend Integration**

