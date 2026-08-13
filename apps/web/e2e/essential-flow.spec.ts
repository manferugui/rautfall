import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test('flujo esencial de principio a fin', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await test.step('carga de la aplicación y navegación al Modo Entrenamiento', async () => {
    await page.goto('/');
    await initializeAudioIfPrompted(page);
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await page.getByTestId('start-training-button').click();
    const canvas = page.locator('[data-testid="game-canvas"] canvas');
    await expect(canvas).toBeVisible();
  });

  await test.step('estado inicial running, próximas piezas, reserva, paneles y puntuación', async () => {
    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('held-piece-preview')).toBeVisible();
    // El rediseño industrial (Tarea 0031) sustituyó <ol>/<li> por divs
    // (`.preview-slot-recessed`), ya no expone role="listitem".
    const nextPiecesItems = page.getByTestId('next-pieces-preview').locator('.preview-slot-recessed');
    await expect(nextPiecesItems).toHaveCount(3);
    await expect(page.getByTestId('opponent-column')).toContainText('SIN OPONENTE');
    await expect(page.getByTestId('score-value')).toHaveText('0');
    await expect(page.getByTestId('combo-value')).toBeVisible();
  });

  await test.step('pausa mediante el botón real', async () => {
    await page.getByTestId('pause-toggle').click();
    await expect(page.getByTestId('session-status')).toHaveText('paused');
    const shutter = page.getByTestId('pause-shutter');
    await expect(shutter).toBeVisible();
    await expect(shutter).toHaveClass(/rf-pause-shutter--sealed/);
    await expect(shutter).toContainText('PAUSED');
  });

  await test.step('reanudación mediante el mismo botón', async () => {
    await page.getByTestId('pause-toggle').click();
    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('pause-shutter')).not.toHaveClass(/rf-pause-shutter--sealed/);
  });

  await test.step('reinicio mediante el botón real, verificado de forma robusta', async () => {
    // Esperar, mediante una condición observable (no un sleep), a que el contador
    // lógico avance por encima de 0 antes de capturar el valor de referencia.
    await expect(page.getByTestId('session-step')).not.toHaveText('0');
    const stepBeforeReset = await page.getByTestId('session-step').textContent();

    await page.getByTestId('reset-button').click();

    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('pause-shutter')).not.toHaveClass(/rf-pause-shutter--sealed/);
    await expect
      .poll(async () => Number(await page.getByTestId('session-step').textContent()))
      .toBeLessThan(Number(stepBeforeReset));
    await expect(page.getByTestId('next-pieces-preview').locator('.preview-slot-recessed')).toHaveCount(3);
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
  });

  expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
});
