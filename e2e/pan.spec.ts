import { test, expect, type Page } from '@playwright/test';

/**
 * Pan E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real drag gestures with actual pointer movement and timing
 * - Delta accuracy across real coordinate systems
 * - Direction detection and filtering with real mouse drag
 * - panstart → panmove → panend lifecycle in real DOM
 * - CustomEvent bubbling through real DOM trees
 * - touch-action CSS enforcement
 * - Scrollable container interaction
 * - Multiple sequential pan gestures
 */

async function performDrag(
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

test.describe('Pan E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pan.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: any) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('pan lifecycle', () => {
    test('fires panstart, panmove, and panend in order', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const starts = filterResults(results, 'panstart');
      const moves = filterResults(results, 'panmove');
      const ends = filterResults(results, 'panend');

      expect(starts).toHaveLength(1);
      expect(moves.length).toBeGreaterThan(0);
      expect(ends).toHaveLength(1);

      // Verify ordering: panstart before first panmove, last panmove before panend
      expect(starts[0].timestamp).toBeLessThan(moves[0].timestamp);
      expect(moves[moves.length - 1].timestamp).toBeLessThan(ends[0].timestamp);
    });

    test('panstart has isFirst=true', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts[0].detail.isFirst).toBe(true);
    });

    test('panend has isFinal=true', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const ends = filterResults(await getResults(page), 'panend');
      expect(ends[0].detail.isFinal).toBe(true);
    });
  });

  test.describe('delta accuracy', () => {
    test('panend deltaX matches drag distance (rightward)', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;
      const dragDistance = 150;

      await performDrag(page, startX, startY, startX + dragDistance, startY);

      await page.waitForTimeout(50);
      const ends = filterResults(await getResults(page), 'panend');
      expect(ends).toHaveLength(1);
      // Allow some tolerance for pixel rounding
      expect(Math.abs(Number(ends[0].detail.deltaX) - dragDistance)).toBeLessThan(10);
    });

    test('panend deltaY matches drag distance (downward)', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 30;
      const dragDistance = 150;

      await performDrag(page, startX, startY, startX, startY + dragDistance);

      await page.waitForTimeout(50);
      const ends = filterResults(await getResults(page), 'panend');
      expect(ends).toHaveLength(1);
      expect(Math.abs(Number(ends[0].detail.deltaY) - dragDistance)).toBeLessThan(10);
    });

    test('negative delta for leftward drag', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 230;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX - 150, startY);

      await page.waitForTimeout(50);
      const ends = filterResults(await getResults(page), 'panend');
      expect(ends).toHaveLength(1);
      expect(Number(ends[0].detail.deltaX)).toBeLessThan(-100);
    });

    test('panmove deltas increase progressively', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 200, startY, 20, 5);

      await page.waitForTimeout(50);
      const moves = filterResults(await getResults(page), 'panmove');
      expect(moves.length).toBeGreaterThan(2);

      // Deltas should generally increase
      const firstDelta = Math.abs(Number(moves[0].detail.deltaX));
      const lastDelta = Math.abs(Number(moves[moves.length - 1].detail.deltaX));
      expect(lastDelta).toBeGreaterThan(firstDelta);
    });
  });

  test.describe('direction detection', () => {
    test('right drag detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts[0].detail.direction).toBe('right');
    });

    test('left drag detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 230;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX - 150, startY);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts[0].detail.direction).toBe('left');
    });

    test('down drag detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 30;

      await performDrag(page, startX, startY, startX, startY + 200);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts[0].detail.direction).toBe('down');
    });

    test('up drag detected', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 250;

      await performDrag(page, startX, startY, startX, startY - 200);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts[0].detail.direction).toBe('up');
    });
  });

  test.describe('velocity', () => {
    test('panstart includes velocityX and velocityY', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY, 10, 3);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts).toHaveLength(1);
      // velocityX should be positive for rightward drag
      expect(Number(starts[0].detail.velocityX)).toBeGreaterThan(0);
    });
  });

  test.describe('threshold rejection', () => {
    test('short movement does not fire panstart', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 140;

      // Very small drag — within 10px threshold
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 3, startY + 2);
      await page.waitForTimeout(20);
      await page.mouse.up();

      await page.waitForTimeout(100);
      const starts = filterResults(await getResults(page), 'panstart');
      expect(starts).toHaveLength(0);
    });
  });

  test.describe('direction filtering', () => {
    test('horizontal drag fires on horizontal-only target', async ({ page }) => {
      const box = await page.locator('#horizontal-target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 180, startY);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'h-panstart');
      expect(starts).toHaveLength(1);
      expect(starts[0].detail.direction).toBe('right');
    });

    test('vertical drag does not fire on horizontal-only target', async ({ page }) => {
      const box = await page.locator('#horizontal-target').boundingBox();
      const startX = box!.x + 140;
      const startY = box!.y + 30;

      await performDrag(page, startX, startY, startX, startY + 200);

      await page.waitForTimeout(100);
      const starts = filterResults(await getResults(page), 'h-panstart');
      expect(starts).toHaveLength(0);
    });

    test('left drag fires on horizontal-only target', async ({ page }) => {
      const box = await page.locator('#horizontal-target').boundingBox();
      const startX = box!.x + 230;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX - 180, startY);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'h-panstart');
      expect(starts).toHaveLength(1);
      expect(starts[0].detail.direction).toBe('left');
    });
  });

  test.describe('multiple sequential pans', () => {
    test('two separate pans both fire complete lifecycle', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      // First pan
      await performDrag(page, startX, startY, startX + 150, startY);
      await page.waitForTimeout(100);

      // Second pan
      await performDrag(page, startX + 150, startY, startX, startY);

      await page.waitForTimeout(50);
      const starts = filterResults(await getResults(page), 'panstart');
      const ends = filterResults(await getResults(page), 'panend');
      expect(starts).toHaveLength(2);
      expect(ends).toHaveLength(2);
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('dispatches fngr:panstart on the element', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:panstart');
      expect(results).toHaveLength(1);
      expect(results[0].detail.direction).toBe('right');
    });

    test('dispatches fngr:panmove events', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:panmove');
      expect(results.length).toBeGreaterThan(0);
    });

    test('dispatches fngr:panend on pointerup', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const startX = box!.x + 50;
      const startY = box!.y + 140;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:panend');
      expect(results).toHaveLength(1);
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      await page.evaluate(() => {
        document.body.addEventListener('fngr:panstart', (e: Event) => {
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

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on pan target', async ({ page }) => {
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
    test('pan inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      const startX = box!.x + 20;
      const startY = box!.y + 50;

      await performDrag(page, startX, startY, startX + 150, startY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'scroll-panstart');
      expect(results).toHaveLength(1);
    });

    test('pan works after scrolling the container', async ({ page }) => {
      await page.locator('#scroll-container').evaluate((el: HTMLElement) => {
        el.scrollTop = 100;
      });
      await page.waitForTimeout(50);

      const box = await page.locator('#scroll-target').boundingBox();
      if (box) {
        const startX = box.x + 20;
        const startY = box.y + 50;

        await performDrag(page, startX, startY, startX + 150, startY);

        await page.waitForTimeout(50);
        const results = filterResults(await getResults(page), 'scroll-panstart');
        expect(results).toHaveLength(1);
      }
    });
  });

  test.describe('no recognizer zones', () => {
    test('drag on element without recognizer does not fire events', async ({ page }) => {
      const box = await page.locator('#no-tap-zone').boundingBox();

      await performDrag(page, box!.x + 30, box!.y + 50, box!.x + 250, box!.y + 50);

      await page.waitForTimeout(100);
      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });
});
