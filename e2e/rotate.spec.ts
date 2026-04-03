import { test, expect, type Page } from '@playwright/test';

/**
 * Rotate E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real two-finger rotation gestures via CDP multi-touch dispatch
 * - Rotation angle calculation with real pointer coordinate systems
 * - Center point accuracy between two real touch points
 * - rotatestart -> rotatemove -> rotateend lifecycle in real DOM
 * - CustomEvent bubbling through real DOM trees
 * - touch-action CSS enforcement
 * - Scrollable container interaction
 *
 * CDP multi-touch (Input.dispatchTouchEvent) is Chromium-only.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'CDP multi-touch is Chromium-only');

async function performRotate(
  page: Page,
  centerX: number,
  centerY: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  steps = 10,
  stepDelay = 5,
) {
  const cdp = await page.context().newCDPSession(page);
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const startAngle = toRad(startAngleDeg);
  const endAngle = toRad(endAngleDeg);

  // Two fingers opposite each other on the circle
  const x1Start = centerX + radius * Math.cos(startAngle);
  const y1Start = centerY + radius * Math.sin(startAngle);
  const x2Start = centerX + radius * Math.cos(startAngle + Math.PI);
  const y2Start = centerY + radius * Math.sin(startAngle + Math.PI);

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x1Start, y: y1Start, id: 0 },
      { x: x2Start, y: y2Start, id: 1 },
    ],
  });

  await page.waitForTimeout(stepDelay);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + (endAngle - startAngle) * t;

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), id: 0 },
        {
          x: centerX + radius * Math.cos(angle + Math.PI),
          y: centerY + radius * Math.sin(angle + Math.PI),
          id: 1,
        },
      ],
    });
    if (stepDelay > 0) await page.waitForTimeout(stepDelay);
  }

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('Rotate E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rotate.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: Page) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('clockwise detection', () => {
    test('clockwise rotation fires rotatestart', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // 45° clockwise rotation (0° → 45°)
      await performRotate(page, cx, cy, 60, 0, 45);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'rotatestart');
      expect(starts).toHaveLength(1);
      expect(starts[0].detail.isFirst).toBe(true);
    });

    test('positive rotation on clockwise gesture', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, 45);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const ends = filterResults(results, 'rotateend');
      expect(ends).toHaveLength(1);
      expect(Number(ends[0].detail.rotation)).toBeGreaterThan(0);
    });
  });

  test.describe('counterclockwise detection', () => {
    test('counterclockwise rotation fires rotatestart', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // 45° counterclockwise rotation (0° → -45°)
      await performRotate(page, cx, cy, 60, 0, -45);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'rotatestart');
      expect(starts).toHaveLength(1);
    });

    test('negative rotation on counterclockwise gesture', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, -45);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const ends = filterResults(results, 'rotateend');
      expect(ends).toHaveLength(1);
      expect(Number(ends[0].detail.rotation)).toBeLessThan(0);
    });
  });

  test.describe('event lifecycle', () => {
    test('complete lifecycle: rotatestart, rotatemove, rotateend', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, 45, 15, 5);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'rotatestart');
      const moves = filterResults(results, 'rotatemove');
      const ends = filterResults(results, 'rotateend');

      expect(starts).toHaveLength(1);
      expect(moves.length).toBeGreaterThan(0);
      expect(ends).toHaveLength(1);

      // Verify ordering
      expect(starts[0].timestamp).toBeLessThan(moves[0].timestamp);
      expect(moves[moves.length - 1].timestamp).toBeLessThan(ends[0].timestamp);
    });

    test('rotateend has isFinal=true', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, 45);

      await page.waitForTimeout(50);
      const ends = filterResults(await getResults(page), 'rotateend');
      expect(ends).toHaveLength(1);
      expect(ends[0].detail.isFinal).toBe(true);
    });
  });

  test.describe('center point', () => {
    test('center reported near the midpoint of the two fingers', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, 45);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'rotatestart');
      expect(starts).toHaveLength(1);

      const center = starts[0].detail.center as { x: number; y: number };
      // Center should be near the midpoint we specified (allow tolerance for rounding)
      expect(Math.abs(center.x - cx)).toBeLessThan(30);
      expect(Math.abs(center.y - cy)).toBeLessThan(30);
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('dispatches fngr:rotatestart on the element', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, 45);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:rotatestart');
      expect(results).toHaveLength(1);
      expect(Number(results[0].detail.rotation)).toBeGreaterThan(0);
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      await page.evaluate(() => {
        document.body.addEventListener('fngr:rotatestart', (e: Event) => {
          window.fngrResults.push({
            type: 'body-bubble',
            timestamp: performance.now(),
            detail: { rotation: (e as CustomEvent).detail.rotation },
          });
        });
      });

      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await performRotate(page, cx, cy, 60, 0, 45);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on rotate target', async ({ page }) => {
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
    test('rotate inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      const cx = box!.x + box!.width / 2;
      const cy = box!.y + box!.height / 2;

      await performRotate(page, cx, cy, 30, 0, 45);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'scroll-rotatestart');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('no recognizer zones', () => {
    test('rotate on element without recognizer does not fire events', async ({ page }) => {
      const box = await page.locator('#no-recognizer-zone').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 50;

      await performRotate(page, cx, cy, 30, 0, 45);

      await page.waitForTimeout(100);
      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });
});
