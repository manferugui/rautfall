import { test, expect } from '@playwright/test';
import { initializeAudioIfPrompted, continueSilentlyIfPrompted } from './audio-helpers';

test.describe('Flujo de Audio y Mute', () => {
  test('navega por la aplicación sin errores de consola ni de AudioContext y conmuta el botón de Mute', async ({ page }) => {
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

    const muteBtn = page.locator('[data-testid="audio-mute-button"]');
    await expect(muteBtn).toBeVisible();
    await expect(muteBtn).toHaveAttribute('data-audio-muted', 'false');

    // 2. Conmutar Mute a activado (silenciado)
    await muteBtn.click();
    await expect(muteBtn).toHaveAttribute('data-audio-muted', 'true');

    // 3. Recargar la página y verificar que la preferencia de silencio persiste al continuar en silencio
    await page.reload();
    await continueSilentlyIfPrompted(page);
    const muteBtnAfterReload = page.locator('[data-testid="audio-mute-button"]');
    await expect(muteBtnAfterReload).toHaveAttribute('data-audio-muted', 'true');

    // 4. Iniciar modo Entrenamiento y verificar la cabecera
    await page.click('[data-testid="start-training-button"]');
    await expect(page.locator('.app-title')).toHaveText('RAUTFALL');

    const headerMuteBtn = page.locator('.app-header [data-testid="audio-mute-button"]');
    await expect(headerMuteBtn).toBeVisible();
    await expect(headerMuteBtn).toHaveAttribute('data-audio-muted', 'true');

    // 5. Volver al menú
    await page.click('[data-testid="exit-to-menu-button"]');
    await expect(page.locator('[data-testid="mode-selector"]')).toBeVisible();

    // Confirmar ausencia de errores fatales en consola
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    // Limpieza explícita de la clave de silencio en localStorage
    await page.evaluate(() => localStorage.removeItem('rautfall_audio_muted'));
  });
});
