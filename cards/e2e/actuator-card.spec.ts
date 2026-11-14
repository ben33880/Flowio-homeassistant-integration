import { test, expect } from '@playwright/test';

test('carte équipements du bassin : durées par actionneur et sans interrupteur', async ({ page }) => {
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-actuator-card');
  const rows = card.locator('.row:not(.head)');
  await expect(rows).toHaveCount(6);
  await expect(card.locator('.count')).toContainText('1 actif(s) / 6');
  await expect(card.locator('ha-switch')).toHaveCount(0);
  const first = rows.first();
  await expect(first.locator('.name-button')).toHaveText('Filtration');
  await expect(first.locator('.c-time').nth(0)).toHaveText('00:19:44');
  await expect(first.locator('.c-time').nth(1)).toHaveText('00:19:44');
  await expect(first.locator('.c-time').nth(2)).toHaveText('00:19:44');
  await expect(first.locator('.c-time').nth(3)).toHaveText('324:32:48');
  await expect(card.locator('.row[data-entity=switch\\.fio_io_ph_pmp] .c-time[data-empty=true]')).toHaveCount(3);
  const activeIcon = await first.locator('.icon-plate').evaluate(el => getComputedStyle(el).color);
  expect(activeIcon).toBe('rgb(2, 136, 209)');
  const inactiveIcon = await rows.nth(1).locator('.icon-plate').evaluate(el => getComputedStyle(el).color);
  expect(inactiveIcon).toBe('rgb(96, 101, 109)');
  await expect(rows.nth(1).locator('.icon-plate')).toHaveAttribute('data-on', 'false');
  await expect(first.locator('.icon-plate')).toHaveAttribute('data-on', 'true');
});

test('carte équipements du bassin : clés de durée historiques tolérées', async ({ page }) => {
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-actuator-card');
  await expect(card.locator('.table')).toBeVisible();
  await page.evaluate(() => {
    const el = document.querySelector('flowio-actuator-card') as any;
    el.setConfig({ entity_prefix: 'fio', entities: ['switch.fio_io_flt_pmp'], runtime_keys: { day: 'runtime_day', week: 'runtime_week', month: 'runtime_month', total: 'runtime_total' } });
  });
  await expect(card.locator('.row:not(.head) .c-time').nth(3)).toHaveText('324:32:48');
});

test('carte équipements du bassin : remise à zéro par ligne et globale', async ({ page }) => {
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-actuator-card');
  await expect(card.locator('.table')).toBeVisible();
  await page.evaluate(() => {
    const el = document.querySelector('flowio-actuator-card') as any;
    (window as any).calls = [];
    el.hass = { ...el.hass, callService: async (domain: string, service: string, data: unknown) => { (window as any).calls.push({ domain, service, data }); } };
  });
  page.once('dialog', dialog => dialog.accept());
  await card.locator('.row[data-entity=switch\\.fio_io_flt_pmp] .c-actions ha-button').click();
  await expect.poll(() => page.evaluate(() => (window as any).calls.at(-1))).toEqual({ domain: 'button', service: 'press', data: { entity_id: 'button.fio_pd_reset_upt_flt' } });
  page.once('dialog', dialog => dialog.accept());
  await card.locator('ha-button.reset-all').click();
  await expect.poll(() => page.evaluate(() => (window as any).calls.at(-1))).toEqual({ domain: 'button', service: 'press', data: { entity_id: 'button.fio_pd_reset_upt_all' } });
});
