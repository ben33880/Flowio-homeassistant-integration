import { test, expect } from '@playwright/test';

test('carte gestion des alarmes : détail, condition, latch et acquittement', async ({ page }) => {
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-alarm-detail-card');
  const rows = card.locator('.row:not(.head)');
  await expect(rows).toHaveCount(7);
  await expect(card.locator('.count')).toContainText('7 alarmes · 0 à acquitter');
  await expect(rows.first().locator('.name-button')).toHaveText('Low pressure');
  await expect(rows.nth(3).locator('.name-button')).toHaveText('Chlorine tank low');
  await expect(rows.first().locator('.pill[data-tone=inactive]')).toHaveText('Inactive');
  await expect(rows.first().locator('.c-action ha-button.ack')).toHaveCount(1);
  await expect(rows.nth(2).locator('.c-action ha-button.ack')).toHaveCount(0);
  await expect(rows.nth(2).locator('.c-action')).toBeEmpty();
  await expect(card.locator('.c-latch')).toHaveCount(0);
  await expect(card.locator('ha-switch')).toHaveCount(0);
});

test('carte gestion des alarmes : acquittement d’une alarme active', async ({ page }) => {
  await page.goto('/demo/cards.html');
  const card = page.locator('flowio-alarm-detail-card');
  await expect(card.locator('.table')).toBeVisible();
  await page.evaluate(() => {
    const el = document.querySelector('flowio-alarm-detail-card') as any;
    (window as any).calls = [];
    const states = { ...el.hass.states };
    states['binary_sensor.fio_alm_1_active'] = { state: 'on', attributes: { friendly_name: 'Low pressure', latch: true, triggered_at: '2026-10-29T18:42:00Z' } };
    el.hass = { ...el.hass, states, callService: async (domain: string, service: string, data: unknown) => { (window as any).calls.push({ domain, service, data }); } };
  });
  await expect(card.locator('.count')).toContainText('1 à acquitter');
  await expect(card.locator('.row[data-alarm="1"] .pill[data-tone=active]')).toHaveText('Active');
  page.once('dialog', dialog => dialog.accept());
  await card.locator('.row[data-alarm="1"] .c-action ha-button.ack').click();
  await expect.poll(() => page.evaluate(() => (window as any).calls.at(-1))).toEqual({ domain: 'button', service: 'press', data: { entity_id: 'button.fio_alm_1_reset' } });
});
