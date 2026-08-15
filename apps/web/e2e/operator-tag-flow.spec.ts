import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test('flujo postpartida unificado de firma de iniciales arcade del Operator Tag y transición automática a Ranking', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  // Mockear respuestas de la API para asegurar determinismo en E2E
  await page.route('**/api/matches', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-match-id',
          clientMatchId: 'mock-client-id',
          playerId: 'mock-player-id',
          playerName: 'RAU',
          score: 850,
          linesCleared: 8,
          durationMs: 5000,
          level: 2,
          mode: 'training',
          result: 'finished',
          opponentProfile: null,
          createdAt: new Date().toISOString(),
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  await page.route('**/api/ranking**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'mock-rank-1',
          rank: 1,
          playerId: 'mock-player-id',
          playerName: 'RAU',
          score: 850,
          linesCleared: 8,
          level: 2,
          durationMs: 5000,
          mode: 'training',
          createdAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await test.step('limpiar local storage y navegar a Entrenamiento libremente sin tag previa', async () => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await initializeAudioIfPrompted(page);
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await page.getByTestId('start-training-button').click();
    await expect(page.getByTestId('own-board-column')).toBeVisible();
  });

  await test.step('al provocar fin de partida abre ResultsModal con métricas e iniciales integradas en la misma pantalla', async () => {
    // Forzar fin de partida mediante hard drop continuo hasta top-out
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(70);
      if (await page.getByTestId('results-modal').isVisible()) break;
    }

    await expect(page.getByTestId('results-modal')).toBeVisible();
    await expect(page.getByTestId('results-title')).toHaveText('ENTRENAMIENTO FINALIZADO');
    await expect(page.getByTestId('operator-signature-block')).toBeVisible();
    await expect(page.getByTestId('operator-tag-modal')).not.toBeVisible();
  });

  await test.step('regresión del bug de teclado: una pulsación R llena exactamente una celda [R] [_] [_]', async () => {
    await page.keyboard.press('r');
    await expect(page.getByTestId('tag-cell-char-0')).toHaveText('R');
    await expect(page.getByTestId('tag-cell-char-1')).toHaveText('_');
    await expect(page.getByTestId('tag-cell-char-2')).toHaveText('_');

    await page.keyboard.press('a');
    await expect(page.getByTestId('tag-cell-char-1')).toHaveText('A');

    await page.keyboard.press('u');
    await expect(page.getByTestId('tag-cell-char-2')).toHaveText('U');
  });

  await test.step('confirmar el resultado transiciona automáticamente a la pantalla de Ranking', async () => {
    await page.getByTestId('confirm-save-button').click();

    await expect(page.getByTestId('results-modal')).not.toBeVisible();
    await expect(page.getByTestId('ranking-screen')).toBeVisible();
    await expect(page.getByTestId('ranking-title')).toHaveText('CLASIFICACIÓN DE OPERADORES');
  });

  expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
});
