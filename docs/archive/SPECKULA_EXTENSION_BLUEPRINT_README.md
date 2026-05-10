# SPECKULA BROWSER EXTENSION
## Complete Blueprint — Document Index & How to Use This

---

## QUICK START FOR TEAMS

You now have **4 comprehensive documents** that form a complete product blueprint:

### 📐 **Document 1: Architecture & Implementation Roadmap** 
**For:** Technical leads, engineers building the extension  
**Contains:**
- Complete Plasmo-based extension architecture
- Directory structure and component layout
- 8 production-ready code components (with full TypeScript)
- 7-phase implementation plan (Weeks 1-8)
- Build, deployment, monitoring guidance

**Use it to:**
- Understand how the extension works end-to-end
- Copy-paste code scaffolding to start Phase 1
- Know what each component does and how they connect
- Plan your engineering timeline

---

### 📋 **Document 2: Implementation Checklist & Developer Guide**
**For:** Engineers executing each phase  
**Contains:**
- Phase-by-phase task checklist with acceptance criteria
- Code scaffolding templates (copy-paste ready)
- Development workflows and debugging strategies
- Testing approach (unit, integration, manual)
- API contract examples

**Use it to:**
- Track progress week-by-week
- Know exactly what to build next
- Debug when something breaks
- Test each phase thoroughly

---

### 🎨 **Document 3: Visual Reference & Quick Lookup**
**For:** Everyone—quick answers, debugging, understanding data flows  
**Contains:**
- Complete message flow diagram (user action → completion)
- Component relationship map
- Data flow timeline
- API routes quick reference
- TypeScript types cheat sheet
- Chrome storage schema
- Error handling matrix

**Use it to:**
- Understand how data flows through the extension
- Quick lookup: "How does the job queue work?"
- Debug: "Where is this variable stored?"
- Reference: "What's the exact type for Insight?"

---

