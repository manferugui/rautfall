import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted } from './audio-helpers';

test.describe('Flujo de Audio de Música y SFX', () => {
  test('navega por la aplicación sin errores de consola ni de AudioContext y conmuta los canales de Música y SFX', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // 1. Cargar Menú Principal e inicializar audio mediante el modal
    await page.goto('/');
    await initializeAudioIfPrompted(page);

    // 2. Iniciar modo Entrenamiento para acceder a los controles de la cabecera
    await page.click('[data-testid="start-training-button"]');
    await expect(page.locator('.app-title')).toHaveText('RAUTFALL');

    const musicBtn = page.locator('[data-testid="music-toggle-button"]');
    const sfxBtn = page.locator('[data-testid="sfx-toggle-button"]');

    await expect(musicBtn).toBeVisible();
    await expect(sfxBtn).toBeVisible();
    await expect(musicBtn).toHaveAttribute('data-music-enabled', 'true');
    await expect(sfxBtn).toHaveAttribute('data-sfx-enabled', 'true');

    // 3. Conmutar Música a OFF y SFX a OFF
    await musicBtn.click();
    await expect(musicBtn).toHaveAttribute('data-music-enabled', 'false');

    await sfxBtn.click();
    await expect(sfxBtn).toHaveAttribute('data-sfx-enabled', 'false');

    // 4. Volver al menú
    await page.click('[data-testid="exit-to-menu-button"]');
    await expect(page.locator('[data-testid="mode-selector"]')).toBeVisible();

    // 5. Ir a la pantalla de Ajustes y verificar que la sección de Canales de Audio muestra las preferencias
    await page.click('[data-testid="open-settings-button"]');
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();

    const settingsMusicBtn = page.locator('[data-testid="settings-music-toggle-button"]');
    const settingsSfxBtn = page.locator('[data-testid="settings-sfx-toggle-button"]');

    await expect(settingsMusicBtn).toHaveAttribute('data-music-enabled', 'false');
    await expect(settingsSfxBtn).toHaveAttribute('data-sfx-enabled', 'false');

    // Confirmar ausencia de errores fatales en consola
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
