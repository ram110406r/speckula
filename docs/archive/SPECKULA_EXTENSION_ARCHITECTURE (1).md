# SPECKULA BROWSER EXTENSION
## Architecture & Implementation Roadmap

---

## TABLE OF CONTENTS

1. [Extension Architecture Overview](#extension-architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Core Components](#core-components)
4. [Content Extraction Pipeline](#content-extraction-pipeline)
5. [API Integration Layer](#api-integration-layer)
6. [State Management](#state-management)
7. [Background Worker Architecture](#background-worker-architecture)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Code Scaffolding](#code-scaffolding)

---

## EXTENSION ARCHITECTURE OVERVIEW

### High-Level Data Flow

```
User Right-Clicks on Webpage
    ↓
Context Menu Handler (Background)
    ↓
Popup Opens / Triggers Analysis
    ↓
Content Extraction Script (Content Script)
    ↓
Extract: HTML, Metadata, Selected Text, Accessibility Tree
    ↓
Send to Background Worker
    ↓
API Gateway: POST /analyses/jobs
    ↓
Backend Async Job Queue
    ↓
WebSocket: Job Status Updates
    ↓
Popup UI: Live Progress Display
    ↓
Store Insight in SPECKULA Dashboard
```

### Key Principles

- **Async-First**: Never block UI; always queue jobs
- **Progressive Enhancement**: Work offline, sync when possible
- **User-Centric**: Show progress, handle failures gracefully
- **Extensible**: Architecture supports future autonomous features

---

## DIRECTORY STRUCTURE

```
speckula-extension/
├── manifest.json                 # Extension manifest (v3)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
│
├── src/
│   ├── background/
│   │   ├── background.ts         # Service worker (messaging hub)
│   │   ├── contextMenu.ts        # Context menu handlers
│   │   ├── jobQueue.ts           # Local job management
│   │   └── storage.ts            # Chrome storage utilities
│   │
│   ├── content/
│   │   ├── content.ts            # Content script entry
│   │   ├── extractor.ts          # DOM content extraction
│   │   ├── classifier.ts         # Page type classification
│   │   └── injector.ts           # Script injection utilities
│   │
│   ├── popup/
│   │   ├── Popup.tsx             # Main popup component
│   │   ├── AnalysisStatus.tsx    # Job status display
│   │   ├── InsightPreview.tsx    # Insight card preview
│   │   ├── Settings.tsx          # Auth & preferences
│   │   └── popup.css             # Popup styles
│   │
│   ├── options/
│   │   ├── Options.tsx           # Full settings page
│   │   └── options.css
│   │
│   ├── api/
│   │   ├── client.ts             # HTTP client (fetch wrapper)
│   │   ├── endpoints.ts          # API route definitions
│   │   ├── types.ts              # Request/response types
│   │   └── auth.ts               # Token management
│   │
│   ├── utils/
│   │   ├── storage.ts            # Local storage helpers
│   │   ├── logger.ts             # Logging utility
│   │   ├── validators.ts         # Data validation
│   │   └── constants.ts          # Global constants
│   │
│   └── types/
│       ├── extension.ts          # Extension-specific types
│       ├── api.ts                # API request/response types
│       └── analysis.ts           # Analysis result types
│
├── public/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-48.png
│   │   ├── icon-128.png
│   │   └── icon-256.png
│   │
│   ├── popup.html                # Popup HTML
│   └── options.html              # Options page HTML
│
└── tests/
    ├── extractor.test.ts
    ├── classifier.test.ts
    └── api.test.ts
```

---

## CORE COMPONENTS

### 1. MANIFEST.json (MV3)

```json
{
  "manifest_version": 3,
  "name": "SPECKULA - Product Intelligence",
  "version": "0.1.0",
  "description": "AI-powered product intelligence capture for your browser",
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
    "default_title": "Analyze with SPECKULA"
  },
  "background": {
    "service_worker": "src/background/background.ts"
  },
  "options_page": "src/options/options.html",
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png",
    "256": "public/icons/icon-256.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["src/content/injector.ts"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 2. Background Service Worker (background.ts)

**Purpose**: Manages messaging, job queue, API calls, context menu

```typescript
// src/background/background.ts

import { setupContextMenu } from './contextMenu'
import { JobQueue } from './jobQueue'
import { APIClient } from '../api/client'

const jobQueue = new JobQueue()
const apiClient = new APIClient()

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu()
  console.log('[SPECKULA] Extension installed')
})

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_PAGE') {
    handleAnalyzePage(request.payload, sender.tab)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }))
    return true // Keep channel open for async response
  }

  if (request.type === 'GET_JOB_STATUS') {
    getJobStatus(request.jobId)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }))
    return true
  }

  if (request.type === 'CANCEL_JOB') {
    cancelJob(request.jobId)
      .then(response => sendResponse(response))
    return true
  }
})

