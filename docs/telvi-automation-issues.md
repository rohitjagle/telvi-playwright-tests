# Telvi OTT App — Automation Compatibility Issues

**Prepared by:** QA Automation (Playwright)
**Date:** 2026-04-18
**Environment:** https://telvi.tv2zdev.com (Preprod)

---

## Summary

During the creation of the Playwright end-to-end test suite, the following issues were identified in the application that either break automation or require fragile workarounds. These are not pure test bugs — they reflect areas where the application code needs improvement to be reliably testable.

---

## Issue 1 — Login spinner does not redirect after successful Sign In

**Severity:** High
**Affects:** Login flow, all tests requiring authentication

### Observed Behavior
After filling in the subscriber name, activation code, accepting T&C, and clicking **Sign In**, a loading spinner appears. The spinner runs indefinitely and the login modal never closes. The user is not redirected to the authenticated state. A manual **page refresh** is required to complete the login.

### Impact on Automation
Playwright cannot proceed to authenticated test steps without a `page.reload()` hack. This workaround is not representative of real user behavior and masks the bug in reports.

### Expected Behavior
After a successful authentication API response, the login modal should close and the page should reflect the logged-in state (user icon visible in the header, login link hidden) — **without** a page refresh.

### Suggested Fix
In the Sign In handler, after the auth API returns a success response, explicitly:
1. Close/dismiss the login modal
2. Update the Angular auth state
3. Trigger a router navigation or Angular `ChangeDetectorRef.detectChanges()`

---

## Issue 2 — `app-home-card` components are destroyed during Angular change detection

**Severity:** High
**Affects:** Home page section tests (Explore TV, Now on TV, Top Series)

### Observed Behavior
The home page renders multiple `app-home-card` Angular components (one per section: Explore TV, Now on TV, Top Series). However, at any given time **only one `app-home-card` is present in the DOM**. When the carousel component (banner) is interacted with (clicking tabs), Angular's change detection fires and destroys the `app-home-card` components that are not currently in the viewport.

**Evidence from DOM inspection:**
```javascript
document.querySelectorAll('app-home-card').length  // returns 1 (not 3)
```

After clicking carousel tabs, only the section currently in the viewport remains in the DOM.

### Impact on Automation
- Playwright cannot verify "Now on TV" or "Top Series" sections after carousel interaction because those elements no longer exist in the DOM.
- `locator.waitFor({ state: 'attached' })` times out even after 30 seconds because Angular never re-creates the destroyed components.
- Forces tests to follow a strict order: verify sections BEFORE interacting with the carousel — an unnatural and fragile constraint.

### Root Cause (Likely)
The home page likely uses `*ngIf` or an `OnPush` change detection strategy where unrelated carousel interactions trigger a top-level Angular zone update, causing the `app-home-card` components for off-screen sections to be re-evaluated and destroyed (e.g., via a lazy-load condition that checks `IntersectionObserver`).

### Suggested Fix
Option A — **Add `trackBy` and prevent unnecessary re-renders**:
Use `trackBy` in any `*ngFor` that renders sections so Angular doesn't destroy/re-create components unnecessarily.

Option B — **Use `ChangeDetectionStrategy.OnPush` correctly**:
Ensure that carousel inputs do not propagate a global change detection cycle to sibling components.

Option C — **Render all section containers upfront, only lazy-load content**:
Always keep the `app-home-card` shell (including the H3 heading) in the DOM. Only lazy-load the card's content (channel thumbnails, etc.) when the card enters the viewport. This ensures section headings are always stable references.

Option D — **Add `data-testid` anchors**:
Add `data-testid="section-now-on-tv"`, `data-testid="section-top-series"`, etc. to stable outer wrapper elements that are always present in the DOM, even before the card content loads.

---

## Issue 3 — `waitUntil: 'networkidle'` never resolves

**Severity:** Medium
**Affects:** All page navigation in tests

### Observed Behavior
Calling `page.goto(url, { waitUntil: 'networkidle' })` always times out. The application has persistent background network requests (analytics pings, heartbeat calls, polling) that prevent the network from going idle.

### Impact on Automation
All page navigation must use `waitUntil: 'load'` combined with a manual `page.waitForTimeout()`, which is less reliable and slow.

### Suggested Fix
Use consistent, predictable URL patterns for background/polling requests (e.g., `/analytics/`, `/heartbeat/`) so tests can exclude them. Alternatively, reduce the frequency of background polling during test environments (detectable via `User-Agent` or a feature flag).

---

## Issue 4 — Home API section titles differ from UI heading text

**Severity:** Low
**Affects:** API-to-UI mapping in tests

### Observed Behavior
The home page API (`/v3/assets/home`) returns sections with titles that do not match what is displayed in the UI:

| API `data[]` index | API `title` | UI heading (H3) | Items |
|--------------------|-------------|-----------------|-------|
| 0 | `Banner` | *(carousel, no heading)* | 5 |
| 1 | `Apps` | **Explore TV** | 29 |
| 2 | `Explore TV` | **Explore TV** (channel logos) | 12 of 199 |
| 3 | `Now on TV` | **Now on TV** | 0 (EPG-driven) |
| 4 | `Top Series` | **Top Series** | 12 of 100 |
| 5 | `Products` | *(not visible)* | 0 |

- API section 1 is named `Apps` but shown as `Explore TV` in the UI.
- API section 2 is named `Explore TV` and contains live channels, also shown as `Explore TV` but with different content than section 1.
- API section 3 `Now on TV` has 0 items in the list — its content comes from the EPG file, not the home API.

### Impact on Automation
Makes API-to-UI mapping confusing and error-prone when writing assertions.

### Suggested Fix
Align API `title` values to match exactly the heading text shown in the UI. If sections can have a different internal name vs display name, add a separate `display_title` field to the API response.

---

## Issue 5 — "Now on TV" section does not render on initial page load

**Severity:** Medium
**Affects:** Now on TV section tests

### Observed Behavior
The "Now on TV" section is rendered only after the EPG data file (`/epgv2/{date}.json`) is fully downloaded and processed by Angular. On initial page load, even after waiting for the EPG API response to complete, the "Now on TV" `<h3>` heading is not present in the DOM.

### Impact on Automation
- Playwright cannot check `<h3>Now on TV</h3>` even after waiting 30+ seconds.
- The section only appears if the user happens to keep the page open long enough while scrolled to that area.

### Suggested Fix
Render the "Now on TV" section skeleton/shell (including the H3 heading) immediately on page load, before EPG data arrives. Use a loading state or skeleton UI for the channel items. This way the heading is always in the DOM, and content populates asynchronously.

---

## Issue 6 — Missing `data-testid` attributes on key interactive elements

**Severity:** Low
**Affects:** Selector stability in all tests

### Observed Behavior
Key UI elements rely on fragile CSS class selectors or role/text matching:

| Element | Current selector used in tests | Risk |
|---------|-------------------------------|------|
| Login modal | `page.getByPlaceholder('Enter Your Subscriber Name')` | Breaks on text change |
| Sign In button | `#signin-btn` | Acceptable |
| Profile dropdown toggle | `a.dropdown-toggle.cursor-pointer` | Breaks on CSS change |
| My Account link | `a[href="/account/settings"]` | Acceptable |
| Profile image (post-login) | `img.non-profile-pic` | Breaks on CSS rename |
| Carousel tabs | `[role="tab"]` | Acceptable |
| Section headings | `h3:text("Now on TV")` | Breaks on text change/language |

### Suggested Fix
Add `data-testid` attributes to stable, test-critical elements:

```html
<!-- Login form -->
<input data-testid="subscriber-name-input" placeholder="Enter Your Subscriber Name" />
<input data-testid="activation-code-input" placeholder="Enter Your Activation Code" />
<button data-testid="signin-button" id="signin-btn">Sign In</button>

<!-- Header/navigation -->
<a data-testid="login-link" href="/auth/signin">Login</a>
<a data-testid="profile-dropdown-toggle" class="dropdown-toggle cursor-pointer">...</a>
<img data-testid="profile-avatar" class="non-profile-pic" />

<!-- Home page sections -->
<app-home-card data-testid="section-explore-tv">...</app-home-card>
<app-home-card data-testid="section-now-on-tv">...</app-home-card>
<app-home-card data-testid="section-top-series">...</app-home-card>
```

---

## Issue 7 — Background analytics requests make test reports noisy

**Severity:** Low
**Affects:** Network request assertions, test duration

### Observed Behavior
The application fires dozens of obfuscated `POST` requests to long random-looking URLs (Firebase/analytics endpoints) on every page. These appear in Playwright's network logs and inflate test durations.

### Suggested Fix
These analytics calls can be blocked in test environments using `page.route()` in Playwright or by adding a `DISABLE_ANALYTICS=true` environment variable check in the app:
```typescript
// In playwright.config.ts
await page.route('**/*.analytics*', route => route.abort());
```
Or have the dev team expose a flag to disable analytics in non-production environments.

---

## Quick Reference: Recommended Changes for Dev Team

| Priority | Change | Benefit |
|----------|--------|---------|
| 🔴 Critical | Fix login redirect after Sign In | Removes page.reload() workaround from tests |
| 🔴 Critical | Keep all `app-home-card` sections in DOM (stable shells) | Enables reliable section testing |
| 🟡 High | Add `data-testid` to key elements | Prevents selector breakage on CSS/text changes |
| 🟡 High | Render "Now on TV" skeleton immediately | Enables heading assertion without EPG wait |
| 🟢 Medium | Align API `title` with UI heading text | Simplifies API-to-UI validation |
| 🟢 Medium | Reduce background polling frequency | Faster tests, cleaner network logs |

---

*Document generated from Playwright automation session. Test files located in `tests/` directory.*
