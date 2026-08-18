import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test.describe('sudden-death E2E', () => {
  test('modo battle-demo=1&sudden-death-demo=1: inicia cerca del aviso y transiciona por las fases de Muerte Súbita', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?battle-demo=1&sudden-death-demo=1&debug-panel=1');
    await initializeAudioIfPrompted(page);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
    await expect(page.getByTestId('battle-status')).toHaveText('running');

    // 1. A los 293.000 ms (04:53), la fase arranca en 'inactive'
    await expect(page.getByTestId('sudden-death-phase')).toHaveText('inactive');

    // 2. A los ~2 segundos reales (295.000 ms / 04:55), entra en estado 'warning'
    await expect(page.getByTestId('sudden-death-phase')).toHaveText('warning', { timeout: 6000 });

    // 3. A los ~5 segundos adicionales (300.000 ms / 05:00), entra en estado 'phase1'
    await expect(page.getByTestId('sudden-death-phase')).toHaveText('phase1', { timeout: 12000 });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('navegación desde DEV Demo Launcher (/dev-tools) conduce al escenario Muerte Súbita jugable', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/dev-tools');
    await initializeAudioIfPrompted(page);

    await expect(page.getByTestId('dev-demo-launcher')).toBeVisible();
    await page.getByTestId('launch-sudden-death-2p').click();

    await expect(page).toHaveURL(/\/battle\?battle-demo=1&sudden-death-demo=1/);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
    await expect(page.getByTestId('session-status')).toHaveText('running');
  });

  test('pulsar botón Menú desde una demo DEV redirige limpiamente a / sin query params', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/battle?battle-demo=1&sudden-death-demo=1');
    await initializeAudioIfPrompted(page);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();

    await page.getByTestId('exit-to-menu-button').click();

    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await expect(page.locator('[data-testid="game-canvas"] canvas')).not.toBeVisible();
  });
});