// Handle analyze page request
async function handleAnalyzePage(payload, tab) {
  const { content, metadata, selectedText, pageType } = payload

  // Validate payload
  if (!content || !metadata.url) {
    throw new Error('Invalid payload: missing content or URL')
  }

  // Create job in local queue
  const jobId = jobQueue.createJob({
    url: metadata.url,
    pageType,
    status: 'pending',
    createdAt: Date.now(),
    tabId: tab.id
  })

  // Send to backend asynchronously
  processJobAsync(jobId, payload)

  return { jobId, status: 'queued' }
}

// Process job asynchronously
async function processJobAsync(jobId, payload) {
  try {
    // Update status
    jobQueue.updateJob(jobId, { status: 'processing' })

    // Call API
    const response = await apiClient.post('/analyses/jobs', {
      url: payload.metadata.url,
      content: payload.content,
      selectedText: payload.selectedText,
      pageType: payload.pageType,
      metadata: payload.metadata
    })

    // Store job ID from backend
    jobQueue.updateJob(jobId, {
      status: 'processing',
      backendJobId: response.jobId
    })

    // Poll for completion
    await pollJobCompletion(jobId, response.jobId)

  } catch (error) {
    console.error('[SPECKULA] Job processing error:', error)
    jobQueue.updateJob(jobId, {
      status: 'error',
      error: error.message
    })
  }
}

// Poll backend for job completion
async function pollJobCompletion(localJobId, backendJobId) {
  const maxAttempts = 120 // 5 minutes with 2.5s intervals
  let attempts = 0

  const poll = async () => {
    attempts++
    if (attempts > maxAttempts) {
      throw new Error('Job processing timeout')
    }

    const status = await apiClient.get(`/analyses/jobs/${backendJobId}`)

    if (status.status === 'completed') {
      jobQueue.updateJob(localJobId, {
        status: 'completed',
        insight: status.insight,
        completedAt: Date.now()
      })
      notifyJobCompletion(localJobId)
      return
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Job failed')
    }

    // Still processing, wait and retry
    setTimeout(poll, 2500)
  }

  await poll()
}

// Notify popup of job completion
function notifyJobCompletion(jobId) {
  chrome.runtime.sendMessage({
    type: 'JOB_COMPLETED',
    jobId
  }).catch(() => {
    // Popup may not be open, that's OK
  })
}

// Get job status
async function getJobStatus(jobId) {
  const job = jobQueue.getJob(jobId)
  if (!job) {
    throw new Error('Job not found')
  }
  return job
}

// Cancel job
async function cancelJob(jobId) {
  jobQueue.updateJob(jobId, { status: 'cancelled' })
  return { success: true }
}
```

### 3. Content Script (content.ts)

**Purpose**: Extracts page content, injects UI, communicates with background

```typescript
// src/content/content.ts

import { extractPageContent } from './extractor'
import { classifyPageType } from './classifier'

// Inject context menu detection
injectContextMenuDetector()

