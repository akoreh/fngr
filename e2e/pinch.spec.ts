import { test, expect, type Page } from '@playwright/test';

/**
 * Pinch E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real two-finger pinch gestures via CDP multi-touch dispatch
 * - Scale calculation with real pointer coordinate systems
 * - Center point accuracy between two real touch points
 * - pinchstart -> pinchmove -> pinchend lifecycle in real DOM
 * - CustomEvent bubbling through real DOM trees
 * - touch-action CSS enforcement
 * - Scrollable container interaction
 *
 * CDP multi-touch (Input.dispatchTouchEvent) is Chromium-only.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'CDP multi-touch is Chromium-only');

async function performPinch(
  page: Page,
  centerX: number,
  centerY: number,
  startSpread: number,
  endSpread: number,
  steps = 10,
  stepDelay = 5,
) {
  const cdp = await page.context().newCDPSession(page);

  // Start positions — two fingers placed horizontally around center
  const startX1 = centerX - startSpread / 2;
  const startX2 = centerX + startSpread / 2;

  // Touch start with both fingers
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: startX1, y: centerY, id: 0 },
      { x: startX2, y: centerY, id: 1 },
    ],
  });

  await page.waitForTimeout(stepDelay);

  // Move fingers closer together or farther apart
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const spread = startSpread + (endSpread - startSpread) * t;
    const x1 = centerX - spread / 2;
    const x2 = centerX + spread / 2;

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x1, y: centerY, id: 0 },
        { x: x2, y: centerY, id: 1 },
      ],
    });
    if (stepDelay > 0) await page.waitForTimeout(stepDelay);
  }

  // Touch end — release both fingers
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await cdp.detach();
}

test.describe('Pinch E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pinch.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: Page) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('pinch-out detection', () => {
    test('spread gesture fires pinchstart', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // Spread from 60px apart to 200px apart
      await performPinch(page, cx, cy, 60, 200);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'pinchstart');
      expect(starts).toHaveLength(1);
      expect(starts[0].detail.isFirst).toBe(true);
    });

    test('scale > 1 on spread', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 60, 200);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const ends = filterResults(results, 'pinchend');
      expect(ends).toHaveLength(1);
      expect(Number(ends[0].detail.scale)).toBeGreaterThan(1);
    });
  });

  test.describe('pinch-in detection', () => {
    test('squeeze gesture fires pinchstart', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // Squeeze from 200px apart to 60px apart
      await performPinch(page, cx, cy, 200, 60);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'pinchstart');
      expect(starts).toHaveLength(1);
    });

    test('scale < 1 on squeeze', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 200, 60);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const ends = filterResults(results, 'pinchend');
      expect(ends).toHaveLength(1);
      expect(Number(ends[0].detail.scale)).toBeLessThan(1);
    });
  });

  test.describe('event lifecycle', () => {
    test('complete lifecycle: pinchstart, pinchmove, pinchend', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 60, 200, 15, 5);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'pinchstart');
      const moves = filterResults(results, 'pinchmove');
      const ends = filterResults(results, 'pinchend');

      expect(starts).toHaveLength(1);
      expect(moves.length).toBeGreaterThan(0);
      expect(ends).toHaveLength(1);

      // Verify ordering
      expect(starts[0].timestamp).toBeLessThan(moves[0].timestamp);
      expect(moves[moves.length - 1].timestamp).toBeLessThan(ends[0].timestamp);
    });

    test('pinchend has isFinal=true', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 60, 200);

      await page.waitForTimeout(50);
      const ends = filterResults(await getResults(page), 'pinchend');
      expect(ends).toHaveLength(1);
      expect(ends[0].detail.isFinal).toBe(true);
    });
  });

  test.describe('center point', () => {
    test('center reported near the midpoint of the two fingers', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 60, 200);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'pinchstart');
      expect(starts).toHaveLength(1);

      const center = starts[0].detail.center as { x: number; y: number };
      // Center should be near the midpoint we specified (allow tolerance for rounding)
      expect(Math.abs(center.x - cx)).toBeLessThan(30);
      expect(Math.abs(center.y - cy)).toBeLessThan(30);
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('dispatches fngr:pinchstart on the element', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 60, 200);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:pinchstart');
      expect(results).toHaveLength(1);
      expect(Number(results[0].detail.scale)).toBeGreaterThan(0);
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      await page.evaluate(() => {
        document.body.addEventListener('fngr:pinchstart', (e: Event) => {
          window.fngrResults.push({
            type: 'body-bubble',
            timestamp: performance.now(),
            detail: { scale: (e as CustomEvent).detail.scale },
          });
        });
      });

      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performPinch(page, cx, cy, 60, 200);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on pinch target', async ({ page }) => {
      const touchAction = await page
        .locator('#target')
        .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(touchAction).toBe('none');
    });

    test('touch-action: none on all managed elements', async ({ page }) => {
      for (const selector of ['#target', '#scroll-target']) {
        const touchAction = await page
          .locator(selector)
          .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
        expect(touchAction).toBe('none');
      }
    });
  });

  test.describe('interaction with scrollable containers', () => {
    test('pinch inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      const cx = box!.x + box!.width / 2;
      const cy = box!.y + box!.height / 2;

      await performPinch(page, cx, cy, 30, 80);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'scroll-pinchstart');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('no recognizer zones', () => {
    test('pinch on element without recognizer does not fire events', async ({ page }) => {
      const box = await page.locator('#no-recognizer-zone').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 50;

      await performPinch(page, cx, cy, 30, 100);

      await page.waitForTimeout(100);
      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });
});
