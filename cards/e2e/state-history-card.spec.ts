import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

test('carte historique des états : frise 24 h, marqueur horaire et couleurs', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-state-history-card');
  await expect(card.locator('h3.title')).toHaveText('Historique');
  await expect(card.locator('.day-badge')).toHaveCount(0);
  await expect(card.locator('ha-card .card-head')).toHaveCount(0);
  await expect(card.locator('.board')).toBeVisible();
  await expect(card.locator('.row-name')).toHaveCount(5);
  await expect(card.locator('.track')).toHaveCount(5);
  expect(await card.locator('.track .seg').count()).toBeGreaterThan(0);
  await expect(card.locator('.now-line')).toHaveCount(1);
  await expect(card.locator('.now-dot')).toHaveCount(0);
  await expect(card.locator('.now-label')).toHaveText(/^\d{2}:\d{2}$/);
  const ticks = card.locator('.axis > span:not(.now-label)');
  await expect(ticks).toHaveCount(9);
  await expect(ticks).toHaveText(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00']);
  await expect(card.locator('.row-icon[data-on=true]')).toHaveCount(2);
  const activeColor = await card.locator('.row-icon[data-on=true]').first().evaluate(el => getComputedStyle(el).color);
  expect(activeColor).toBe('rgb(255, 160, 0)');
  const trackColor = await card.locator('.track').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(trackColor).toBe('rgb(243, 245, 247)');
  const segColor = await card.locator('.track .seg').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(segColor).toBe('rgb(255, 160, 0)');
  const lineColor = await card.locator('.now-line').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(lineColor).toBe('rgb(2, 136, 209)');
  const labelColor = await card.locator('.now-label').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(labelColor).toBe('rgb(2, 136, 209)');
  const titleColor = await card.locator('h3.title').evaluate(el => getComputedStyle(el).color);
  expect(titleColor).toBe('rgb(32, 33, 36)');
});

test('carte historique des états : ordre et texte retiré devant les noms', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-state-history-card');
  await expect(card.locator('.board')).toBeVisible();
  await page.evaluate(() => {
    const el = document.querySelector('flowio-state-history-card') as any;
    el.setConfig({ entity_prefix: 'fio', name_prefix: 'Flow.io Waveshare ', entities: ['switch.fio_io_lights', 'switch.fio_io_flt_pmp'] });
  });
  await expect(card.locator('.row-name')).toHaveCount(2);
  await expect(card.locator('.row-name').nth(0)).toHaveText('Éclairage');
  await expect(card.locator('.row-name').nth(1)).toHaveText('Filtration');
});

test('carte historique des états : nom et couleur d’activation par entité', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-state-history-card');
  await expect(card.locator('.board')).toBeVisible();
  await page.evaluate(() => {
    const el = document.querySelector('flowio-state-history-card') as any;
    el.setConfig({ entity_prefix: 'fio', entities: ['switch.fio_io_flt_pmp', 'switch.fio_io_lights'], items: { 'switch.fio_io_lights': { name: 'Éclairage jardin', color: '#ff00aa' } } });
  });
  await expect(card.locator('.row-name')).toHaveCount(2);
  await expect(card.locator('.row-name').nth(0)).toHaveText('Filtration');
  await expect(card.locator('.row-name').nth(1)).toHaveText('Éclairage jardin');
  const seg = await card.locator('.track').nth(1).locator('.seg').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(seg).toBe('rgb(255, 0, 170)');
  const icon = await card.locator('.row-icon').nth(1).evaluate(el => getComputedStyle(el).color);
  expect(icon).toBe('rgb(255, 0, 170)');
});
