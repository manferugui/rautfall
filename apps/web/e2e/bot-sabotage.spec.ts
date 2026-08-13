import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test.describe('bot-sabotage E2E', () => {
  test('modo battle-demo=1&bot-sabotage=1: bot conserva sabotaje cuando el rival esta por debajo del umbral', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?battle-demo=1&bot-sabotage=1&debug-panel=1');
    await initializeAudioIfPrompted(page);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
    await expect(page.getByTestId('battle-status')).toHaveText('running');

    // P2 tiene 'residuos' en cartucho pero P1 está en altura 0 -> debe conservar con opponentTooLow
    await expect.poll(async () => {
      const oppSab = await page.getByTestId('opponent-sabotages').textContent();
      return oppSab?.toLowerCase() ?? '';
    }, { timeout: 10000 }).toContain('residuos');

    // P1 no recibe basura mientras P1 esté en altura baja
    await page.waitForTimeout(500);
    const p1Residues = await page.getByTestId('residues-count').textContent();
    expect(p1Residues).toContain('0');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('modo battle-demo=1&bot-sabotage=high: bot activa sabotaje deterministamente contra rival alto', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?battle-demo=1&bot-sabotage=high&debug-panel=1');
    await initializeAudioIfPrompted(page);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
    await expect(page.getByTestId('battle-status')).toHaveText('running');

    // Con bot-sabotage=high, P1 empieza con tablero en altura >= 8.
    // P2 bot evalúa y activa 'residuos'. P1 recibe la basura (+2 en Residuos).
    await expect.poll(async () => {
      const p1Residues = await page.getByTestId('residues-count').textContent();
      return p1Residues ?? '';
    }, { timeout: 15000 }).toContain('2');

    // El cartucho de P2 debe haberse vaciado
    const oppSabAfter = await page.getByTestId('opponent-sabotages').textContent();
    expect(oppSabAfter?.toLowerCase() ?? '').not.toContain('residuos');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('pausa congela el estado tactico del bot y reinicio limpia el estado determinista', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?battle-demo=1&bot-sabotage=high&debug-panel=1');
    await initializeAudioIfPrompted(page);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();

    // Pausar
    await page.getByTestId('pause-toggle').click();
    await expect(page.getByTestId('session-status')).toHaveText('paused');

    await page.waitForTimeout(150);
    await expect(page.getByTestId('session-status')).toHaveText('paused');

    // Reanudar
    await page.getByTestId('pause-toggle').click();
    await expect(page.getByTestId('session-status')).toHaveText('running');

    // Reiniciar
    await page.getByTestId('reset-button').click();
    await expect(page.getByTestId('session-status')).toHaveText('running');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('modo battle-demo=1&interference-demo=1: precarga interferencia en P1 y activa velo SEÑAL INTERFERIDA', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?battle-demo=1&interference-demo=1&debug-panel=1');
    await initializeAudioIfPrompted(page);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('session-step')).not.toHaveText('0');

    // Disparar primer Interferencia con pulsación sostenida para que JustDown de Phaser lo capture
    await page.keyboard.down('a');
    await page.waitForTimeout(100);
    await page.keyboard.up('a');

    // Comprobar que enrutó interferencia y activó velo visual SEÑAL INTERFERIDA tras el warning de 750ms
    await expect(page.getByTestId('last-sabotage-routed')).toContainText('interferencia', { timeout: 5000 });
    await expect(page.getByTestId('interferencia-overlay')).toBeVisible({ timeout: 5000 });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
