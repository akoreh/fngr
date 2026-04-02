import { test, expect, type Page } from '@playwright/test';

/**
 * Swipe E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real drag gestures with actual timing and velocity
 * - Direction detection with real mouse movement
 * - Direction filtering (horizontal-only target)
 * - CustomEvent bubbling through real DOM trees
 * - Scrollable container interaction
 * - touch-action CSS enforcement
 * - Velocity-based rejection with real timing
 */

async function performSwipe(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 10,
  stepDelay = 5,
) {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    await page.mouse.move(x, y);
    if (stepDelay > 0) await page.waitForTimeout(stepDelay);
  }
  await page.mouse.up();
}

test.describe('Swipe E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swipe.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: any) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('directional detection', () => {
    test('right swipe detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('right');
    });

    test('left swipe detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 230;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX - 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('left');
    });

    test('down swipe detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 30;

      await performSwipe(page, startX, startY, startX, startY + 200);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('down');
    });

    test('up swipe detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 250;

      await performSwipe(page, startX, startY, startX, startY - 200);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('up');
    });
  });

  test.describe('event payload', () => {
    test('includes distance and velocity', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(1);
      expect(Number(results[0].detail.distance)).toBeGreaterThan(100);
      expect(Number(results[0].detail.velocity)).toBeGreaterThan(0);
    });

    test('two separate swipes both fire', async ({ page, browserName }) => {
      // Webkit on Linux CI drops the second synthetic mouse gesture — skip
      test.skip(browserName === 'webkit', 'webkit CI drops second synthetic swipe');

      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX + 180, startY);
      await page.waitForTimeout(200);
      await performSwipe(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(2);
    });
  });

  test.describe('threshold rejection', () => {
    test('short movement does not fire swipe', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 140;

      // Very short drag — under 30px threshold
      await performSwipe(page, startX, startY, startX + 15, startY);

      await page.waitForTimeout(100);
      const results = filterResults(await getResults(page), 'swipe');
      expect(results).toHaveLength(0);
    });
  });

  test.describe('direction filtering', () => {
    test('horizontal swipe fires on horizontal-only target', async ({ page }) => {
      const box = await page.locator('#horizontal-target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'h-swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('right');
    });

    test('vertical swipe does not fire on horizontal-only target', async ({ page }) => {
      const box = await page.locator('#horizontal-target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 30;

      await performSwipe(page, startX, startY, startX, startY + 200);

      await page.waitForTimeout(100);
      const results = filterResults(await getResults(page), 'h-swipe');
      expect(results).toHaveLength(0);
    });

    test('left swipe fires on horizontal-only target', async ({ page }) => {
      const box = await page.locator('#horizontal-target').boundingBox();
      const startX = box!.x + 230;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX - 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'h-swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('left');
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('dispatches fngr:swipe on the element', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:swipe');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('right');
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      await page.evaluate(() => {
        document.body.addEventListener('fngr:swipe', (e: Event) => {
          window.fngrResults.push({
            type: 'body-bubble',
            timestamp: performance.now(),
            detail: { direction: (e as CustomEvent).detail.direction },
          });
        });
      });

      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performSwipe(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on swipe target', async ({ page }) => {
      const touchAction = await page
        .locator('#target')
        .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(touchAction).toBe('none');
    });

    test('touch-action: none is set on all managed elements', async ({ page }) => {
      for (const selector of ['#target', '#horizontal-target', '#scroll-target']) {
        const touchAction = await page
          .locator(selector)
          .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
        expect(touchAction).toBe('none');
      }
    });
  });

  test.describe('interaction with scrollable containers', () => {
    test('swipe inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      const startX = box!.x + 20;
      const startY = box!.y + 50;

      await performSwipe(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'scroll-swipe');
      expect(results).toHaveLength(1);
    });

    test('swipe works after scrolling the container', async ({ page }) => {
      await page.locator('#scroll-container').evaluate((el: HTMLElement) => {
        el.scrollTop = 100;
      });
      await page.waitForTimeout(50);

      const box = await page.locator('#scroll-target').boundingBox();
      if (box) {
        const startX = box.x + 20;
        const startY = box.y + 50;

        await performSwipe(page, startX, startY, startX + 150, startY);

        await page.waitForTimeout(50);
        const results = filterResults(await getResults(page), 'scroll-swipe');
        expect(results).toHaveLength(1);
      }
    });
  });

  test.describe('no recognizer zones', () => {
    test('drag on element without recognizer does not fire events', async ({ page }) => {
      const box = await page.locator('#no-tap-zone').boundingBox();

      await performSwipe(page, box!.x + 30, box!.y + 50, box!.x + 250, box!.y + 50);

      await page.waitForTimeout(100);
      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });
});