function injectContextMenuDetector() {
  // Create right-click handler
  document.addEventListener('contextmenu', (event) => {
    const selectedText = window.getSelection()?.toString() || ''
    
    // Store in window for background to access
    ;(window as any).__speckula_context = {
      selectedText,
      timestamp: Date.now()
    }
  })
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_PAGE') {
    try {
      const content = extractPageContent()
      const pageType = classifyPageType(content)
      
      sendResponse({
        success: true,
        content,
        pageType
      })
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      })
    }
  }
})

// Make extraction available immediately
;(window as any).__speckula_extract = () => extractPageContent()
;(window as any).__speckula_classify = () => classifyPageType(
  extractPageContent()
)
```

### 4. Content Extractor (extractor.ts)

**Purpose**: Intelligent DOM extraction, metadata collection

```typescript
// src/content/extractor.ts

import { PageContent, PageMetadata } from '../types/analysis'

export function extractPageContent(): PageContent {
  return {
    url: window.location.href,
    title: document.title,
    metadata: extractMetadata(),
    html: extractMainContent(),
    text: extractText(),
    structured: extractStructuredData(),
    images: extractKeyImages(),
    links: extractLinks(),
    accessibility: extractAccessibilityTree()
  }
}

function extractMetadata(): PageMetadata {
  const meta = {
    url: window.location.href,
    title: document.title,
    description: getMetaContent('description'),
    ogImage: getMetaContent('og:image'),
    ogTitle: getMetaContent('og:title'),
    ogDescription: getMetaContent('og:description'),
    favicon: getFavicon(),
    lang: document.documentElement.lang,
    viewport: getMetaContent('viewport')
  }
  return meta
}

function extractMainContent(): string {
  // Remove noise
  const clone = document.documentElement.cloneNode(true) as HTMLElement
  
  // Remove scripts, styles, nav, footer elements that don't add value
  const elementsToRemove = clone.querySelectorAll(
    'script, style, nav, footer, .ad, .cookie-banner, [role="navigation"]'
  )
  elementsToRemove.forEach(el => el.remove())

  return clone.innerHTML
}

function extractText(): string {
  // Get clean text content
  const article = document.querySelector('article')
    || document.querySelector('main')
    || document.querySelector('[role="main"]')
    || document.body

  return article?.innerText || document.body.innerText
}

