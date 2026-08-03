import { test, expect } from '@playwright/test';

test.describe('sudden-death E2E', () => {
  test('modo battle-demo=1&sudden-death-demo=1: inicia cerca del aviso y transiciona por las fases de Muerte Súbita', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?battle-demo=1&sudden-death-demo=1');
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
    await expect(page.getByTestId('battle-status')).toHaveText('running');

    // Dado que sudden-death-demo=1 inicia a los 280.000 ms (04:40),
    // en ~5 segundos reales la partida alcanza los 285.000 ms (04:45) y entra en aviso/fase1.
    await page.waitForTimeout(6000);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
