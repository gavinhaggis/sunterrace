import { test, expect, type Page } from '@playwright/test';

const TOTAL_VENUES = 2805; // count from src/data/venues.json (OSM HMA scrape)
const MOCK_OVERPASS_EMPTY = JSON.stringify({ elements: [] });
const MOCK_PRECOMPUTED_EMPTY = JSON.stringify({});

// Place a 999m building just south of the given venue coordinates
function mockOverpassBlocking(venueLat: number, venueLon: number): string {
  const bLat = venueLat - 0.0005;
  return JSON.stringify({
    elements: [
      { type: 'node', id: 1, lat: bLat - 0.00005, lon: venueLon - 0.0001 },
      { type: 'node', id: 2, lat: bLat - 0.00005, lon: venueLon + 0.0001 },
      { type: 'node', id: 3, lat: bLat + 0.00005, lon: venueLon + 0.0001 },
      { type: 'node', id: 4, lat: bLat + 0.00005, lon: venueLon - 0.0001 },
      { type: 'way', id: 100, nodes: [1, 2, 3, 4, 1], tags: { building: 'yes', height: '999' } },
    ],
  });
}

async function mockNominatim(page: Page, name: string) {
  await page.route('**/nominatim.openstreetmap.org/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ address: { road: name } }),
    }),
  );
}

async function mockOverpass(page: Page, body: string) {
  await page.route('**/overpass-api.de/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body }),
  );
}

async function mockPrecomputed(page: Page, body = MOCK_PRECOMPUTED_EMPTY) {
  await page.route('**/precomputed.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body }),
  );
}

async function setDatetime(page: Page, isoLocal: string) {
  await page.fill('input[type="datetime-local"]', isoLocal);
}

test.describe('TerraceSun v2 app', () => {
  // ── Loading & list ────────────────────────────────────────────────────
  test('loads and renders the full HMA venue list', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');

    await expect(page.getByText('TerraceSun')).toBeVisible();
    const items = page.locator('.terrace-item');
    await expect(items).toHaveCount(TOTAL_VENUES);
  });

  test('shows hint text before any venue is selected', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await expect(page.getByText(/Tap a venue|Loading sunlight/)).toBeVisible();
  });

  // ── Search ────────────────────────────────────────────────────────────
  test('search filters the venue list', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');

    const allCount = await page.locator('.terrace-item').count();
    await page.fill('input[type="search"]', 'Cafe');
    const filtered = await page.locator('.terrace-item').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(allCount);
  });

  test('clearing search restores the full list', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');

    await page.fill('input[type="search"]', 'xyz-no-match');
    await expect(page.locator('.terrace-item')).toHaveCount(0);
    await page.click('.search-clear');
    await expect(page.locator('.terrace-item')).toHaveCount(TOTAL_VENUES);
  });

  // ── Filter bar ────────────────────────────────────────────────────────
  test('amenity filter pills reduce the list', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');

    const allCount = await page.locator('.terrace-item').count();
    await page.click('.filter-pill:has-text("Pub")');
    const pubCount = await page.locator('.terrace-item').count();
    expect(pubCount).toBeGreaterThan(0);
    expect(pubCount).toBeLessThan(allCount);
  });

  test('city chip filter reduces the list', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');

    const allCount = await page.locator('.terrace-item').count();
    await page.click('.filter-chip:has-text("Espoo")');
    const espooCount = await page.locator('.terrace-item').count();
    expect(espooCount).toBeGreaterThan(0);
    expect(espooCount).toBeLessThan(allCount);
  });

  // ── Sun panel ────────────────────────────────────────────────────────
  test('clicking a venue shows the sun panel', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-panel')).toBeVisible({ timeout: 10_000 });
  });

  test('reports "In direct sunlight" at summer noon', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-panel.sunny')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('In direct sunlight')).toBeVisible();
  });

  test('reports "Sun below horizon" in winter at night', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-01-15T03:00');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-panel.below_horizon')).toBeVisible({ timeout: 10_000 });
  });

  test('reports "Blocked by building" with a tall south building', async ({ page }) => {
    // First venue is "10. Kerros" at 60.1702551, 24.93887
    await mockOverpass(page, mockOverpassBlocking(60.1702551, 24.93887));
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-panel.blocked')).toBeVisible({ timeout: 10_000 });
  });

  test('shows sun timeline after selecting a venue', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-timeline-svg')).toBeVisible({ timeout: 10_000 });
  });

  test('shows obstruction diagram under "Further details" accordion', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-panel')).toBeVisible({ timeout: 10_000 });
    // Diagram is hidden by default
    await expect(page.locator('.sun-diagram-wrap')).not.toBeVisible();
    // Open accordion
    await page.click('.details-toggle');
    await expect(page.locator('.sun-diagram-wrap svg')).toBeVisible();
  });

  test('updates result when datetime changes', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await page.click('.terrace-item:first-child');
    await setDatetime(page, '2025-06-21T13:25');
    await expect(page.locator('.sun-panel.sunny')).toBeVisible({ timeout: 10_000 });
    await setDatetime(page, '2025-01-15T03:00');
    await expect(page.locator('.sun-panel.below_horizon')).toBeVisible({ timeout: 10_000 });
  });

  // ── Venue metadata badges ─────────────────────────────────────────────
  test('shows outdoor seating badge in sun panel', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');
    await page.click('.terrace-item:first-child');
    await expect(page.locator('.sun-panel')).toBeVisible({ timeout: 10_000 });
    const badgeCount = await page.locator('.badge').count();
    expect(badgeCount).toBeGreaterThanOrEqual(1);
  });

  // ── Pin drop ──────────────────────────────────────────────────────────
  test('dropping a pin shows it in the list and opens sun panel', async ({ page }) => {
    await mockOverpass(page, MOCK_OVERPASS_EMPTY);
    await mockPrecomputed(page);
    await mockNominatim(page, 'Mannerheimintie');
    await page.goto('/');
    await setDatetime(page, '2025-06-21T13:25');

    await page.click('.maplibregl-canvas', { position: { x: 100, y: 100 }, force: true });

    await expect(page.locator('.terrace-item:has-text("📍")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.sun-panel')).toBeVisible({ timeout: 10_000 });
  });
});