function extractStructuredData(): Record<string, any>[] {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
  
  return scripts
    .map(script => {
      try {
        return JSON.parse(script.textContent || '{}')
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function extractKeyImages(): string[] {
  const images = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const width = img.width || img.naturalWidth
      const height = img.height || img.naturalHeight
      return width > 100 && height > 100 // Only meaningful images
    })
    .map(img => ({
      src: img.src || img.currentSrc,
      alt: img.alt,
      title: img.title
    }))

  // Return top 5 images
  return images.slice(0, 5).map(img => img.src)
}

function extractLinks(): string[] {
  return Array.from(document.querySelectorAll('a[href]'))
    .map(a => (a as HTMLAnchorElement).href)
    .filter((href, idx, arr) => arr.indexOf(href) === idx) // Unique
    .slice(0, 20)
}

function extractAccessibilityTree(): string {
  // Simple accessibility tree for screen reader context
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map(h => `${h.tagName}: ${h.textContent}`)

  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
    .map(b => b.textContent)

  return [
    ...headings,
    ...buttons.slice(0, 5)
  ].join('\n')
}

function getMetaContent(name: string): string | null {
  const el = document.querySelector(
    `meta[name="${name}"], meta[property="${name}"]`
  )
  return el?.getAttribute('content') || null
}

function getFavicon(): string | null {
  const link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')
  return link?.getAttribute('href') || null
}
```

### 5. Page Classifier (classifier.ts)

**Purpose**: Determine page type for specialized analysis

```typescript
// src/content/classifier.ts

import { PageContent } from '../types/analysis'

export type PageType = 
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

export function classifyPageType(content: PageContent): PageType {
  const url = content.url.toLowerCase()
  const text = content.text.toLowerCase()
  const title = content.title.toLowerCase()

  // Check URL patterns first (most reliable)
  if (url.includes('pricing') || url.includes('plans') || url.includes('pricing-table')) {
    return 'pricing_page'
  }

  if (url.includes('reddit.com')) {
    return 'reddit'
  }

  if (url.includes('producthunt.com')) {
    return 'product_hunt'
  }

  if (url.includes('docs') || url.includes('documentation') || url.includes('help')) {
    return 'documentation'
  }

  // Text-based classification
  const pricingKeywords = ['pricing', 'plans', 'cost', '$', '€', 'per month', 'per year', 'subscribe']
  const pricingMatches = pricingKeywords.filter(kw => text.includes(kw)).length

  if (pricingMatches >= 3) {
    return 'pricing_page'
  }

  if (text.includes('review') && text.includes('rating')) {
    return 'review_site'
  }

  if (title.includes('blog') || url.includes('blog')) {
    return 'blog'
  }

  if (url.includes('twitter.com') || url.includes('linkedin.com') || url.includes('facebook.com')) {
    return 'social_media'
  }

  return 'landing_page' // Default to landing page for unknown
}
```

### 6. Popup Component (Popup.tsx)

**Purpose**: User-facing interface for analysis control

```typescript
// src/popup/Popup.tsx

import React, { useState, useEffect } from 'react'
import { AnalysisStatus } from './AnalysisStatus'
import { InsightPreview } from './InsightPreview'
import { Settings } from './Settings'
import './popup.css'

export type View = 'home' | 'analyzing' | 'result' | 'settings'

interface Job {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled'
  insight?: any
  error?: string
  createdAt: number
}

export function Popup() {
  const [view, setView] = useState<View>('home')
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication on mount
    chrome.storage.local.get('speckula_auth_token', (result) => {
      setIsAuthenticated(!!result.speckula_auth_token)
      setLoading(false)
    })

    // Listen for job completion messages
    const handleMessage = (request) => {
      if (request.type === 'JOB_COMPLETED') {
        fetchJobStatus(request.jobId)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  const handleAnalyzeClick = async () => {
    if (!isAuthenticated) {
      setView('settings')
      return
    }

    try {
      setView('analyzing')
      setLoading(true)

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // Extract content from page
      const result = await chrome.tabs.sendMessage(tab.id!, {
        type: 'EXTRACT_PAGE'
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      // Send to background for processing
      const jobResponse = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE',
        payload: {
          content: result.content,
          metadata: result.content.metadata,
          selectedText: (window as any).__speckula_context?.selectedText || '',
          pageType: result.pageType
        }
      })

      const job: Job = {
        jobId: jobResponse.jobId,
        status: 'processing',
        createdAt: Date.now()
      }

      setCurrentJob(job)

      // Poll for job status
      pollJobStatus(job.jobId)

    } catch (error) {
      console.error('Analysis error:', error)
      setView('home')
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const checkStatus = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_JOB_STATUS',
          jobId
        })

        setCurrentJob(response)

        if (response.status === 'completed') {
          setView('result')
          return
        }

        if (response.status === 'error') {
          setView('home')
          alert(`Analysis failed: ${response.error}`)
          return
        }

        // Still processing, check again
        setTimeout(checkStatus, 1000)

      } catch (error) {
        console.error('Status check error:', error)
        setTimeout(checkStatus, 1000)
      }
    }

    checkStatus()
  }

  const fetchJobStatus = async (jobId: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_JOB_STATUS',
        jobId
      })
      setCurrentJob(response)
      if (response.status === 'completed') {
        setView('result')
      }
    } catch (error) {
      console.error('Fetch status error:', error)
    }
  }

  const handleCancelJob = async () => {
    if (!currentJob) return
    
    try {
      await chrome.runtime.sendMessage({
        type: 'CANCEL_JOB',
        jobId: currentJob.jobId
      })
      setView('home')
      setCurrentJob(null)
    } catch (error) {
      console.error('Cancel error:', error)
    }
  }

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: 'https://speckula.ai/dashboard' })
  }

  if (loading) {
    return (
      <div className="popup popup--loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="popup">
      {view === 'home' && (
        <div className="popup__home">
          <div className="popup__header">
            <h1 className="popup__title">SPECKULA</h1>
            <p className="popup__subtitle">Product Intelligence</p>
          </div>

          <button 
            className="popup__button popup__button--primary"
            onClick={handleAnalyzeClick}
          >
            🔍 Analyze This Page
          </button>

          <button 
            className="popup__button popup__button--secondary"
            onClick={handleOpenDashboard}
          >
            📊 Open Dashboard
          </button>

          <button 
            className="popup__button popup__button--tertiary"
            onClick={() => setView('settings')}
          >
            ⚙️ Settings
          </button>
        </div>
      )}

      {view === 'analyzing' && currentJob && (
        <AnalysisStatus 
          job={currentJob} 
          onCancel={handleCancelJob}
        />
      )}

      {view === 'result' && currentJob?.insight && (
        <InsightPreview 
          insight={currentJob.insight}
          onClose={() => {
            setView('home')
            setCurrentJob(null)
          }}
          onOpenDashboard={handleOpenDashboard}
        />
      )}

      {view === 'settings' && (
        <Settings 
          isAuthenticated={isAuthenticated}
          onAuthenticated={() => {
            setIsAuthenticated(true)
            setView('home')
          }}
        />
      )}
    </div>
  )
}
```

### 7. Analysis Status Component (AnalysisStatus.tsx)

```typescript
// src/popup/AnalysisStatus.tsx

