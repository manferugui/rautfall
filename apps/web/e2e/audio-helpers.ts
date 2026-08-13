import type { Page } from '@playwright/test';

/**
 * Helper reutilizable de Playwright para resolver el popup industrial de audio
 * en los escenarios E2E que requieran inicializar el módulo de sonido.
 */
export async function initializeAudioIfPrompted(page: Page): Promise<void> {
  const initBtn = page.locator('[data-testid="initialize-audio-button"]');
  if (await initBtn.isVisible().catch(() => false)) {
    await initBtn.click();
  }
}

/**
 * Helper reutilizable de Playwright para resolver el popup industrial de audio
 * en los escenarios E2E que prefieran continuar en silencio.
 */
export async function continueSilentlyIfPrompted(page: Page): Promise<void> {
  const silentBtn = page.locator('[data-testid="keep-silent-button"]');
  if (await silentBtn.isVisible().catch(() => false)) {
    await silentBtn.click();
  }
}
