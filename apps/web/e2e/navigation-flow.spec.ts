import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test('flujo completo de navegación, selección de modos, resultados y menú', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await test.step('carga de la raíz sin flags muestra el Menú Principal', async () => {
    await page.goto('/');
    await initializeAudioIfPrompted(page);
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await expect(page.getByTestId('start-training-button')).toBeVisible();
    await expect(page.getByTestId('start-battle-button')).toBeVisible();
  });

  await test.step('inicio de Batalla contra la IA desde la interfaz sin query flags', async () => {
    await page.getByTestId('start-battle-button').click();
    await expect(page.getByTestId('own-board-column')).toBeVisible();
    await expect(page.getByTestId('opponent-monitor')).toBeVisible();
    // El header del monitor rival ya no tiene badge "Lvl N" (rediseño
    // industrial, Tarea 0031) — el nivel real de P2 vive en la telemetría.
    await expect(page.getByTestId('opponent-level')).toBeVisible();
    await expect(page.getByTestId('session-status')).toHaveText('running');
  });

  await test.step('salida al menú principal mediante el botón de la cabecera', async () => {
    await page.getByTestId('exit-to-menu-button').click();
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await expect(page.getByTestId('own-board-column')).not.toBeVisible();
  });

  await test.step('inicio de Entrenamiento desde la interfaz sin query flags', async () => {
    await page.getByTestId('start-training-button').click();
    await expect(page.getByTestId('own-board-column')).toBeVisible();
    await expect(page.getByTestId('standby-badge')).toHaveText('SIN OPONENTE');
    await expect(page.getByTestId('training-telemetry')).toBeVisible();
  });

  await test.step('salida al menú principal desmantelando la sesión activa', async () => {
    await page.getByTestId('exit-to-menu-button').click();
    await expect(page.getByTestId('mode-selector')).toBeVisible();
  });

  expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
});
