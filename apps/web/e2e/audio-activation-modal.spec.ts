import { test, expect } from '@playwright/test';

test.describe('Popup Industrial de Activación de Audio E2E', () => {
  test('al cargar la app aparece el popup industrial y al pulsar INICIALIZAR AUDIO se desbloquea y cierra', async ({ page }) => {
    await page.goto('/');

    const modalTitle = page.locator('#audio-modal-title');
    const initBtn = page.locator('[data-testid="initialize-audio-button"]');
    const silentBtn = page.locator('[data-testid="keep-silent-button"]');

    await expect(modalTitle).toBeVisible();
    await expect(modalTitle).toHaveText('SISTEMA DE AUDIO // EN ESPERA');
    await expect(initBtn).toBeVisible();
    await expect(silentBtn).toBeVisible();

    // Pulsar INICIALIZAR AUDIO
    await initBtn.click();

    // El popup debe cerrarse
    await expect(initBtn).toBeHidden();
    await expect(modalTitle).toBeHidden();

    // Comprobar que en la navegación SPA posterior no reaparece
    await page.click('[data-testid="open-settings-button"]');
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();
    await expect(initBtn).toBeHidden();
  });

  test('al pulsar SEGUIR EN SILENCIO se cierra el popup y no reaparece durante la instancia SPA ni altera mute previo', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('rautfall_audio_muted', 'true'));
    await page.reload();

    const initBtn = page.locator('[data-testid="initialize-audio-button"]');
    const silentBtn = page.locator('[data-testid="keep-silent-button"]');

    await expect(initBtn).toBeVisible();
    await silentBtn.click();

    await expect(initBtn).toBeHidden();

    // La preferencia de mute previa 'true' permanece inalterada
    const mutedStorage = await page.evaluate(() => localStorage.getItem('rautfall_audio_muted'));
    expect(mutedStorage).toBe('true');

    // Navegar en la SPA
    await page.click('[data-testid="open-history-button"]');
    await expect(page.locator('[data-testid="history-screen"]')).toBeVisible();
    await expect(initBtn).toBeHidden();
  });

  test('si el audio estaba silenciado previamente, INICIALIZAR AUDIO desactiva el mute y guarda la preferencia no silenciada', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('rautfall_audio_muted', 'true'));
    await page.reload();

    const initBtn = page.locator('[data-testid="initialize-audio-button"]');
    await expect(initBtn).toBeVisible();

    await initBtn.click();
    await expect(initBtn).toBeHidden();

    // La preferencia de mute debe haber cambiado a 'false'
    const mutedStorage = await page.evaluate(() => localStorage.getItem('rautfall_audio_muted'));
    expect(mutedStorage).toBe('false');

    // Navegar a juego y comprobar el botón de estado de audio
    await page.click('[data-testid="start-training-button"]');
    const muteBtn = page.locator('[data-testid="audio-mute-button"]');
    await expect(muteBtn).toBeVisible();
    await expect(muteBtn).toHaveText('AUDIO ACTIVO');
  });
});
