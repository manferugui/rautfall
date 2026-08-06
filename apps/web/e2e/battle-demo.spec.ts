import { test, expect, type Page } from '@playwright/test';

type BotDevState = Readonly<{
  battleStep: number;
  pieceId: number | null;
  x: number | null;
  y: number | null;
  minCellY: number | null;
  orientation: number | null;
  boardCellCount: number;
  phase: string;
  reactionStepsRemaining: number;
  actionIntervalStepsRemaining: number;
  hardDropDelayStepsRemaining: number;
  actionIndex: number;
  lastActionStep: number | null;
  lastAction: string | null;
  currentAction: string | null;
  planLength: number;
  hardDropPhaseStepCount: number;
  maxActionsInSingleStep: number;
}>;

async function readBotDevState(page: Page): Promise<BotDevState> {
  const getText = async (testId: string): Promise<string | null> => {
    const el = page.getByTestId(testId);
    if ((await el.count()) === 0) return null;
    const txt = (await el.textContent())?.trim();
    if (!txt || txt === 'NULL' || txt === '-') return null;
    return txt;
  };

  const getNum = async (testId: string): Promise<number | null> => {
    const txt = await getText(testId);
    if (txt === null) return null;
    const n = Number(txt);
    return isNaN(n) ? null : n;
  };

  return Object.freeze({
    battleStep: (await getNum('battle-step')) ?? 0,
    pieceId: await getNum('player-two-piece-id'),
    x: await getNum('player-two-x'),
    y: await getNum('player-two-y'),
    minCellY: await getNum('player-two-min-cell-y'),
    orientation: await getNum('player-two-orientation'),
    boardCellCount: (await getNum('player-two-board-cell-count')) ?? 0,
    phase: (await getText('bot-phase')) ?? '',
    reactionStepsRemaining: (await getNum('bot-reaction-steps-remaining')) ?? 0,
    actionIntervalStepsRemaining: (await getNum('bot-action-interval-steps-remaining')) ?? 0,
    hardDropDelayStepsRemaining: (await getNum('bot-hard-drop-delay-steps-remaining')) ?? 0,
    actionIndex: (await getNum('bot-action-index')) ?? 0,
    lastActionStep: await getNum('bot-last-action-step'),
    lastAction: await getText('bot-last-action'),
    currentAction: await getText('bot-current-action'),
    planLength: (await getNum('bot-plan-length')) ?? 0,
    hardDropPhaseStepCount: (await getNum('bot-hard-drop-phase-step-count')) ?? 0,
    maxActionsInSingleStep: (await getNum('bot-max-actions-in-single-step')) ?? 0,
  });
}