import React from 'react'

interface Props {
  job: any
  onCancel: () => void
}

export function AnalysisStatus({ job, onCancel }: Props) {
  const stages = [
    { name: 'Extracting Content', completed: true },
    { name: 'Detecting Page Type', completed: true },
    { name: 'Analyzing Positioning', completed: job.status !== 'pending' },
    { name: 'Identifying Market Signals', completed: job.status === 'completed' },
    { name: 'Generating Insights', completed: job.status === 'completed' },
    { name: 'Saving to SPECKULA', completed: job.status === 'completed' }
  ]

  return (
    <div className="popup__analysis">
      <div className="popup__header">
        <h2>Analyzing...</h2>
      </div>

      <div className="analysis-stages">
        {stages.map((stage, idx) => (
          <div key={idx} className={`stage ${stage.completed ? 'stage--completed' : ''}`}>
            <div className="stage__icon">
              {stage.completed ? '✓' : '•'}
            </div>
            <div className="stage__text">{stage.name}</div>
          </div>
        ))}
      </div>

      <button 
        className="popup__button popup__button--cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}
```

### 8. API Client (client.ts)

```typescript
// src/api/client.ts

import { getAuthToken, isTokenExpired, refreshToken } from './auth'

export class APIClient {
  private baseUrl = process.env.REACT_APP_API_URL || 'https://api.speckula.ai'
  private timeout = 30000

  async post(endpoint: string, data: any) {
    return this.request('POST', endpoint, data)
  }

  async get(endpoint: string) {
    return this.request('GET', endpoint)
  }

  async put(endpoint: string, data: any) {
    return this.request('PUT', endpoint, data)
  }

  async delete(endpoint: string) {
    return this.request('DELETE', endpoint)
  }

  private async request(method: string, endpoint: string, data?: any) {
    let token = await getAuthToken()

    // Check if token expired
    if (token && isTokenExpired(token)) {
      token = await refreshToken()
    }

    if (!token) {
      throw new Error('Not authenticated')
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }

    if (data) {
      options.body = JSON.stringify(data)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || `HTTP ${response.status}`)
      }

      return await response.json()

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }
}
```

---

## BACKGROUND WORKER ARCHITECTURE

### Job Queue Management (jobQueue.ts)

```typescript
// src/background/jobQueue.ts

interface Job {
  jobId: string
  backendJobId?: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled'
  insight?: any
  error?: string
  createdAt: number
  completedAt?: number
  tabId?: number
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map()

  createJob(jobData: Omit<Job, 'jobId'>): string {
    const jobId = this.generateJobId()
    this.jobs.set(jobId, {
      jobId,
      ...jobData
    })
    this.persistToStorage()
    return jobId
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId)
  }

  updateJob(jobId: string, updates: Partial<Job>): void {
    const job = this.jobs.get(jobId)
    if (job) {
      this.jobs.set(jobId, { ...job, ...updates })
      this.persistToStorage()
    }
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values())
  }

  getActiveJobs(): Job[] {
    return this.getAllJobs().filter(j => 
      j.status === 'pending' || j.status === 'processing'
    )
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private persistToStorage(): void {
    const jobs = Object.fromEntries(this.jobs)
    chrome.storage.local.set({ speckula_jobs: jobs })
  }

  loadFromStorage(): void {
    chrome.storage.local.get('speckula_jobs', (result) => {
      if (result.speckula_jobs) {
        this.jobs = new Map(Object.entries(result.speckula_jobs) as any)
      }
    })
  }
}
```

---

## STATE MANAGEMENT

### Storage Utilities (storage.ts)

```typescript
// src/utils/storage.ts

