import { test, expect } from '@playwright/test';

/**
 * DoubleTap E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real double-click timing with actual clock
 * - CustomEvent bubbling through real DOM trees
 * - Tap + doubletap arbitration with real timing
 * - Coordinate accuracy with real layout
 * - Scrollable container interaction
 * - touch-action CSS enforcement
 * - Movement rejection with real mouse drag
 */

test.describe('DoubleTap E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/doubletap.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: any) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('basic double-tap detection', () => {
    test('two quick clicks fire doubletap', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(1);
      expect(results[0].detail.count).toBe(2);
    });

    test('single click does not fire doubletap', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 140);

      await page.waitForTimeout(400); // wait past interval
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(0);
    });

    test('double-tap at real-world speed fires correctly', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // Realistic double-click with ~150ms gap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(150);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(1);
    });

    test('two separate double-taps both fire', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // First double-tap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      // Wait for reset
      await page.waitForTimeout(400);

      // Second double-tap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(2);
    });
  });

  test.describe('interval behavior', () => {
    test('clicks too far apart do not fire doubletap', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400); // > 300ms default interval
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(0);
    });

    test('clicks within interval fire doubletap', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(200); // < 300ms
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('coordinate accuracy', () => {
    test('reported coordinates match actual click position', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const clickX = Math.round(box!.x + 100);
      const clickY = Math.round(box!.y + 80);

      await page.mouse.click(clickX, clickY);
      await page.waitForTimeout(80);
      await page.mouse.click(clickX, clickY);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(1);
      // Coordinates from second tap — allow 1px tolerance for subpixel rounding
      expect(results[0].detail.clientX).toBeCloseTo(clickX, 0);
      expect(results[0].detail.clientY).toBeCloseTo(clickY, 0);
    });

    test('slightly offset second click still fires (within threshold)', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx + 5, cy + 3); // 5.8px < 10px threshold

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(1);
    });

    test('second click too far away does not fire', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx + 30, cy); // 30px > 10px threshold

      await page.waitForTimeout(400);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(0);
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('CustomEvent bubbles from target through DOM', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'fngr:doubletap');
      expect(results).toHaveLength(1);
      expect(results[0].detail.count).toBe(2);
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      await page.evaluate(() => {
        document.body.addEventListener('fngr:doubletap', (e: Event) => {
          window.fngrResults.push({
            type: 'body-bubble',
            timestamp: performance.now(),
            detail: { count: (e as CustomEvent).detail.count },
          });
        });
      });

      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('tap + doubletap arbitration', () => {
    test('single click on multi-target fires tap after doubletap fails', async ({ page }) => {
      const box = await page.locator('#multi-target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400); // wait for doubletap to fail

      const results = await getResults(page);
      const taps = filterResults(results, 'multi:tap');
      const dtaps = filterResults(results, 'multi:doubletap');

      expect(taps).toHaveLength(1);
      expect(dtaps).toHaveLength(0);
    });

    test('double click on multi-target fires doubletap, not tap', async ({ page }) => {
      const box = await page.locator('#multi-target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      const taps = filterResults(results, 'multi:tap');
      const dtaps = filterResults(results, 'multi:doubletap');

      expect(dtaps).toHaveLength(1);
      expect(taps).toHaveLength(0);
    });

    test('single tap still works after a doubletap was recognized', async ({ page }) => {
      const box = await page.locator('#multi-target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // First: doubletap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400); // wait for all resets

      // Then: single tap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400); // wait for doubletap to fail

      const results = await getResults(page);
      const taps = filterResults(results, 'multi:tap');
      const dtaps = filterResults(results, 'multi:doubletap');

      expect(dtaps).toHaveLength(1);
      expect(taps).toHaveLength(1);
    });

    test('alternating single and double taps work correctly', async ({ page }) => {
      const box = await page.locator('#multi-target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // Single tap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400);

      // Double tap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400);

      // Single tap
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(400);

      const results = await getResults(page);
      const taps = filterResults(results, 'multi:tap');
      const dtaps = filterResults(results, 'multi:doubletap');

      expect(taps).toHaveLength(2);
      expect(dtaps).toHaveLength(1);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on doubletap target', async ({ page }) => {
      const touchAction = await page
        .locator('#target')
        .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(touchAction).toBe('none');
    });

    test('touch-action: none is set on all managed elements', async ({ page }) => {
      for (const selector of ['#target', '#multi-target', '#scroll-target']) {
        const touchAction = await page
          .locator(selector)
          .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
        expect(touchAction).toBe('none');
      }
    });
  });

  test.describe('interaction with scrollable containers', () => {
    test('doubletap inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      const cx = box!.x + 100;
      const cy = box!.y + 50;

      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy);

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'scroll-doubletap');
      expect(results).toHaveLength(1);
    });

    test('doubletap still works after scrolling the container', async ({ page }) => {
      await page.locator('#scroll-container').evaluate((el: HTMLElement) => {
        el.scrollTop = 100;
      });
      await page.waitForTimeout(50);

      const box = await page.locator('#scroll-target').boundingBox();
      if (box) {
        const cx = box.x + 100;
        const cy = box.y + 50;

        await page.mouse.click(cx, cy);
        await page.waitForTimeout(80);
        await page.mouse.click(cx, cy);

        await page.waitForTimeout(50);
        const results = filterResults(await getResults(page), 'scroll-doubletap');
        expect(results).toHaveLength(1);
      }
    });
  });

  test.describe('real drag rejection', () => {
    test('drag between clicks does not fire doubletap', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // First click
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);

      // Second "click" with drag during press
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 5; i++) {
        await page.mouse.move(cx + i * 10, cy);
        await page.waitForTimeout(10);
      }
      await page.mouse.up();

      await page.waitForTimeout(400);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(0);
    });

    test('very small jitter during second click still fires', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // First click
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(80);

      // Second click with tiny jitter
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 3, cy + 2); // 3.6px jitter < 10px threshold
      await page.mouse.up();

      await page.waitForTimeout(50);
      const results = filterResults(await getResults(page), 'doubletap');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('no recognizer zones', () => {
    test('click on element without recognizer does not fire events', async ({ page }) => {
      const box = await page.locator('#no-tap-zone').boundingBox();

      await page.mouse.click(box!.x + 140, box!.y + 50);
      await page.waitForTimeout(80);
      await page.mouse.click(box!.x + 140, box!.y + 50);

      await page.waitForTimeout(50);
      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });
});
