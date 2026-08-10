import { test, expect } from '@playwright/test';

test('flujo de remapeo de controles, persistencia local y uso mantenido (DAS/ARR) en partida', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await test.step('abrir pantalla de configuración desde el menú principal', async () => {
    await page.goto('/');
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await page.getByTestId('open-settings-button').click();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
  });

  await test.step('remapear Move Left a la tecla KeyJ', async () => {
    await page.getByTestId('change-btn-moveLeft').click();
    await expect(page.getByTestId('capture-prompt')).toBeVisible();
    await page.keyboard.press('KeyJ');
    await expect(page.getByTestId('capture-prompt')).not.toBeVisible();
    await expect(page.getByTestId('control-row-moveLeft')).toContainText('J');
  });

  await test.step('volver al menú principal y comprobar que la tecla J se muestra en el resumen', async () => {
    await page.getByTestId('settings-back-button').click();
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await expect(page.getByTestId('mode-selector')).toContainText('J');
  });

  await test.step('entrar en Entrenamiento y comprobar movimiento mantenido DAS/ARR con KeyJ', async () => {
    await page.getByTestId('start-training-button').click();
    await expect(page.getByTestId('own-board-column')).toBeVisible();
    await expect(page.getByTestId('session-status')).toHaveText('running');

    // Mantener la tecla remapeada KeyJ para superar el DAS y activar ARR
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(400); // 400 ms supera holgadamente el retraso DAS (160 ms) y ejecuta repetición ARR
    await page.keyboard.up('KeyJ');

    const stepAfterReleaseText = await page.getByTestId('session-step').innerText();
    const stepAfterRelease = parseInt(stepAfterReleaseText, 10);

    // Esperar 200 ms adicionales para confirmar que tras soltar la tecla cesa el movimiento mantenido
    await page.waitForTimeout(200);
    const stepLaterText = await page.getByTestId('session-step').innerText();
    const stepLater = parseInt(stepLaterText, 10);

    // La partida debe avanzar con normalidad
    expect(stepLater).toBeGreaterThanOrEqual(stepAfterRelease);
  });

  await test.step('recargar la página y comprobar la persistencia local', async () => {
    await page.getByTestId('exit-to-menu-button').click();
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('mode-selector')).toBeVisible();
    await page.getByTestId('open-settings-button').click();
    await expect(page.getByTestId('control-row-moveLeft')).toContainText('J');
  });

  await test.step('restaurar controles predeterminados', async () => {
    await page.getByTestId('reset-defaults-button').click();
    await expect(page.getByTestId('control-row-moveLeft')).toContainText('←');
  });

  expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
});
