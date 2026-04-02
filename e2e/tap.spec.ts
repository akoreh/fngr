import { test, expect } from '@playwright/test';

/**
 * Tap E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real pointer event dispatch ordering and timing
 * - CustomEvent bubbling through real DOM trees
 * - touch-action CSS interaction
 * - Pointer events on nested/overlapping elements
 * - Interaction with scrollable containers
 * - Coordinate accuracy with real layout
 * - Real clock timing (no fake timers)
 */

test.describe('Tap E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tap.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: any) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('real pointer event dispatch', () => {
    test('mouse click produces correct pointer event sequence (down→up)', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 140);

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(1);
      expect(results[0].detail.count).toBe(1);
    });

    test('rapid clicks at real-world speed all register', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // Simulate real user rapid-clicking (~100ms apart)
      for (let i = 0; i < 5; i++) {
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(100);
      }

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(5);
    });

    test('slow separate down/up with real delay still fires within interval', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();

      await page.mouse.move(box!.x + 140, box!.y + 140);
      await page.mouse.down();
      await page.waitForTimeout(200); // 200ms < 250ms default interval
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(1);
    });

    test('hold beyond interval with real clock does not fire', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();

      await page.mouse.move(box!.x + 140, box!.y + 140);
      await page.mouse.down();
      await page.waitForTimeout(300); // 300ms > 250ms default interval
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(0);
    });
  });

  test.describe('coordinate accuracy', () => {
    test('reported coordinates match actual click position', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const clickX = Math.round(box!.x + 100);
      const clickY = Math.round(box!.y + 80);

      await page.mouse.click(clickX, clickY);

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(1);
      // Allow 1px tolerance for subpixel rounding
      expect(results[0].detail.clientX).toBeCloseTo(clickX, 0);
      expect(results[0].detail.clientY).toBeCloseTo(clickY, 0);
    });

    test('tap at different positions reports different coordinates', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();

      await page.mouse.click(box!.x + 50, box!.y + 50);
      await page.waitForTimeout(50);
      await page.mouse.click(box!.x + 200, box!.y + 200);

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(2);
      expect(results[0].detail.clientX).not.toEqual(results[1].detail.clientX);
      expect(results[0].detail.clientY).not.toEqual(results[1].detail.clientY);
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('CustomEvent bubbles from target through DOM', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 140);

      const results = filterResults(await getResults(page), 'fngr:tap');
      expect(results).toHaveLength(1);
      expect(results[0].detail.count).toBe(1);
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      // Listen for fngr:tap on document.body (ancestor of #target)
      await page.evaluate(() => {
        document.body.addEventListener('fngr:tap', (e: Event) => {
          window.fngrResults.push({
            type: 'body-bubble',
            timestamp: performance.now(),
            detail: { count: (e as CustomEvent).detail.count },
          });
        });
      });

      const box = await page.locator('#target').boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 140);

      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });

    test('CustomEvent from nested target bubbles up to body', async ({ page }) => {
      // Listen on body for bubbled events from #nested-target
      await page.evaluate(() => {
        document.body.addEventListener('fngr:tap', (e: Event) => {
          const target = (e as CustomEvent).detail.target as HTMLElement;
          if (target?.id === 'nested-target') {
            window.fngrResults.push({
              type: 'nested-body-bubble',
              timestamp: performance.now(),
              detail: { count: (e as CustomEvent).detail.count },
            });
          }
        });
      });

      // Click on the inner child — recognizer is on parent
      const inner = page.locator('#nested-target .inner');
      const box = await inner.boundingBox();
      await page.mouse.click(box!.x + 70, box!.y + 70);

      const results = await getResults(page);

      // Recognizer fires on parent
      const nestedTaps = filterResults(results, 'nested-tap');
      expect(nestedTaps).toHaveLength(1);

      // CustomEvent bubbles from parent up to body
      const bubbled = filterResults(results, 'nested-body-bubble');
      expect(bubbled).toHaveLength(1);
    });
  });

  test.describe('nested elements and event targeting', () => {
    test('clicking inner child still triggers parent recognizer', async ({ page }) => {
      const inner = page.locator('#nested-target .inner');
      const box = await inner.boundingBox();
      await page.mouse.click(box!.x + 30, box!.y + 30);

      const results = filterResults(await getResults(page), 'nested-tap');
      expect(results).toHaveLength(1);
    });

    test('clicking parent outside inner child also triggers', async ({ page }) => {
      const parent = page.locator('#nested-target');
      const parentBox = await parent.boundingBox();

      // Click in the corner of parent (outside inner child)
      await page.mouse.click(parentBox!.x + 20, parentBox!.y + 20);

      const results = filterResults(await getResults(page), 'nested-tap');
      expect(results).toHaveLength(1);
    });

    test('click on element without recognizer does not fire events', async ({ page }) => {
      const noTap = page.locator('#no-tap-zone');
      const box = await noTap.boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 50);

      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on target element', async ({ page }) => {
      const touchAction = await page
        .locator('#target')
        .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(touchAction).toBe('none');
    });

    test('touch-action: none is set on all managed elements', async ({ page }) => {
      for (const selector of ['#target', '#nested-target', '#scroll-target']) {
        const touchAction = await page
          .locator(selector)
          .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
        expect(touchAction).toBe('none');
      }
    });
  });

  test.describe('interaction with scrollable containers', () => {
    test('tap inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      await page.mouse.click(box!.x + 100, box!.y + 50);

      const results = filterResults(await getResults(page), 'scroll-tap');
      expect(results).toHaveLength(1);
    });

    test('tap still works after scrolling the container', async ({ page }) => {
      // Scroll the container down
      await page.locator('#scroll-container').evaluate((el: HTMLElement) => {
        el.scrollTop = 100;
      });
      await page.waitForTimeout(50);

      const box = await page.locator('#scroll-target').boundingBox();
      if (box) {
        await page.mouse.click(box.x + 100, box.y + 50);

        const results = filterResults(await getResults(page), 'scroll-tap');
        expect(results).toHaveLength(1);
      }
    });
  });

  test.describe('real drag rejection', () => {
    test('slow drag with real mouse movement does not fire', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();

      // Realistic slow drag — mouse events at browser pace
      await page.mouse.move(box!.x + 50, box!.y + 140);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(box!.x + 50 + i * 20, box!.y + 140);
        await page.waitForTimeout(20);
      }
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(0);
    });

    test('very small jitter during click still fires', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();

      // Tiny movement (< 10px threshold) during press
      await page.mouse.move(box!.x + 140, box!.y + 140);
      await page.mouse.down();
      await page.mouse.move(box!.x + 143, box!.y + 141); // 3px jitter
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'tap');
      expect(results).toHaveLength(1);
    });
  });
});
