import { test, expect } from '@playwright/test';

test.describe('Escenario DEV — SFX LAB (?sfx-lab=1)', () => {
  test('abre el laboratorio de SFX, desbloquea el audio, interactúa con la secuencia y los 10 botones sin canvas Phaser ni errores', async ({
    page,
  }) => {
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

    // 1. Abrir la aplicación con el flag DEV ?sfx-lab=1
    await page.goto('/?sfx-lab=1');

    // 2. Verificar que se renderiza el panel SFX LAB
    const sfxLabTitle = page.locator('[data-testid="sfx-lab-title"]');
    await expect(sfxLabTitle).toBeVisible();
    await expect(sfxLabTitle).toHaveText('SFX LAB');

    // 3. Verificar nota DEV obligatoria
    const sfxDevNote = page.locator('[data-testid="sfx-dev-note"]');
    await expect(sfxDevNote).toBeVisible();
    await expect(sfxDevNote).toContainText('Escucha cada efecto con y sin el fondo de prueba DEV.');

    // 4. Confirmar que NO se ha instanciado un canvas de Phaser
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBe(0);

    // 5. Desbloquear AudioContext mediante interacción
    const unlockBtn = page.locator('[data-testid="unlock-audio-button"]');
    await unlockBtn.click();

    // 6. Pulsar los botones de SFX individuales
    const sfxList = [
      'uiClick',
      'pieceLocked',
      'hardDrop',
      'linesCleared',
      'quadOrTSpin',
      'sabotageTriggered',
      'residuesTriggered',
      'residuesReceived',
      'overloadTriggered',
      'overloadReceived',
      'reversePolarityTriggered',
      'reversePolarityReceived',
      'suddenDeathWarning',
      'suddenDeathStarted',
      'gameOver',
      'victory',
    ];

    for (const type of sfxList) {
      const playBtn = page.locator(`[data-testid="play-sfx-${type}"]`);
      await expect(playBtn).toBeVisible();
      await playBtn.click();
    }

    // 7. Probar Reproducir Todos y Detener Secuencia
    const playAllBtn = page.locator('[data-testid="play-all-sfx-button"]');
    const stopBtn = page.locator('[data-testid="stop-sequence-button"]');

    await playAllBtn.click();
    await expect(playAllBtn).toBeDisabled();
    await expect(stopBtn).toBeEnabled();

    await stopBtn.click();
    await expect(playAllBtn).toBeEnabled();
    await expect(stopBtn).toBeDisabled();

    // 8. Verificar ausencia total de console.error y pageerror
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
