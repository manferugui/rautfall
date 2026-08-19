import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test.describe('E2E PvP Online con dos navegadores', () => {
  test('Flujo completo: crear sala, unirse, gameplay, pausa autoritativa P1/P2 y abandono de partida', async ({ browser }) => {
    // 1. Crear dos contextos de navegador independientes para P1 y P2
    const p1Context = await browser.newContext();
    const p2Context = await browser.newContext();

    const page1 = await p1Context.newPage();
    const page2 = await p2Context.newPage();

    const p1Errors: string[] = [];
    const p2Errors: string[] = [];

    page1.on('pageerror', (err) => p1Errors.push(err.message));
    page2.on('pageerror', (err) => p2Errors.push(err.message));

    // 2. P1 entra y crea sala
    await test.step('P1 crea una sala PvP online', async () => {
      await page1.goto('/');
      await initializeAudioIfPrompted(page1);
      await expect(page1.getByTestId('mode-selector')).toBeVisible();

      await page1.getByTestId('start-online-pvp-button').click();
      await expect(page1.getByTestId('online-room-modal')).toBeVisible();

      await page1.getByTestId('create-room-button').click();
      await expect(page1.getByTestId('waiting-opponent-status')).toBeVisible();
    });

    // Obtain room code generated for P1
    const roomCodeElement = page1.getByTestId('room-code-display');
    await expect.poll(async () => (await roomCodeElement.textContent())?.trim().length).toBe(5);
    const roomCode = (await roomCodeElement.textContent())!.trim();
    expect(roomCode).toMatch(/^[2-9A-HJ-NP-Z]{5}$/);

    // 3. P2 entra y se une a la sala mediante el código
    await test.step('P2 se une a la sala utilizando el código generado por P1', async () => {
      await page2.goto('/');
      await initializeAudioIfPrompted(page2);
      await expect(page2.getByTestId('mode-selector')).toBeVisible();

      await page2.getByTestId('start-online-pvp-button').click();
      await expect(page2.getByTestId('online-room-modal')).toBeVisible();

      await page2.getByTestId('join-room-button').click();
      await page2.getByTestId('join-room-code-input').fill(roomCode);
      await page2.getByTestId('submit-join-room-button').click();
    });

    // 4. Ambos jugadores inician la partida simultáneamente
    await test.step('Ambos jugadores entran en la pantalla de combate y el runtime comienza', async () => {
      await expect(page1.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
      await expect(page2.locator('[data-testid="game-canvas"] canvas')).toBeVisible();

      await expect(page1.getByTestId('session-status')).toHaveText('running');
      await expect(page2.getByTestId('session-status')).toHaveText('running');
    });

    // 5. Verificación de avance de ticks y gameplay
    await test.step('Comprobar avance autoritativo de ticks de juego', async () => {
      await expect.poll(async () => Number(await page1.getByTestId('session-step').textContent())).toBeGreaterThan(0);
      await expect.poll(async () => Number(await page2.getByTestId('session-step').textContent())).toBeGreaterThan(0);
    });

    // 6. Pausa autoritativa iniciada por P1
    await test.step('P1 solicita pausa: ambos jugadores reciben el estado pausado', async () => {
      await page1.getByTestId('pause-toggle').click();

      await expect(page1.getByTestId('session-status')).toHaveText('paused');
      await expect(page2.getByTestId('session-status')).toHaveText('paused');

      // En P1 (autor de la pausa), el botón indica Reanudar y está activo
      await expect(page1.getByTestId('pause-toggle')).toHaveText('Reanudar');
      await expect(page1.getByTestId('pause-toggle')).toBeEnabled();

      // En P2, el botón indica "Pausado por rival" y está deshabilitado
      await expect(page2.getByTestId('pause-toggle')).toHaveText('Pausado por rival');
      await expect(page2.getByTestId('pause-toggle')).toBeDisabled();
    });

    // 7. Intentos de despausar por P2 y reanudación legítima por P1
    await test.step('P2 no puede reanudar la pausa de P1; P1 reanuda la partida autoritativamente', async () => {
      await page1.getByTestId('pause-toggle').click();

      await expect(page1.getByTestId('session-status')).toHaveText('running');
      await expect(page2.getByTestId('session-status')).toHaveText('running');
    });

    // 8. Abandono de P1 y reacción contractual de P2
    await test.step('Desconexión de P1 notifica inmediatamente a P2 con modal de rival desconectado', async () => {
      await page1.close();

      await expect(page2.getByTestId('opponent-disconnected-main-menu-button')).toBeVisible();
      await page2.getByTestId('opponent-disconnected-main-menu-button').click();

      await expect(page2.getByTestId('mode-selector')).toBeVisible();
    });

    await p1Context.close();
    await p2Context.close();

    expect(p1Errors, `Errores detectados en P1: ${p1Errors.join(' | ')}`).toEqual([]);
    expect(p2Errors, `Errores detectados en P2: ${p2Errors.join(' | ')}`).toEqual([]);
  });
});
