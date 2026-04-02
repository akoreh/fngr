import { test, expect } from '@playwright/test';

/**
 * LongPress E2E tests — focused on browser-specific behavior that unit tests cannot cover:
 * - Real hold timing with actual clock
 * - CustomEvent bubbling through real DOM trees
 * - Coordinate accuracy with real layout
 * - Movement rejection with real mouse drag during hold
 * - Scrollable container interaction
 * - touch-action CSS enforcement
 * - longpressup event on pointer release
 * - Short vs long duration configurations
 */

test.describe('LongPress E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/longpress.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.fngrClear === 'function');
    await page.evaluate(() => window.fngrClear());
  });

  function getResults(page: any) {
    return page.evaluate(() => window.fngrResults);
  }

  function filterResults(results: any[], type: string) {
    return results.filter((r: any) => r.type === type);
  }

  test.describe('basic long-press detection', () => {
    test('hold fires longpress after default duration', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600); // > 500ms default
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(1);
      expect(results[0].detail.duration).toBeGreaterThanOrEqual(400); // timing tolerance
    });

    test('early release does not fire longpress', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(200); // < 500ms
      await page.mouse.up();

      await page.waitForTimeout(500); // wait past duration
      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(0);
    });

    test('click (immediate press+release) does not fire', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 140);

      await page.waitForTimeout(600);
      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(0);
    });

    test('two separate long-presses both fire', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      // First long-press
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();
      await page.waitForTimeout(100);

      // Second long-press
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(2);
    });
  });

  test.describe('longpressup', () => {
    test('fires longpressup on release after longpress', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpressup');
      expect(results).toHaveLength(1);
      expect(results[0].detail.duration).toBeGreaterThanOrEqual(400);
    });

    test('longpressup does not fire on early release', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await page.mouse.up();

      await page.waitForTimeout(500);
      const results = filterResults(await getResults(page), 'longpressup');
      expect(results).toHaveLength(0);
    });

    test('longpress fires before longpressup', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const all = await getResults(page);
      const lp = all.filter((r: any) => r.type === 'longpress');
      const lpUp = all.filter((r: any) => r.type === 'longpressup');

      expect(lp).toHaveLength(1);
      expect(lpUp).toHaveLength(1);
      expect(lp[0].timestamp).toBeLessThan(lpUp[0].timestamp);
    });
  });

  test.describe('duration configuration', () => {
    test('short duration target fires after 200ms', async ({ page }) => {
      const box = await page.locator('#short-duration-target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(300); // > 200ms configured duration
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'short-longpress');
      expect(results).toHaveLength(1);
    });

    test('short duration target does not fire on quick click', async ({ page }) => {
      const box = await page.locator('#short-duration-target').boundingBox();
      await page.mouse.click(box!.x + 140, box!.y + 140);

      await page.waitForTimeout(300);
      const results = filterResults(await getResults(page), 'short-longpress');
      expect(results).toHaveLength(0);
    });
  });

  test.describe('movement rejection', () => {
    test('drag during hold cancels longpress', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(100);
      // Large drag — exceeds threshold
      for (let i = 1; i <= 5; i++) {
        await page.mouse.move(cx + i * 10, cy);
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(500);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(0);
    });

    test('tiny jitter during hold does not cancel', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(100);
      // Tiny jitter within threshold
      await page.mouse.move(cx + 3, cy + 2);
      await page.waitForTimeout(500);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(1);
    });

    test('movement after longpress recognized does not affect longpressup', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);

      // Move after recognized
      await page.mouse.move(cx + 50, cy + 50);
      await page.waitForTimeout(50);
      await page.mouse.up();

      const lp = filterResults(await getResults(page), 'longpress');
      const lpUp = filterResults(await getResults(page), 'longpressup');
      expect(lp).toHaveLength(1);
      expect(lpUp).toHaveLength(1);
    });
  });

  test.describe('coordinate accuracy', () => {
    test('longpress reports position at time of recognition', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = Math.round(box!.x + 100);
      const cy = Math.round(box!.y + 80);

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpress');
      expect(results).toHaveLength(1);
      expect(results[0].detail.clientX).toBeCloseTo(cx, 0);
      expect(results[0].detail.clientY).toBeCloseTo(cy, 0);
    });

    test('longpressup reports position at time of release', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = Math.round(box!.x + 100);
      const cy = Math.round(box!.y + 80);
      const releaseCx = cx + 3; // small drift during hold

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.move(releaseCx, cy);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'longpressup');
      expect(results).toHaveLength(1);
      expect(results[0].detail.clientX).toBeCloseTo(releaseCx, 0);
    });
  });

  test.describe('CustomEvent DOM bubbling', () => {
    test('CustomEvent fngr:longpress bubbles from target', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'fngr:longpress');
      expect(results).toHaveLength(1);
    });

    test('CustomEvent fngr:longpressup bubbles on release', async ({ page }) => {
      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'fngr:longpressup');
      expect(results).toHaveLength(1);
    });

    test('CustomEvent bubbles up to ancestor listeners', async ({ page }) => {
      await page.evaluate(() => {
        document.body.addEventListener('fngr:longpress', (e: Event) => {
          window.fngrResults.push({
            type: 'body-bubble',
            timestamp: performance.now(),
            detail: { duration: Math.round((e as CustomEvent).detail.duration) },
          });
        });
      });

      const box = await page.locator('#target').boundingBox();
      const cx = box!.x + 140;
      const cy = box!.y + 140;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'body-bubble');
      expect(results).toHaveLength(1);
    });
  });

  test.describe('touch-action CSS', () => {
    test('Manager sets touch-action: none on longpress target', async ({ page }) => {
      const touchAction = await page
        .locator('#target')
        .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
      expect(touchAction).toBe('none');
    });

    test('touch-action: none is set on all managed elements', async ({ page }) => {
      for (const selector of ['#target', '#short-duration-target', '#scroll-target']) {
        const touchAction = await page
          .locator(selector)
          .evaluate((el: HTMLElement) => getComputedStyle(el).touchAction);
        expect(touchAction).toBe('none');
      }
    });
  });

  test.describe('interaction with scrollable containers', () => {
    test('longpress inside scrollable container fires', async ({ page }) => {
      const box = await page.locator('#scroll-target').boundingBox();
      const cx = box!.x + 100;
      const cy = box!.y + 50;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = filterResults(await getResults(page), 'scroll-longpress');
      expect(results).toHaveLength(1);
    });

    test('longpress works after scrolling the container', async ({ page }) => {
      await page.locator('#scroll-container').evaluate((el: HTMLElement) => {
        el.scrollTop = 100;
      });
      await page.waitForTimeout(50);

      const box = await page.locator('#scroll-target').boundingBox();
      if (box) {
        const cx = box.x + 100;
        const cy = box.y + 50;

        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.waitForTimeout(600);
        await page.mouse.up();

        const results = filterResults(await getResults(page), 'scroll-longpress');
        expect(results).toHaveLength(1);
      }
    });
  });

  test.describe('no recognizer zones', () => {
    test('hold on element without recognizer does not fire events', async ({ page }) => {
      const box = await page.locator('#no-tap-zone').boundingBox();

      await page.mouse.move(box!.x + 140, box!.y + 50);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();

      const results = await getResults(page);
      expect(results).toHaveLength(0);
    });
  });
});