### 🏗️ **Document 4: Architectural Design Rationale** (THIS FILE)
**For:** Product leads, architects, decision-makers  
**Contains:**
- Why this architecture exists (the product problem)
- Why Plasmo, why MV3, why async jobs
- The three-process boundary (and why you can't ignore it)
- Service worker lifecycle problems and solutions
- Content extraction strategy
- Authentication flow
- Backend requirements
- Phase sequence justification
- Critical risks and mitigations

**Use it to:**
- Understand the "why" behind every architectural decision
- Explain design choices to stakeholders
- Make informed tradeoffs if you need to deviate
- Know what can and cannot be changed

---

## HOW TO USE THIS BLUEPRINT AS A TEAM

### Week 1: Setup & Alignment

**Monday - Design & Product**
- Read: Document 4 (Design Rationale) sections 1-3
- Discuss: What's the core problem we're solving?
- Agree: "The extension removes the context-switch friction"

**Tuesday - Engineering Lead**
- Read: Document 1 (Architecture Overview) sections 1-3
- Read: Document 4 (Design Rationale) sections 4-7
- Understand: The three-process boundary, MV3 constraints, why Plasmo

**Wednesday - Backend Team**
- Read: Document 4 section "Backend Requirements"
- Review: What routes do we need to build?
- Plan: When will `/api/extension/analyze` be ready?
- Commit: "We'll have it by Week 3"

**Thursday - Frontend Team**
- Read: Document 1 (Architecture Overview) complete
- Read: Document 2 (Checklist) Week 1-2 tasks
- Setup: Initialize Plasmo project
- Milestone: `npm run build` produces clean output

**Friday - Team Sync**
- Everyone reads Document 3 (Visual Reference) message flow diagram
- Test: Open chrome://extensions, load unpacked extension
- Verify: Context menu appears, popup renders
- Success criteria: Extension loads, no errors

---

### Week 2-3: Phase 1 (Foundation)

**Daily Standup Pattern:**
- "What did I build yesterday?"
- "What's blocking me today?"
- "Do I need help?"

**Frontend Team:**
- **Day 1-2:** Implement `src/content/extractor.ts` + `src/content/classifier.ts`
  - Reference: Document 1, section "Content Extractor"
  - Reference: Document 4, section "Content Extraction & Classification"
  - Test: Extract content from 5 different page types
  
- **Day 3-4:** Implement `src/background/background.ts` + messaging
  - Reference: Document 1, section "Background Service Worker"
  - Reference: Document 4, section "The Three-Process Boundary"
  - Test: Messages flow popup → background → content script
  
- **Day 5:** Implement `src/popup/Popup.tsx` (basic)
  - Reference: Document 1, section "Popup Component"
  - Test: Popup opens, Analyze button works

**Acceptance Criteria (end of Week 2):**
- Extension loads with no errors
- Content extraction works on 5+ page types
- Page classification >80% accurate
- Messages flow end-to-end
- Popup shows basic UI

---

### Week 3-4: Phase 2 (Async Job Queue)

**Backend Team (in parallel with Week 2):**
- Implement `/api/extension/analyze` endpoint
- Implement `/api/extension/jobs/{jobId}` endpoint
- Integrate with BMAD pipeline
- Test: POST /analyze returns jobId, polling returns status

**Frontend Team:**
- **Day 1-2:** Implement `src/background/jobQueue.ts`
  - Reference: Document 1, section "Job Queue Management"
  - Reference: Document 4, section "The Async Job Queue Pattern"
  
- **Day 3-4:** Implement job polling + status updates
  - Test: Job persists if popup closes
  - Test: Reopening popup resumes polling
  
- **Day 5:** Implement `AnalysisStatus.tsx` component
  - Show progress stages
  - Allow job cancellation

**Acceptance Criteria (end of Week 4):**
- Jobs queue and process asynchronously
- Status polling works without blocking UI
- Closing popup doesn't kill job
- Reopening popup resumes job tracking

---

### Week 5-6: Phase 3 (Capture & Sync)

**Backend Team:**
- Implement `/api/extension/capture` endpoint
- Implement `/api/extension/user/context` endpoint
- Test: Insights save to Firestore, appear in web app

**Frontend Team:**
- **Day 1-2:** Implement `InsightPreview.tsx`
  - Display analysis result
  - Show save button
  
- **Day 3-4:** Implement save flow
  - POST /api/extension/capture
  - Show success state
  - Link to dashboard
  
- **Day 5:** Settings page + auth flow
  - Sign in with Google
  - Store Firebase token

**Acceptance Criteria (end of Week 6):**
- Completed analyses show nicely in popup
- One-click save to dashboard works
- Insights appear in web app within 1 second
- Settings page allows re-authentication

---

### Week 7-8: Phase 4 (Polish & Launch Prep)

**Frontend Team:**
- Context menu implementation
- Popup UI polish (apply SPECKULA design system)
- Error handling for all paths
- Performance optimization

**Everyone:**
- Unit tests (>80% coverage)
- Integration tests
- Manual testing on diverse pages
- Security review
- Chrome Web Store submission prep

**Acceptance Criteria:**
- All user flows tested
- No console errors
- Fast (<3s for most analyses)
- Looks polished

---

## DOCUMENT REFERENCE GUIDE

**When you're stuck on:**

| Problem | Reference |
|---------|-----------|
| "How do I extract the page DOM?" | Doc 1: Content Extractor + Doc 4: Extraction Strategy |
| "Why isn't my message getting through?" | Doc 3: Message Flow Diagram + Doc 4: Three-Process Boundary |
| "What should the API request/response look like?" | Doc 2: API Contract Template + Doc 3: API Quick Reference |
| "How does the job queue work?" | Doc 1: Job Queue + Doc 4: Async Pattern + Doc 3: Timeline |
| "What's the TypeScript type for X?" | Doc 3: Types Quick Reference |
| "Where is state stored?" | Doc 3: Chrome Storage Schema |
| "Why did we choose Plasmo?" | Doc 4: Why Plasmo section |
| "What if the service worker dies?" | Doc 4: MV3 & Service Worker Constraints |
| "How do I debug the extension?" | Doc 2: Debugging Guide |
| "What are the critical risks?" | Doc 4: Critical Risks & Mitigations |

---

## THE FOUR DOCUMENTS WORK TOGETHER

```
Design Rationale (Doc 4)
↓ Explains WHY
Architecture (Doc 1)
↓ Shows HOW
Checklist (Doc 2)
↓ Lists WHAT to build
Visual Reference (Doc 3)
↓ Quick lookup for any question
```

**Reading order:**
1. Start with Design Rationale (understand the big picture)
2. Read Architecture (see the implementation approach)
3. Use Checklist (execute phase by phase)
4. Keep Visual Reference nearby (for quick lookups)

---

## KEY ARCHITECTURAL DECISIONS (SUMMARY)

### Decision 1: MV3 Service Workers
- **Why:** MV2 is deprecated; MV3 is required for Chrome Web Store
- **Implication:** Service workers can be killed by Chrome anytime
- **Mitigation:** Persist job state to storage before async operations
- **Ref:** Doc 4, "MV3 & Service Worker Constraints"

### Decision 2: Plasmo Build System
- **Why:** Eliminates build boilerplate; 10x faster to ship
- **Implication:** Abstracts webpack; less control over bundle
- **Tradeoff:** Speed >> Control (Phase 1)
- **Ref:** Doc 4, "Why Plasmo"

### Decision 3: Async Job Queue (Not Blocking Promises)
- **Why:** 5-30s analysis times would freeze UI; jobs must survive popup close
- **Implication:** Polling for status instead of awaiting result
- **Pattern:** Popup creates job → polls storage → continues if closed
- **Ref:** Doc 4, "The Async Job Queue Pattern"

### Decision 4: Backend AI (Not Local Models)
- **Why:** 5-30s latency acceptable; server-side AI is more powerful
- **Implication:** Network dependency; requires API routes
- **Tradeoff:** Power + Updates >> Instant response
- **Ref:** Doc 4, "What the Backend Needs"

### Decision 5: Firebase Bearer Tokens
- **Why:** Reuses existing Firebase project; no new auth infrastructure
- **Implication:** Extension calls same Fastify backend as web app
- **Security:** Short-lived ID tokens; refresh tokens server-side
- **Ref:** Doc 4, "Authentication & Firebase Integration"

### Decision 6: Phase 1 Infrastructure First
- **Why:** Message passing and storage schema are the foundation
- **Implication:** Week 1-2 has no visible user value
- **Tradeoff:** Boring → Solid foundation
- **Ref:** Doc 4, "Phase Sequence Justification"

---

## COMMON QUESTIONS ANSWERED

### Q: Do I need to understand all 4 documents?

**A:** 
- **Product/Design Lead:** Documents 4 + 3 (for quick lookups)
- **Engineering Lead:** Documents 1, 4, then 2 for implementation
- **Frontend Engineer:** Documents 1, 2, 3 (daily reference)
- **Backend Engineer:** Document 4 "Backend Requirements" section
- **QA/Testing:** Documents 2 (checklist) and 3 (types)

### Q: Can we skip Phase 1?

**A:** No. Phase 1 is the message-passing infrastructure. Without it, every later phase is built on a broken foundation. The work in Phase 1 is invisible to users, but critical. Don't skip.

### Q: What if we need to launch faster?

**A:** 
- Scope down Phase 1: Skip keyboard shortcuts, just right-click
- Scope down Phase 2: Skip image extraction, just text
- MVP is: Right-click → analyze → see insight (Weeks 1-4)
- Can add capture/persistence (Phase 3) in Week 5

### Q: What does the backend need to build?

**A:** By Week 3:
- `POST /api/extension/analyze` → runs BMAD, returns jobId
- `GET /api/extension/jobs/{jobId}` → returns status + insight

By Week 5:
- `POST /api/extension/capture` → saves insight to Firestore
- `GET /api/extension/user/context` → returns user's workspaces

Document 4, "Backend Requirements" section has the full spec.

### Q: Why does the extension need Firebase?

**A:** 
- SPECKULA already uses Firebase Auth
- Extension reuses same Firebase project
- No new auth system to build
- Users sign in once; token works everywhere

### Q: What's the biggest risk?

**A:** Service worker lifecycle. Chrome can kill the service worker mid-analysis, and if job state isn't in storage, the job is lost forever. The architecture handles this by persisting state before async operations.

Mitigation: Always write job to storage FIRST, then call API.

Reference: Doc 4, "MV3 & Service Worker Constraints" + "Critical Risks"

### Q: Can the extension work offline?

**A:** Partially:
- Extraction ✓ (runs locally)
- Classification ✓ (runs locally)
- Analysis ✗ (requires API)
- Capture ✗ (requires Firestore)

Future: Can cache recent analyses, but MVP requires online.

---

## IMPLEMENTATION CHECKLIST (30,000 FT VIEW)

```
Week 1-2:   Phase 1 (Foundation)
├─ Plasmo setup
├─ Message routing
├─ Storage schema
├─ Content extractor
└─ Page classifier

Week 3-4:   Phase 2 (Job Queue)
├─ Async job processing
├─ Job polling
├─ Status UI
└─ Backend routes (by Week 3)

Week 5-6:   Phase 3 (Capture)
├─ Insight preview UI
├─ Save to dashboard
├─ Settings + auth
└─ More backend routes (by Week 5)

Week 7-8:   Phase 4 (Polish)
├─ Context menu
├─ Design polish
├─ Testing (>80% coverage)
└─ Chrome Web Store submission

Week 9+:    Launch & Iterate
├─ Monitor for bugs
├─ Gather user feedback
├─ Plan Phase 5+ (autonomous features)
└─ Scale based on usage
```

---

## SUCCESS CRITERIA PER PHASE

### Phase 1: Foundation
- ✅ Extension loads without errors
- ✅ Messages flow popup ↔ background ↔ content
- ✅ Job state persists in storage
- ✅ No console errors

### Phase 2: Job Queue
- ✅ Jobs queue asynchronously
- ✅ Job survives popup close/reopen
- ✅ Status polling works smoothly
- ✅ Backend `/analyze` endpoint works

### Phase 3: Capture
- ✅ Analysis results are beautifully formatted
- ✅ One-click save to dashboard works
- ✅ Insights appear in web app
- ✅ Auth/settings work smoothly

### Phase 4: Launch
- ✅ Context menu appears on right-click
- ✅ Popup UI matches SPECKULA design
- ✅ All features tested (>80% coverage)
- ✅ Extension approved on Chrome Web Store

---

## FINAL ARCHITECTURAL PRINCIPLE

The SPECKULA extension is **a thin client that removes friction from the discovery-to-capture loop**.

Every decision — Plasmo, MV3, async jobs, Firebase tokens, backend AI — exists to:

1. **Remove context switching** (stay in browser, no tab flipping)
2. **Survive platform constraints** (service worker restarts, CSP conflicts)
3. **Reuse existing infrastructure** (Firestore, Fastify, Firebase Auth)
4. **Enable future autonomy** (foundation for smart monitoring in Phase 6+)

Build with this principle. When you're uncertain about a design choice, ask: "Does this reduce friction or add it?"

---

## NEXT IMMEDIATE STEPS

**This week:**
1. Product/Design lead reads Document 4 (Design Rationale)
2. Engineering lead reads Documents 1 + 4
3. Backend team reviews "Backend Requirements" section of Doc 4
4. Team aligns on timeline and resources

**Next week:**
1. Initialize Plasmo project
2. Set up development environment
3. Start Phase 1 tasks from Document 2 checklist

**Success metric for Week 2:**
- `npm run build` works
- Extension loads in Chrome without errors
- Everyone understands the three-process boundary

---

## DOCUMENT STATUS

- ✅ **Architecture & Implementation Roadmap** — Complete, production-ready
- ✅ **Implementation Checklist & Developer Guide** — Complete, ready for daily use
- ✅ **Visual Reference & Quick Lookup** — Complete, bookmark this
- ✅ **Architectural Design Rationale** — Complete, for decision-makers

All documents are self-contained. You can share them individually or as a complete blueprint.

**Total pages:** ~60 pages of technical specification and architecture  
**Total code:** ~1,200 lines of scaffolding + templates  
**Total diagrams:** 5+ detailed flows  
**Total checklists:** 100+ concrete tasks

---

## QUESTIONS OR DEVIATIONS?

If you need to deviate from this architecture:

1. **First:** Read Document 4 "Design Rationale" for the specific decision
2. **Second:** Understand the mitigations for the risk you're trying to address
3. **Third:** Document why you're deviating (for future team members)
4. **Fourth:** Proceed with awareness of the tradeoffs

Example deviation:
- **Proposal:** "Use Redux instead of Chrome storage for job state"
- **Why:** "Redux is familiar to our team"
- **Read:** Doc 4, "MV3 & Service Worker Constraints"
- **Risk:** "If service worker restarts, Redux state is lost"
- **Mitigation:** "We'll persist Redux to storage on every change"
- **Tradeoff:** "A bit more code, but team is faster with Redux"
- **Proceed:** ✓ Proceed with that change

Be intentional. All 4 documents exist so you can make informed decisions.