export class StorageManager {
  static async get(key: string): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] || null)
      })
    })
  }

  static async set(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve)
    })
  }

  static async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve)
    })
  }

  static async clear(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve)
    })
  }
}
```

---

## TYPE DEFINITIONS

### API Types (api.ts)

```typescript
// src/types/api.ts

export interface AnalysisJobRequest {
  url: string
  content: PageContent
  selectedText: string
  pageType: string
  metadata: PageMetadata
}

export interface AnalysisJobResponse {
  jobId: string
  status: 'processing' | 'completed' | 'failed'
  insight?: Insight
  error?: string
}

export interface JobStatusResponse {
  jobId: string
  status: string
  progress?: number
  currentStage?: string
  insight?: Insight
  error?: string
}

export interface Insight {
  id: string
  type: InsightType
  company?: string
  summary: string
  evidence: string[]
  tags: string[]
  confidence: number
  sourceUrl: string
  timestamp: string
  metadata?: Record<string, any>
}

export type InsightType = 
  | 'competitor_positioning'
  | 'pricing_analysis'
  | 'ux_analysis'
  | 'market_signal'
  | 'gtm_analysis'
  | 'feature_intelligence'
```

### Analysis Types (analysis.ts)

```typescript
// src/types/analysis.ts

export interface PageContent {
  url: string
  title: string
  metadata: PageMetadata
  html: string
  text: string
  structured: Record<string, any>[]
  images: string[]
  links: string[]
  accessibility: string
}

