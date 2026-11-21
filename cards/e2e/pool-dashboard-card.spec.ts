import { expect, test } from '@playwright/test';

async function mount(page: import('@playwright/test').Page) {
  await page.goto('/demo/');
  await expect(page.locator('flowio-pool-card h2')).toBeVisible();
  await page.evaluate(() => {
    const demo = (window as any).demo;
    const card = document.createElement('flowio-pool-dashboard-card') as any;
    card.setConfig({ ...demo.config, type: 'custom:flowio-pool-dashboard-card' });
    card.hass = demo.card.hass;
    document.querySelector('main')!.append(card);
    (window as any).dashboardCard = card;
  });
  await expect(page.locator('flowio-pool-dashboard-card .dashboard-columns')).toBeVisible();
}

test('tableau de bord moderne : même contenu dans trois colonnes', async ({ page }) => {
  await mount(page);
  const card = page.locator('flowio-pool-dashboard-card');
  await expect(card.locator('.quality-panel [data-role=ph]')).toBeVisible();
  await expect(card.locator('.quality-panel [data-role=orp]')).toBeVisible();
  await expect(card.locator('.quality-panel [data-role=pressure]')).toBeVisible();
  await expect(card.locator('.dashboard-equipment [data-equipment]')).toHaveCount(5);
  await expect(card.locator('.treatment-panel [data-role$=_tank_percent]')).toHaveCount(2);
  await expect(card.locator('.modes-strip flowio-modes')).toBeVisible();
  await expect(card.locator('.timing-panel flowio-timing')).toBeVisible();
  await expect(card.locator('[data-tank-action=ph]')).toBeVisible();
  await expect(card.locator('[data-tank-action=disinfection]')).toBeVisible();
  await expect(card.locator('[data-injection=ph_injected]')).toBeVisible();
  await expect(card.locator('[data-injection=disinfection_injected]')).toBeVisible();
});

test('tableau de bord moderne : commande et éditeur gardent le même contrat', async ({ page }) => {
  await mount(page);
  const card = page.locator('flowio-pool-dashboard-card');
  page.once('dialog', dialog => dialog.accept());
  await card.getByRole('switch', { name: 'Démarrer Pompe pH' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).demo.calls.at(-1))).toEqual({
    domain: 'switch',
    service: 'turn_on',
    data: { entity_id: 'switch.fio_io_ph_pmp' }
  });
  const result = await page.locator('flowio-pool-dashboard-card').evaluate(async card => {
    const element = card as any;
    const constructor = element.constructor as typeof HTMLElement & {
      getConfigElement(): HTMLElement & { setConfig(value: unknown): void };
    };
    const editor = constructor.getConfigElement() as HTMLElement & {
      hass?: unknown;
      setConfig(value: unknown): void;
    };
    const { tank_slots: _tanks, runtime_slots: _runtime, ...editable } = element.config;
    editor.setConfig({ ...editable, type: 'custom:flowio-pool-dashboard-card' });
    editor.hass = element.hass;
    document.body.append(editor);
    await (editor as any).updateComplete;
    const form = (editor as any).shadowRoot.querySelector('ha-form');
    let config: any;
    editor.addEventListener('config-changed', (event: CustomEvent) => {
      config = event.detail.config;
    });
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { ...editable, type: 'custom:flowio-pool-dashboard-card' } },
      bubbles: true,
      composed: true
    }));
    editor.remove();
    return {
      type: config.type,
      hasSlots: 'tank_slots' in config || 'runtime_slots' in config
    };
  });
  expect(result).toEqual({ type: 'custom:flowio-pool-dashboard-card', hasSlots: false });
});
