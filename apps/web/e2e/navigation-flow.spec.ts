import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test.describe('Navegación web real, sincronización de URL, Back/Forward y deep links', () => {
  test('flujo completo de navegación, selección de modos, resultados y menú', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await test.step('carga de la raíz sin flags muestra el Menú Principal y URL /', async () => {
      await page.goto('/');
      await initializeAudioIfPrompted(page);
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('mode-selector')).toBeVisible();
      await expect(page.getByTestId('start-training-button')).toBeVisible();
      await expect(page.getByTestId('start-battle-button')).toBeVisible();
    });

    await test.step('inicio de Batalla contra la IA desde la interfaz actualiza la URL a /battle', async () => {
      await page.getByTestId('start-battle-button').click();
      await expect(page).toHaveURL('/battle');
      await expect(page.getByTestId('own-board-column')).toBeVisible();
      await expect(page.getByTestId('opponent-monitor')).toBeVisible();
      await expect(page.getByTestId('opponent-level')).toBeVisible();
      await expect(page.getByTestId('session-status')).toHaveText('running');
    });

    await test.step('salida al menú principal mediante el botón de la cabecera actualiza la URL a /', async () => {
      await page.getByTestId('exit-to-menu-button').click();
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('mode-selector')).toBeVisible();
      await expect(page.getByTestId('own-board-column')).not.toBeVisible();
    });

    await test.step('inicio de Entrenamiento desde la interfaz actualiza la URL a /training', async () => {
      await page.getByTestId('start-training-button').click();
      await expect(page).toHaveURL('/training');
      await expect(page.getByTestId('own-board-column')).toBeVisible();
      await expect(page.getByTestId('standby-badge')).toHaveText('SIN OPONENTE');
      await expect(page.getByTestId('training-telemetry')).toBeVisible();
    });

    await test.step('salida al menú principal desmantelando la sesión activa', async () => {
      await page.getByTestId('exit-to-menu-button').click();
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('mode-selector')).toBeVisible();
    });

    expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('navegación real del navegador con Back/Forward en pantallas estándar', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await initializeAudioIfPrompted(page);

    // 1. Menu -> Settings
    await page.getByTestId('open-settings-button').click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByTestId('settings-screen')).toBeVisible();

    // 2. Settings -> Ranking (vía Menú)
    await page.getByTestId('settings-back-button').click();
    await expect(page).toHaveURL('/');
    await page.getByTestId('open-ranking-button').click();
    await expect(page).toHaveURL('/ranking');
    await expect(page.getByTestId('ranking-screen')).toBeVisible();

    // 3. Back -> Menu
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('mode-selector')).toBeVisible();

    // 4. Back -> Settings
    await page.goBack();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByTestId('settings-screen')).toBeVisible();

    // 5. Back -> Menu
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('mode-selector')).toBeVisible();

    // 6. Forward -> Settings
    await page.goForward();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByTestId('settings-screen')).toBeVisible();

    expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('navegación real del navegador Back/Forward con recreación limpia de sesión Phaser en Training', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await initializeAudioIfPrompted(page);

    // Menu -> Training
    await page.getByTestId('start-training-button').click();
    await expect(page).toHaveURL('/training');
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toHaveCount(1);
    await expect(page.getByTestId('session-status')).toHaveText('running');

    // Training -> Back -> Menu (destruye Phaser)
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toHaveCount(0);

    // Menu -> Forward -> Training (recrea sesión limpia de Phaser)
    await page.goForward();
    await expect(page).toHaveURL('/training');
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toHaveCount(1);
    await expect(page.getByTestId('session-status')).toHaveText('running');

    expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('soporte de deep links directos, refresh F5, fallback de /results sin estado y rutas no encontradas', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // 1. Deep link /settings
    await page.goto('/settings');
    await initializeAudioIfPrompted(page);
    await expect(page).toHaveURL('/settings');
    await expect(page.getByTestId('settings-screen')).toBeVisible();

    // 2. Refresh F5 en /settings
    await page.reload();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByTestId('settings-screen')).toBeVisible();

    // 3. Deep link /ranking
    await page.goto('/ranking');
    await expect(page).toHaveURL('/ranking');
    await expect(page.getByTestId('ranking-screen')).toBeVisible();

    // 4. Deep link /history
    await page.goto('/history');
    await expect(page).toHaveURL('/history');
    await expect(page.getByTestId('history-screen')).toBeVisible();

    // 5. Deep link /results sin estado de partida -> redirige a /
    await page.goto('/results');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('mode-selector')).toBeVisible();

    // 6. Deep link a ruta inexistente /ruta-inexistente -> redirige a /
    await page.goto('/ruta-inexistente');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('mode-selector')).toBeVisible();

    expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('transición desde DEV Battle Demo al menú desmantela el contexto DEV y permite ResultsModal en Training posterior', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await test.step('entrar en DEV Battle Demo directamente por URL', async () => {
      await page.goto('/?battle-demo=1');
      await initializeAudioIfPrompted(page);
      await expect(page).toHaveURL('/battle?battle-demo=1');
      await expect(page.getByTestId('own-board-column')).toBeVisible();
      await expect(page.getByTestId('opponent-monitor')).toBeVisible();
    });

    await test.step('volver al menú principal mediante el botón de la interfaz limpia la URL y abandona DEV demo', async () => {
      await page.getByTestId('exit-to-menu-button').click();
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('mode-selector')).toBeVisible();
      expect(page.url()).not.toContain('battle-demo');
    });

    await test.step('entrar en Entrenamiento normal desde el menú y provocar top-out', async () => {
      await page.getByTestId('start-training-button').click();
      await expect(page).toHaveURL('/training');
      await expect(page.getByTestId('own-board-column')).toBeVisible();

      for (let i = 0; i < 80; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(70);
        if (await page.getByTestId('results-modal').isVisible()) break;
      }

      await expect(page.getByTestId('results-modal')).toBeVisible();
      await expect(page.getByTestId('results-title')).toHaveText('ENTRENAMIENTO FINALIZADO');
    });

    expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});