export interface PageMetadata {
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

---

## IMPLEMENTATION ROADMAP

### PHASE 1: FOUNDATION (Week 1-2)

**Goal**: Basic extension with extraction and API integration

**Deliverables**:
- [ ] Project scaffolding with Plasmo
- [ ] Manifest.json and build configuration
- [ ] Content extractor (DOM extraction, metadata)
- [ ] Page classifier (URL + text patterns)
- [ ] Background service worker messaging
- [ ] Local job queue (Chrome storage)
- [ ] Basic popup UI (analyze button, status display)
- [ ] API client with auth integration

**Success Criteria**:
- Extension loads without errors
- Right-click context menu appears
- Content extraction works on diverse pages
- Page classification is >80% accurate on test set

**Tasks**:
1. Initialize Plasmo project: `plasmo init speckula-extension`
2. Set up TypeScript, React, Tailwind
3. Implement `extractor.ts` and `classifier.ts`
4. Build `background.ts` messaging handler
5. Create popup skeleton with Analyze button
6. Test content extraction on 5+ page types

---

### PHASE 2: ASYNC JOB PROCESSING (Week 2-3)

**Goal**: Connect to backend, implement async job queue, live status updates

**Deliverables**:
- [ ] Backend API endpoints spec (create, status, retrieve)
- [ ] Job queue system (pending → processing → completed)
- [ ] Polling mechanism for job status
- [ ] WebSocket integration (optional, can use polling first)
- [ ] Analysis status UI with progress stages
- [ ] Error handling and retry logic

**Success Criteria**:
- Jobs queue immediately and return jobId
- Backend receives job data correctly
- Status polling updates UI every 1-2 seconds
- Job persists if popup closes
- User can cancel jobs

**Tasks**:
1. Define API contract with backend team
2. Implement APIClient with request/response handling
3. Build job polling loop in background
4. Create AnalysisStatus component with stages
5. Test with mock backend responses
6. Implement error states and messaging

---

### PHASE 3: INSIGHT PREVIEW & DASHBOARD SYNC (Week 3-4)

**Goal**: Display insights in popup, save to dashboard, basic UI polish

**Deliverables**:
- [ ] InsightPreview component (card display)
- [ ] Save insight trigger (one-click save to dashboard)
- [ ] Dashboard link integration
- [ ] Popup styling (SPECKULA design system)
- [ ] Settings page (authentication, workspace selection)
- [ ] History tab (recent analyses)

**Success Criteria**:
- Completed insights display nicely in popup
- One-click save to SPECKULA dashboard works
- User can navigate to dashboard from extension
- Settings page allows auth token management
- Recent analyses are cached locally

**Tasks**:
1. Build InsightPreview component
2. Implement insight saving to backend
3. Create Settings page with auth flow
4. Design popup UI (apply brand colors, typography)
5. Build history view
6. Add icons and favicons

---

### PHASE 4: CONTEXT MENU & UX POLISH (Week 4-5)

**Goal**: Native browser integration, refined interactions

**Deliverables**:
- [ ] Right-click context menu ("Analyze with SPECKULA")
- [ ] Keyboard shortcut (Cmd/Ctrl + Shift + A)
- [ ] Badge showing pending job count
- [ ] Notification when analysis completes
- [ ] Selected text integration (auto-include in analysis)
- [ ] Options page (full settings)

**Success Criteria**:
- Right-click context menu appears on all pages
- Keyboard shortcut triggers analysis
- Badge updates in real-time
- Desktop notifications work
- Selected text is captured and included

**Tasks**:
1. Implement context menu in `contextMenu.ts`
2. Add keyboard command handlers
3. Create badge update logic
4. Implement Chrome notifications API
5. Test on Windows, Mac, Linux
6. Polish all UI transitions

---

### PHASE 5: TESTING & LAUNCH PREP (Week 5-6)

**Goal**: Test, optimize, prepare for production

**Deliverables**:
- [ ] Unit tests (extractor, classifier, client)
- [ ] Integration tests (popup → background → API)
- [ ] E2E tests (full user flow)
- [ ] Performance optimization (bundle size, memory)
- [ ] Privacy and security review
- [ ] Chrome Web Store submission prep

**Success Criteria**:
- Test coverage >80%
- Extension loads in <100ms
- Memory footprint <20MB
- All major user flows tested
- No console errors or warnings
- Privacy policy and terms drafted

**Tasks**:
1. Set up Vitest and Playwright
2. Write extractor unit tests
3. Write integration tests for job flow
4. Profile extension performance
5. Security audit (auth token handling, data validation)
6. Prepare Chrome Web Store listing

---

### PHASE 6: BACKEND INTEGRATION & REFINEMENT (Week 6-7)

**Goal**: Connect to real backend, refine based on feedback

**Deliverables**:
- [ ] Live backend integration (stop using mocks)
- [ ] Real API authentication
- [ ] Real job processing
- [ ] Error handling and user feedback
- [ ] Analytics tracking (opt-in)
- [ ] Feedback collection

**Success Criteria**:
- Extension works with production backend
- Auth flow is seamless
- Job completion feels fast (<3 min for most pages)
- Error messages are helpful
- Analytics data is valid

**Tasks**:
1. Coordinate with backend team on API readiness
2. Switch from mock to real API endpoints
3. Implement error tracking (Sentry or similar)
4. Add analytics (Mixpanel, Amplitude)
5. Gather beta user feedback
6. Iterate on UX based on feedback

---

### PHASE 7: RELEASE & MONITORING (Week 7-8)

**Goal**: Launch on Chrome Web Store, monitor quality

**Deliverables**:
- [ ] Chrome Web Store submission
- [ ] Marketing assets (screenshots, description)
- [ ] Release notes and changelog
- [ ] Support documentation
- [ ] Monitoring and alerting
- [ ] Bug tracking and iteration

**Success Criteria**:
- Extension approved on Chrome Web Store
- 100+ initial installs
- <5% uninstall rate after 30 days
- Avg rating >4.5 stars
- <1% crash rate

**Tasks**:
1. Prepare Web Store listing
2. Create marketing copy and screenshots
3. Submit extension for review
4. Set up monitoring dashboards
5. Create support documentation
6. Plan post-launch iteration

---

## BUILD & DEPLOYMENT

### Development Setup

```bash
# Initialize project
plasmo init speckula-extension
cd speckula-extension

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Package for upload
npm run package
```

### Environment Variables (.env.local)

```
REACT_APP_API_URL=https://api.speckula.ai
REACT_APP_ENV=development
```

### CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: Build & Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

---

## SECURITY & PRIVACY CONSIDERATIONS

### Authentication

- Tokens stored in `chrome.storage.local` (encrypted at rest)
- No sensitive data logged
- API calls use HTTPS only
- JWT tokens with expiration

### Content Extraction

- No third-party tracking in popup
- User consent for analysis before sending
- Clear data usage in extension popup
- GDPR-compliant terms

### Data Minimization

- Only send necessary data to backend
- Don't store full page HTML locally
- Clear old jobs after 30 days
- User can clear all data in settings

---

## MONITORING & ANALYTICS

### Events to Track

```typescript
// Recommended analytics events
- Extension Installed
- Extension Opened
- Analysis Started
- Analysis Completed
- Analysis Failed
- Insight Saved
- Dashboard Opened
- Settings Changed
```

### Performance Metrics

```typescript
// Measure these
- Time to Extract Content
- Time to Classify Page
- Time to API Response
- Job Processing Time
- Popup Load Time
- Memory Usage
```

---

## NEXT STEPS

1. **Coordinate with Backend Team**
   - Align on API contract
   - Confirm backend readiness
   - Define job processing SLAs

2. **Set Up Development Environment**
   - Initialize Plasmo project
   - Configure TypeScript and build tools
   - Set up local development workflow

3. **Start Phase 1**
   - Implement content extractor
   - Build basic popup UI
   - Test extraction on diverse pages

4. **Create API Spec Document**
   - Define all endpoints
   - Document request/response schemas
   - Agree on error handling

---

## APPENDIX: USEFUL REFERENCES

### Plasmo Documentation
- https://docs.plasmo.com

### Chrome Extension MV3
- https://developer.chrome.com/docs/extensions/mv3/

### Web Storage API
- https://developer.chrome.com/docs/extensions/reference/storage/

### Chrome Messaging
- https://developer.chrome.com/docs/extensions/mv3/messaging/

### TypeScript + React Best Practices
- https://react.dev
- https://www.typescriptlang.org/

