import { test, expect } from '@playwright/test';

const BASE_URL = 'https://telvi.tv2zdev.com';
const HOME_API_URL =
  'https://api.telvi.tv/preprod/v3/assets/home?country_code=in&d_type=web&limit=6&locale=en-US&offset=0&region=int&version=v1';

// ─────────────────────────────────────────────────────────────────────────────
// Home API structure (data[] indices)
//   0 → Banner        — 5 items  (hero carousel)
//   1 → Apps          — 29 items (Explore TV app-icons grid in UI)
//   2 → Explore TV    — 12 of 199 items (Now on TV live channels in UI)
//   3 → Now on TV     — 0 items  (EPG-driven, no list)
//   4 → Top Series    — 12 of 100 items
//   5 → Products      — 0 items
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Home Page — All Carousels & API Validation', () => {

  // ── TEST 1: API contract ───────────────────────────────────────────────────
  test('API: home endpoint — validate all sections', async ({ request }, testInfo) => {

    const response = await request.get(HOME_API_URL);
    const body     = await response.json();
    const sections = body.data as any[];

    // ── Step 1: Top-level response ──────────────────────────────────────────
    await test.step('Step 1: HTTP 200 and envelope fields', async () => {
      expect(response.status(), 'HTTP status').toBe(200);
      expect(body.status_code, 'body.status_code').toBe(200);
      expect(body.message).toBe('Fetch Home Success');
      expect(Array.isArray(sections), 'data must be an array').toBe(true);
      expect(sections.length, 'API returns 6 sections').toBe(6);

      await testInfo.attach('API — full section summary', {
        body: JSON.stringify(
          sections.map((s, i) => ({
            index: i,
            title: s.title,
            total_count: s.total_count ?? 'n/a',
            list_count: s.list?.length ?? 0,
          })),
          null, 2
        ),
        contentType: 'application/json',
      });
    });

    // ── Step 2: Banner section (data[0]) ────────────────────────────────────
    await test.step('Step 2: Banner section — 5 items with required fields', async () => {
      const banner = sections[0];
      expect(banner.title).toBe('Banner');
      expect(banner.total_count, 'Banner total_count').toBe(5);

      const items = banner.list as any[];
      expect(items.length, 'Banner list length').toBe(5);

      for (const [i, item] of items.entries()) {
        expect(item.id,              `banner[${i}].id`).toBeDefined();
        expect(item.title,           `banner[${i}].title`).toBeTruthy();
        expect(item.banner_order,    `banner[${i}].banner_order`).toBeDefined();
        expect(item.collection_title,`banner[${i}].collection_title`).toBe('banner');
      }

      await testInfo.attach('API — Banner items', {
        body: JSON.stringify(
          items.map(i => ({ id: i.id, title: i.title, banner_order: i.banner_order, content_type: i.content_type, is_livechannel: i.is_livechannel, duration: i.duration })),
          null, 2
        ),
        contentType: 'application/json',
      });
    });

    // ── Step 3: Apps section (data[1]) ──────────────────────────────────────
    await test.step('Step 3: Apps section — 29 items, each has title', async () => {
      const apps = sections[1];
      expect(apps.title).toBe('Apps');

      const items = apps.list as any[];
      expect(items.length, 'Apps list length').toBe(29);
      for (const [i, item] of items.entries()) {
        expect(item.title, `apps[${i}].title`).toBeTruthy();
      }

      await testInfo.attach('API — Apps items (first 10)', {
        body: JSON.stringify(items.slice(0, 10).map(i => ({ title: i.title, package: i.package })), null, 2),
        contentType: 'application/json',
      });
    });

    // ── Step 4: Explore TV / live channels section (data[2]) ────────────────
    await test.step('Step 4: Explore TV section — 12 of 199 live channels', async () => {
      const exploreTV = sections[2];
      expect(exploreTV.title).toBe('Explore TV');
      expect(exploreTV.total_count, 'total channel count').toBe(199);

      const items = exploreTV.list as any[];
      expect(items.length, '12 channels returned in list').toBe(12);
      for (const [i, item] of items.entries()) {
        expect(item.id,    `exploreTV[${i}].id`).toBeDefined();
        expect(item.title, `exploreTV[${i}].title`).toBeTruthy();
        expect(item.is_livechannel, `exploreTV[${i}].is_livechannel`).toBe(1);
      }

      await testInfo.attach('API — Explore TV channel list (first 12)', {
        body: JSON.stringify(items.map(i => ({ id: i.id, title: i.title, slug: i.slug })), null, 2),
        contentType: 'application/json',
      });
    });

    // ── Step 5: Top Series section (data[4]) ────────────────────────────────
    await test.step('Step 5: Top Series section — 12 of 100 series', async () => {
      const topSeries = sections[4];
      expect(topSeries.title).toBe('Top Series');
      expect(topSeries.total_count, 'Top Series total_count').toBe(100);

      const items = topSeries.list as any[];
      expect(items.length, '12 series returned in list').toBe(12);
      for (const [i, item] of items.entries()) {
        expect(item.title, `topSeries[${i}].title`).toBeTruthy();
      }

      await testInfo.attach('API — Top Series list', {
        body: JSON.stringify(items.map(i => ({ id: i.id, title: i.title })), null, 2),
        contentType: 'application/json',
      });
    });
  });

  // ── TEST 2: UI vs API — all homepage sections ─────────────────────────────
  test('UI + API: all home page sections match API data', async ({ page, request }, testInfo) => {
    test.setTimeout(90000);

    // Fetch all sections up front
    const apiRes  = await request.get(HOME_API_URL);
    const apiBody = await apiRes.json();
    const sections = apiBody.data as any[];

    const bannerItems  : any[] = sections[0].list;
    const appsItems    : any[] = sections[1].list;
    const channelItems : any[] = sections[2].list;
    const seriesItems  : any[] = sections[4].list;

    await testInfo.attach('API — all sections summary', {
      body: JSON.stringify(
        sections.map((s, i) => ({ index: i, title: s.title, list_count: s.list?.length ?? 0, total_count: s.total_count ?? 'n/a' })),
        null, 2
      ),
      contentType: 'application/json',
    });

    // ── Step 1: Navigate to home page ────────────────────────────────────────
    await test.step('Step 1: Navigate to home page', async () => {
      // Wait for EPG + live channels APIs — these power the "Now on TV" section
      await Promise.all([
        page.waitForResponse(r => r.url().includes('livechannels') && r.status() === 200, { timeout: 30000 }),
        page.waitForResponse(r => r.url().includes('epgv2') && r.status() === 200, { timeout: 30000 }),
        page.goto(`${BASE_URL}/home`, { waitUntil: 'load' }),
      ]);
      await page.waitForTimeout(3000); // let Angular process EPG and render all async sections
      await expect(page).toHaveTitle(/telvi/i);

      await testInfo.attach('01 - Home Page Loaded', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 2: Banner carousel — count matches API ───────────────────────────
    await test.step(`Step 2: Banner carousel — ${bannerItems.length} slides (matches API total_count)`, async () => {
      await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();

      const tabCount = await page.getByRole('tab').count();
      expect(tabCount, `UI slide count (${tabCount}) must equal API banner count (${bannerItems.length})`).toBe(bannerItems.length);

      await testInfo.attach(`02 - Banner carousel — ${tabCount} slides`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 3: Verify each banner slide title matches API ────────────────────
    for (let i = 0; i < bannerItems.length; i++) {
      const item = bannerItems[i];
      await test.step(`Step 3.${i + 1}: Slide ${i + 1} — "${item.title}" (id: ${item.id})`, async () => {
        await page.getByRole('tab').nth(i).click();
        await page.waitForTimeout(500);

        await expect(
          page.locator('[role="tabpanel"]').filter({ hasText: item.title }).first(),
          `Slide ${i + 1} must display "${item.title}" from API`
        ).toBeVisible({ timeout: 5000 });

        await testInfo.attach(`03.${i + 1} — Slide "${item.title}"`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      });
    }

    // ── Step 4: Next / Previous navigation ───────────────────────────────────
    await test.step('Step 4: Next button cycles through all banner slides', async () => {
      await page.getByRole('tab').first().click();
      await page.waitForTimeout(400);

      for (let i = 0; i < bannerItems.length - 1; i++) {
        await page.getByRole('button', { name: 'Next' }).click();
        await page.waitForTimeout(400);
      }

      await testInfo.attach('04 - After cycling all slides via Next', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    await test.step('Step 4b: Previous button navigates back one slide', async () => {
      await page.getByRole('button', { name: 'Previous' }).click();
      await page.waitForTimeout(400);

      await testInfo.attach('04b - After Previous click', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // Scroll forward progressively — app-home-card components are destroyed
    // when scrolled out of view, so we must never scroll back up past a section.

    // ── Step 5: Explore TV section (Apps) — scroll to it ─────────────────────
    await test.step(`Step 5: "Explore TV" section — ${appsItems.length} app items from API`, async () => {
      // Scroll down gently until "Explore TV" appears
      for (const yPos of [400, 700, 1000]) {
        const found = await page.locator('h3').filter({ hasText: 'Explore TV' }).count();
        if (found > 0) break;
        await page.evaluate(`window.scrollTo(0, ${yPos})`);
        await page.waitForTimeout(600);
      }
      const exploreTVHeading = page.locator('h3').filter({ hasText: 'Explore TV' });
      await expect(exploreTVHeading).toBeVisible({ timeout: 10000 });

      await testInfo.attach('05 - Explore TV section visible', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 6: Now on TV section — wait for DOM then scroll ─────────────────
    await test.step(`Step 6: "Now on TV" section — first 3 channels match API Explore TV list`, async () => {
      // "Now on TV" is EPG-driven — wait for it to be attached to DOM (up to 30s)
      const nowOnTVHeading = page.locator('h3').filter({ hasText: 'Now on TV' });
      await nowOnTVHeading.waitFor({ state: 'attached', timeout: 30000 });
      await nowOnTVHeading.scrollIntoViewIfNeeded();
      await expect(nowOnTVHeading).toBeVisible({ timeout: 5000 });

      for (const ch of channelItems.slice(0, 3)) {
        await expect(
          page.getByText(ch.title, { exact: true }).first(),
          `Channel "${ch.title}" from API should appear in Now on TV`
        ).toBeVisible({ timeout: 5000 });
      }

      await testInfo.attach('06 - Now on TV section — first 3 channels visible', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 7: Top Series section — wait for DOM then scroll ────────────────
    await test.step(`Step 7: "Top Series" section — first 3 titles match API (total: ${sections[4].total_count})`, async () => {
      const topSeriesHeading = page.locator('h3').filter({ hasText: 'Top Series' });
      await topSeriesHeading.waitFor({ state: 'attached', timeout: 30000 });
      await topSeriesHeading.scrollIntoViewIfNeeded();
      await expect(topSeriesHeading).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);

      for (const series of seriesItems.slice(0, 3)) {
        await expect(
          page.getByText(series.title, { exact: true }).first(),
          `Series "${series.title}" from API should appear in Top Series section`
        ).toBeVisible({ timeout: 5000 });
      }

      await testInfo.attach(`07 - Top Series section (${seriesItems.length} of ${sections[4].total_count} shown)`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 8: Full page screenshot from top ─────────────────────────────────
    await test.step('Step 8: Scroll back to top for full-page screenshot', async () => {
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(800);

      await testInfo.attach('08 - Full Home Page (from top)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });
  });

});
