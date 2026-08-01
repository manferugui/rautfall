import { test, expect } from '@playwright/test';

test('modo battle-demo=1: integracion visual del segundo tablero real', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await test.step('carga del modo battle-demo=1 y verificacion del monitor real de P2', async () => {
    await page.goto('/?battle-demo=1');
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();

    // En modo batalla real, el badge SIMULADO desaparece y aparece el badge real (Lvl 1)
    await expect(page.getByTestId('simulated-badge')).not.toBeVisible();
    await expect(page.getByTestId('real-badge')).toBeVisible();
    await expect(page.getByTestId('real-badge')).toHaveText('Lvl 1');

    // Las celdas reales del tablero de P2 deben estar presentes en OpponentMonitor
    const opponentCells = page.getByTestId('opponent-cell');
    await expect(opponentCells.first()).toBeVisible();

    // El panel de depuracion DEV de batalla debe estar activo
    await expect(page.getByTestId('battle-demo-dev-panel')).toBeVisible();
    await expect(page.getByTestId('battle-status')).toHaveText('running');
  });

  await test.step('pausa y reanudacion coordinadas con congelamiento visual', async () => {
    await page.getByTestId('pause-toggle').click();

    await expect(page.getByTestId('session-status')).toHaveText('paused');
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    await expect(page.getByTestId('opponent-pause-overlay')).toBeVisible();
    await expect(page.getByTestId('opponent-pause-overlay')).toHaveText('PAUSA');

    await page.getByTestId('pause-toggle').click();

    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('pause-overlay')).not.toBeVisible();
    await expect(page.getByTestId('opponent-pause-overlay')).not.toBeVisible();
  });

  await test.step('reinicio mediante el boton real y retorno a step 0', async () => {
    await expect(page.getByTestId('session-step')).not.toHaveText('0');

    await page.getByTestId('reset-button').click();

    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('battle-status')).toHaveText('running');
    await expect
      .poll(async () => Number(await page.getByTestId('session-step').textContent()))
      .toBeLessThan(10);
  });

  expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(pageErrors, `Excepciones de pagina detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
});