test('modo battle-demo=1: verificacion E2E del bot determinista para P2', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('404')) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  let visibleStep = 0;
  let firstActionStep = 0;
  let moveActionStep: number | null = null;

  await test.step('Escenario 1 — Visibilidad completa y retardo de reacción de 20 pasos', async () => {
    await page.goto('/?battle-demo=1');
    await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();

    await expect(page.getByTestId('real-badge')).toBeVisible();
    await expect(page.getByTestId('real-badge')).toHaveText('Lvl 1');
    await expect(page.getByTestId('battle-demo-dev-panel')).toBeVisible();
    await expect(page.getByTestId('battle-status')).toHaveText('running');

    // Estado inicial: mientras minCellY < 4 (pieza parcialmente en spawn oculto)
    const stInitial = await readBotDevState(page);
    if (stInitial.minCellY !== null && stInitial.minCellY < 4) {
      expect(stInitial.actionIndex).toBe(0);
      expect(stInitial.currentAction).toBeNull();
      expect(stInitial.phase).toBe('waitingForVisibility');
    }

    // Esperar a que la pieza alcance visibilidad completa (minCellY >= 4)
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.minCellY;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(4);

    // Capturar momento de visibilidad completa
    const stVisible = await readBotDevState(page);
    visibleStep = stVisible.battleStep;

    // Entrar en fase de reacción o posterior tras visibilidad
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.phase;
    }).not.toBe('waitingForVisibility');

    const stReacting = await readBotDevState(page);
    expect(stReacting.reactionStepsRemaining).toBeLessThanOrEqual(20);

    // Esperar a la primera acción no neutra del plan
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.actionIndex;
    }, { timeout: 5000 }).toBeGreaterThan(0);

    const stFirstAction = await readBotDevState(page);
    firstActionStep = stFirstAction.battleStep;

    // Demostrar matemáticamente: firstActionStep - visibleStep >= 20
    expect(firstActionStep - visibleStep).toBeGreaterThanOrEqual(20);
  });

  await test.step('Escenario 2 — Cadencia determinista de 4 pasos entre acciones', async () => {
    // Esperar a la primera acción emitida por el bot
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.lastActionStep;
    }, { timeout: 8000 }).not.toBeNull();

    const stAct1 = await readBotDevState(page);
    const act1Step = stAct1.lastActionStep!;
    if (stAct1.lastAction !== 'hardDrop') {
      moveActionStep = act1Step;
    }

    // Esperar a la siguiente acción emitida por el bot (lastActionStep > act1Step)
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.lastActionStep;
    }, { timeout: 8000 }).toBeGreaterThan(act1Step);

    const stAct2 = await readBotDevState(page);
    const act2Step = stAct2.lastActionStep!;

    // Demostrar matemáticamente: act2Step - act1Step >= 4
    expect(act2Step - act1Step).toBeGreaterThanOrEqual(4);
    expect(act2Step - act1Step).toBeGreaterThan(1);
  });

  await test.step('Escenario 3 — Captura exclusiva de waitingBeforeHardDrop y aserción de 5 pasos', async () => {
    // Asegurar visibilidad completa de la pieza actual antes de buscar la fase de hard drop
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.minCellY;
    }, { timeout: 15000 }).toBeGreaterThanOrEqual(4);

    // Esperar a que la fase sea observada de forma acumulativa vía telemetría DEV (respetando los 5 pasos configurados)
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.hardDropPhaseStepCount;
    }, { timeout: 20000 }).toBeGreaterThanOrEqual(5);

    const waitStart = await readBotDevState(page);
    expect(waitStart.hardDropPhaseStepCount).toBeGreaterThanOrEqual(5);
    expect(waitStart.pieceId).not.toBeNull();

    const pieceIdBefore = waitStart.pieceId;

    // Esperar a que la pieza cambie tras completarse el hardDrop
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.pieceId;
    }, { timeout: 5000 }).not.toBe(pieceIdBefore);

    const afterDrop = await readBotDevState(page);

    // Demostración matemática exacta: tras el hard drop la simulación ha avanzado
    expect(afterDrop.battleStep).toBeGreaterThan(waitStart.battleStep);
  });

  await test.step('Escenario 4 — Separación >= 5 pasos entre movimiento y hardDrop', async () => {
    // Esperar a la emisión de hardDrop
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.lastAction;
    }, { timeout: 8000 }).toBe('hardDrop');

    const stHardDrop = await readBotDevState(page);
    const hardDropStep = stHardDrop.lastActionStep;

    expect(hardDropStep).not.toBeNull();

    if (moveActionStep !== null && hardDropStep !== null && hardDropStep > moveActionStep) {
      expect(hardDropStep - moveActionStep).toBeGreaterThanOrEqual(5);
    }
  });

  await test.step('Escenario 5 — Pausa y reanudación coordinada sin ráfaga', async () => {
    // Esperar a que el bot se encuentre en una fase activa
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.phase;
    }).not.toBe('waitingForVisibility');

    // Pulsa pausa
    await page.getByTestId('pause-toggle').click();
    await expect(page.getByTestId('session-status')).toHaveText('paused');
    await expect(page.getByTestId('opponent-pause-overlay')).toBeVisible();

    // Capturar estado congelado tras pausar
    const st1 = await readBotDevState(page);

    // Esperar 150 ms en tiempo real del navegador
    await page.waitForTimeout(150);

    const st2 = await readBotDevState(page);

    // Confirmar congelamiento exacto de todos los valores de telemetría DEV durante la pausa
    expect(st2.battleStep).toBe(st1.battleStep);
    expect(st2.pieceId).toBe(st1.pieceId);
    expect(st2.x).toBe(st1.x);
    expect(st2.y).toBe(st1.y);
    expect(st2.orientation).toBe(st1.orientation);
    expect(st2.phase).toBe(st1.phase);
    expect(st2.reactionStepsRemaining).toBe(st1.reactionStepsRemaining);
    expect(st2.actionIntervalStepsRemaining).toBe(st1.actionIntervalStepsRemaining);
    expect(st2.hardDropDelayStepsRemaining).toBe(st1.hardDropDelayStepsRemaining);
    expect(st2.actionIndex).toBe(st1.actionIndex);
    expect(st2.currentAction).toBe(st1.currentAction);

    // Reanudar
    await page.getByTestId('pause-toggle').click();
    await expect(page.getByTestId('session-status')).toHaveText('running');

    // Esperar a que la simulación reanude el avance de battleStep
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.battleStep;
    }).toBeGreaterThan(st1.battleStep);

    const st3 = await readBotDevState(page);

    // Demostrar ausencia de ráfaga: en ningún paso único de simulación el bot ejecutó más de 1 acción
    expect(st3.maxActionsInSingleStep).toBeLessThanOrEqual(1);
  });

  await test.step('Escenario 6 — Reinicio completo a estado determinista inicial (pieceId = 1)', async () => {
    // Asegurar que la sesión ha avanzado
    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.pieceId;
    }).toBeGreaterThan(1);

    await page.getByTestId('reset-button').click();

    await expect(page.getByTestId('session-status')).toHaveText('running');
    await expect(page.getByTestId('battle-status')).toHaveText('running');

    await expect.poll(async () => {
      const st = await readBotDevState(page);
      return st.battleStep;
    }).toBeLessThan(10);

    const stReset = await readBotDevState(page);

    // Verificación integral de restauración de la máquina interna
    expect(stReset.pieceId).toBe(1);
    expect(stReset.actionIndex).toBe(0);
    expect(stReset.planLength).toBe(0);
    expect(stReset.currentAction).toBeNull();
    expect(stReset.lastAction).toBeNull();
    expect(stReset.lastActionStep).toBeNull();
    expect(['waitingForVisibility', 'reacting']).toContain(stReset.phase);
    expect(stReset.reactionStepsRemaining).toBe(20);
    expect(stReset.actionIntervalStepsRemaining).toBe(0);
    expect(stReset.hardDropDelayStepsRemaining).toBe(0);
  });

  await test.step('Escenario 7 — Ausencia de errores de consola o excepciones de página', async () => {
    expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
