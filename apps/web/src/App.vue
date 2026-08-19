<script setup lang="ts">
import { ref, shallowRef, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { setActiveResultHandler } from './router';
import GameCanvas from './components/GameCanvas.vue';
import NextPiecesPreview from './components/NextPiecesPreview.vue';
import ScorePanel from './components/ScorePanel.vue';
import HeldPiecePreview from './components/HeldPiecePreview.vue';
import OpponentMonitor from './components/OpponentMonitor.vue';
import CombatStatusPanel from './components/CombatStatusPanel.vue';
import AttackSlotsPanel from './components/AttackSlotsPanel.vue';
import ModeSelector from './components/ModeSelector.vue';
import SettingsScreen from './components/SettingsScreen.vue';
import HistoryScreen from './components/HistoryScreen.vue';
import RankingScreen from './components/RankingScreen.vue';
import ResultsModal from './components/ResultsModal.vue';
import OperatorTagModal from './components/OperatorTagModal.vue';
import AudioActivationModal from './components/AudioActivationModal.vue';
import OpponentDisconnectedModal from './components/OpponentDisconnectedModal.vue';
import PauseShutter from './components/PauseShutter.vue';
import type { GameMode, GamePresentationState, GameResultSummary, PhaserGameController } from './game/types';
import { isBattleDemoActive, isDebugPanelActive } from './game/battle-demo';
import { getAudioManager } from './audio';
import { getOrCreatePlayerId, getPlayerTag, setPlayerTag, hasPlayerTag } from './api/identity';
import { submitMatch } from './api/client';
import type { CreateMatchInput, WsParticipantRole } from '@rautfall/contracts';
import type { ActiveEffectSnapshot, SabotageType } from '@rautfall/game-engine';
import type { BotProfileId } from '@rautfall/battle-engine';

import { generateMatchSeed } from './game/seed';
import { hasAnyDevDemoQueryParam } from './dev/dev-demos';
import { defineAsyncComponent, type Component } from 'vue';
import OnlineRoomModal from './components/OnlineRoomModal.vue';
import { OnlineGameSession, type OnlineSessionStatus } from './api/online-game-session';

const SfxLabComponent: Component | null = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./components/SfxLab.vue'))
  : null;

// El propio import dinámico queda eliminado del bundle de producción cuando
// import.meta.env.DEV es false (constante de compilación) — misma guarda
// que ya usa SfxLabComponent, sin duplicar lógica.
const DevLauncherScreenComponent: Component | null = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./components/DevLauncherScreen.vue'))
  : null;

const routeFromVue = useRoute();
const routerFromVue = useRouter();

const fallbackRoute = ref<{ name: string; query: LocationQueryRaw }>({
  name: 'home',
  query: {},
});

const currentRouteName = computed<string>(() => {
  if (routeFromVue && routeFromVue.name) {
    return routeFromVue.name as string;
  }
  return fallbackRoute.value.name;
});

function pushRoute(name: string, query: LocationQueryRaw = {}): void {
  if (routerFromVue) {
    void routerFromVue.push({ name, query });
  } else {
    fallbackRoute.value = { name, query };
  }
}

function replaceRoute(name: string, query: LocationQueryRaw = {}): void {
  if (routerFromVue) {
    void routerFromVue.replace({ name, query });
  } else {
    fallbackRoute.value = { name, query };
  }
}

const activeRouteQuery = computed(() => routeFromVue?.query ?? fallbackRoute.value.query);

const isDevDemo = computed<boolean>(() => {
  if (!import.meta.env.DEV) return false;
  return hasAnyDevDemoQueryParam(activeRouteQuery.value as Record<string, unknown>);
});

const isWarningDemo = computed<boolean>(() => {
  if (!import.meta.env.DEV) return false;
  return activeRouteQuery.value['warning-demo'] === '1';
});

const isSfxLab = computed<boolean>(() => {
  if (!import.meta.env.DEV) return false;
  return activeRouteQuery.value['sfx-lab'] !== undefined;
});

const isDevDebugPanel = computed(
  () => import.meta.env.DEV && (isDebugPanelActive() || activeRouteQuery.value['debug-panel'] === '1'),
);

const isOnlineActive = ref(false);

const gameMode = computed<GameMode>(() => {
  if (isOnlineActive.value || activeRouteQuery.value['online'] === '1') return 'online';
  const name = currentRouteName.value;
  if (name === 'battle') return 'battle';
  if (name === 'training') return 'training';
  if (name === 'results' && gameResult.value) return gameResult.value.mode;
  if (isBattleDemoActive() || isWarningDemo.value) return 'battle';
  return 'training';
});

const selectedBotProfile = ref<BotProfileId>('battleOperator');
const matchSeed = ref<number>(generateMatchSeed());

const isCanvasMounted = computed(() => {
  if (isSfxLab.value) return false;
  const name = currentRouteName.value;
  return name === 'training' || name === 'battle' || name === 'results';
});

const audioManager = getAudioManager();
const isMusicEnabled = ref(audioManager.isMusicEnabled());
const isSfxEnabled = ref(audioManager.isSfxEnabled());
const isAudioUnlocked = ref(audioManager.isUnlocked());
const hasAudioPromptBeenDismissed = ref(false);
const isAudioInitializing = ref(false);
const audioInitError = ref(false);

const isAudioModalOpen = computed(
  () => !isAudioUnlocked.value && !hasAudioPromptBeenDismissed.value
);

function reconcileScreenAudio(): void {
  if (!audioManager.isUnlocked()) return;
  const name = currentRouteName.value;
  if (name === 'home' || name === 'settings' || name === 'ranking' || name === 'history' || name === 'dev-tools') {
    audioManager.playMusic('menu');
  } else if (name === 'training' || name === 'battle' || name === 'results') {
    if (isSuddenDeathActive.value) {
      audioManager.playMusic('suddenDeath');
    } else {
      audioManager.playMusic('gameplay');
    }
  }
}

watch(
  currentRouteName,
  () => {
    reconcileScreenAudio();
  },
);

if (audioManager.isUnlocked()) {
  reconcileScreenAudio();
}

async function handleInitializeAudio(): Promise<void> {
  if (isAudioInitializing.value) return;
  isAudioInitializing.value = true;
  audioInitError.value = false;

  try {
    await audioManager.unlock();
    isAudioUnlocked.value = audioManager.isUnlocked();
    isMusicEnabled.value = audioManager.isMusicEnabled();
    isSfxEnabled.value = audioManager.isSfxEnabled();
    audioManager.playSfx('uiClick');
    reconcileScreenAudio();
  } catch {
    audioInitError.value = true;
  } finally {
    isAudioInitializing.value = false;
  }
}

function handleKeepSilentAudio(): void {
  hasAudioPromptBeenDismissed.value = true;
}

function toggleMusic(): void {
  void audioManager.unlock().then(() => {
    isAudioUnlocked.value = audioManager.isUnlocked();
  }).catch(() => {
    // Ignorar si falla el unlock diferido
  });
  audioManager.playSfx('uiClick');
  isMusicEnabled.value = audioManager.toggleMusic();
  reconcileScreenAudio();
}

function toggleSfx(): void {
  void audioManager.unlock().then(() => {
    isAudioUnlocked.value = audioManager.isUnlocked();
  }).catch(() => {
    // Ignorar si falla el unlock diferido
  });
  isSfxEnabled.value = audioManager.toggleSfx();
  audioManager.playSfx('uiClick');
}


const gameState = ref<GamePresentationState>({
  status: 'running',
  step: 0,
  elapsedMs: 0,
  nextPieces: ['I', 'I', 'I'],
  heldPiece: null,
  score: 0,
  clearedLines: 0,
  combo: 0,
  backToBack: 0,
  combatEnergy: 0,
  storedSabotages: [],
  pendingGarbage: 0,
  activeEffects: [],
  level: 1,
  baseGravityCellsPerSecond: 1.0,
  activeGravityCellsPerSecond: 1.0,
});

const isSuddenDeathActive = computed(() => {
  const phase = gameState.value.battleState?.suddenDeathPhase;
  return phase === 'warning' || phase === 'phase1' || phase === 'phase2' || phase === 'phase3';
});

const localWarnings = computed(() => gameState.value.battleState?.playerOneState?.warnings ?? []);

const sobrecargaActiveEffect = computed(() => {
  return gameState.value.activeEffects.find((e) => e.type === 'sobrecarga') as
    | Extract<ActiveEffectSnapshot, { type: 'sobrecarga' }>
    | undefined;
});

const hasSobrecargaActive = computed(() => !!sobrecargaActiveEffect.value);

const sobrecargaCountdownText = computed(() => {
  if (!sobrecargaActiveEffect.value) return '';
  return `${(sobrecargaActiveEffect.value.remainingMs / 1000).toFixed(1)}s`;
});

const polaridadActiveEffect = computed(() => {
  return gameState.value.activeEffects.find((e) => e.type === 'polaridad') as
    | Extract<ActiveEffectSnapshot, { type: 'polaridad' }>
    | undefined;
});

const hasPolaridadActive = computed(() => !!polaridadActiveEffect.value);

const polaridadCountdownText = computed(() => {
  if (!polaridadActiveEffect.value) return '';
  const count = polaridadActiveEffect.value.remainingPieces;
  const label = count === 1 ? 'PIEZA' : 'PIEZAS';
  return `${count} ${label}`;
});

const isPolaridadPulseActive = ref(false);
let polaridadPulseTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => polaridadActiveEffect.value?.remainingPieces,
  (newVal, oldVal) => {
    if (newVal !== undefined && oldVal !== undefined && newVal < oldVal) {
      isPolaridadPulseActive.value = true;
      if (polaridadPulseTimeout !== null) {
        clearTimeout(polaridadPulseTimeout);
      }
      polaridadPulseTimeout = setTimeout(() => {
        isPolaridadPulseActive.value = false;
        polaridadPulseTimeout = null;
      }, 100);
    }
  },
);

watch(
  () => gameState.value.status,
  (newStatus, oldStatus) => {
    if (oldStatus === 'running' && newStatus === 'paused') {
      audioManager.playSfx('pauseShutterClose');
      audioManager.pauseMusic();
    } else if (oldStatus === 'paused' && newStatus === 'running') {
      audioManager.playSfx('pauseShutterOpen');
      audioManager.resumeMusic();
    }
  },
);

const interferenciaActiveEffect = computed(() => {
  const p1 = gameState.value.battleState?.playerOneState;
  if (p1?.isInterfered && p1.interferenciaRemainingMs > 0) {
    return { type: 'interferencia' as const, remainingMs: p1.interferenciaRemainingMs };
  }
  return undefined;
});

const hasInterferenciaActive = computed(() => !!interferenciaActiveEffect.value);

const interferenciaCountdownText = computed(() => {
  if (!interferenciaActiveEffect.value) return '';
  return `${(interferenciaActiveEffect.value.remainingMs / 1000).toFixed(1)}s`;
});

const hasSobrecargaWarning = computed(
  () => !hasSobrecargaActive.value && localWarnings.value.some((w) => w.sabotage === 'sobrecarga'),
);
const hasPolaridadWarning = computed(
  () => !hasPolaridadActive.value && localWarnings.value.some((w) => w.sabotage === 'polaridad'),
);
const hasInterferenciaWarning = computed(
  () => !hasInterferenciaActive.value && localWarnings.value.some((w) => w.sabotage === 'interferencia'),
);

const isSabotageBlockedActive = ref(false);
const blockedReasonSubtitle = ref('');
let sabotageBlockedTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => gameState.value.battleState?.lastSabotageBlockedDetails,
  (details) => {
    if (details && details.target === 'playerOne') {
      isSabotageBlockedActive.value = true;
      if (details.reason === 'immunity') {
        blockedReasonSubtitle.value = 'INMUNIDAD';
      } else if (details.reason === 'alreadyActive') {
        blockedReasonSubtitle.value = 'EFECTO ACTIVO';
      } else if (details.reason === 'warningPending') {
        blockedReasonSubtitle.value = 'AVISO PENDIENTE';
      } else {
        blockedReasonSubtitle.value = '';
      }

      if (sabotageBlockedTimeout !== null) {
        clearTimeout(sabotageBlockedTimeout);
      }
      sabotageBlockedTimeout = setTimeout(() => {
        isSabotageBlockedActive.value = false;
        sabotageBlockedTimeout = null;
      }, 350);
    }
  },
);

const localImmunities = computed(() => gameState.value.battleState?.playerOneState?.immunities ?? []);

const activeImmunity = computed(() => localImmunities.value[0]);

const hasActiveImmunity = computed(() => !!activeImmunity.value);

const immunityText = computed(() => {
  if (!activeImmunity.value) return '';
  const sabotageName = activeImmunity.value.sabotage.toUpperCase();
  const seconds = (activeImmunity.value.remainingMs / 1000).toFixed(1);
  return `INMUNIDAD ${sabotageName} · ${seconds}s`;
});

const isLaunchPulseActive = ref(false);
const isLaunchConfirmationActive = ref(false);
const isTransmissionSentActive = ref(false);
const launchConfirmationText = ref('');

let launchPulseTimeout: ReturnType<typeof setTimeout> | null = null;
let launchConfirmationTimeout: ReturnType<typeof setTimeout> | null = null;
let transmissionSentTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => gameState.value.lastSabotageLaunchedDetails,
  (details) => {
    if (details && details.source === 'playerOne') {
      const sabotage = details.sabotage;

      // 1. Compresión/pulso del slot (120 ms)
      isLaunchPulseActive.value = true;
      if (launchPulseTimeout !== null) clearTimeout(launchPulseTimeout);
      launchPulseTimeout = setTimeout(() => {
        isLaunchPulseActive.value = false;
        launchPulseTimeout = null;
      }, 120);

      // 2. Confirmación de envío (400 ms)
      const textMap: Record<SabotageType, string> = {
        residuos: 'RESIDUOS ENVIADO',
        sobrecarga: 'SOBRECARGA ENVIADA',
        polaridad: 'POLARIDAD ENVIADA',
        interferencia: 'INTERFERENCIA ENVIADA',
      };
      launchConfirmationText.value = textMap[sabotage] || 'SABOTAJE ENVIADO';
      isLaunchConfirmationActive.value = true;
      if (launchConfirmationTimeout !== null) clearTimeout(launchConfirmationTimeout);
      launchConfirmationTimeout = setTimeout(() => {
        isLaunchConfirmationActive.value = false;
        launchConfirmationTimeout = null;
      }, 400);

      // 3. Micro-pulso del marco de OpponentMonitor (150 ms)
      if (details.target === 'playerTwo') {
        isTransmissionSentActive.value = true;
        if (transmissionSentTimeout !== null) clearTimeout(transmissionSentTimeout);
        transmissionSentTimeout = setTimeout(() => {
          isTransmissionSentActive.value = false;
          transmissionSentTimeout = null;
        }, 150);
      }
    }
  },
);

const gameResult = ref<GameResultSummary | null>(null);
const error = ref<string | null>(null);
let controller: PhaserGameController | null = null;

interface PendingMatchResultData {
  clientMatchId: string;
  playerId: string;
  score: number;
  linesCleared: number;
  durationMs: number;
  level: number;
  mode: GameMode;
  result: 'finished' | 'victory' | 'defeat' | 'draw';
  opponentProfile: string | null;
}

const pendingMatchResult = ref<PendingMatchResultData | null>(null);
setActiveResultHandler(() => Boolean(gameResult.value || pendingMatchResult.value));
const saveStatus = ref<'idle' | 'awaitingTag' | 'readyToSave' | 'saving' | 'saved' | 'failed' | 'error'>('idle');
const currentOperatorTag = ref<string | null>(getPlayerTag());
const isTagModalOpen = ref(false);
const tagModalCanCancel = ref(true);

function updateOperatorTagState(): void {
  currentOperatorTag.value = getPlayerTag();
}

// Idempotencia de envío de partidas
let currentClientMatchId = crypto.randomUUID();
const submittedMatchIdsSet = new Set<string>();

const onlineSession = shallowRef<OnlineGameSession | null>(null);
const isOnlineModalOpen = ref(false);
const onlineSessionStatus = ref<OnlineSessionStatus>('idle');
const onlineRematchRequests = ref<Set<WsParticipantRole>>(new Set());

const isOnlineRematchPending = computed(() => {
  if (gameMode.value !== 'online' || !onlineSession.value) return false;
  const myRole = onlineSession.value.role;
  return myRole ? onlineRematchRequests.value.has(myRole) : false;
});

const isOnlineOpponentRematchRequested = computed(() => {
  if (gameMode.value !== 'online' || !onlineSession.value) return false;
  const myRole = onlineSession.value.role;
  if (!myRole) return false;
  const opponentRole = myRole === 'playerOne' ? 'playerTwo' : 'playerOne';
  return onlineRematchRequests.value.has(opponentRole);
});

const isOnlineDisconnected = computed(() => {
  if (gameMode.value !== 'online' || !onlineSession.value) return false;
  return onlineSessionStatus.value === 'disconnected';
});

const isOpponentDisconnectedModalOpen = computed(() => {
  return gameMode.value === 'online' && isOnlineDisconnected.value && currentRouteName.value === 'battle';
});

function destroyOnlineSession(): void {
  if (onlineSession.value) {
    onlineSession.value.destroy();
    onlineSession.value = null;
  }
  isOnlineActive.value = false;
  onlineSessionStatus.value = 'idle';
  onlineRematchRequests.value = new Set();
}

function openOnlinePvPModal(): void {
  void audioManager.unlock();
  audioManager.playSfx('uiClick');
  destroyOnlineSession();
  const session = new OnlineGameSession();
  onlineSession.value = session;

  session.onStatusChange((status) => {
    onlineSessionStatus.value = status;
    onlineRematchRequests.value = new Set(session.rematchRequests);
    if (status === 'playing') {
      isOnlineActive.value = true;
      isOnlineModalOpen.value = false;
      gameResult.value = null;
      audioManager.playMusic('gameplay');
      pushRoute('battle', { online: '1' });
    }
  });

  session.onRematchRequested(() => {
    onlineRematchRequests.value = new Set(session.rematchRequests);
  });

  isOnlineModalOpen.value = true;
}

function handleStartCreateOnline(): void {
  if (onlineSession.value) {
    void onlineSession.value.createRoom().catch(() => {});
  }
}

function handleStartJoinOnline(code: string): void {
  if (onlineSession.value) {
    void onlineSession.value.joinRoom(code).catch(() => {});
  }
}

function handleCancelOnlineModal(): void {
  isOnlineModalOpen.value = false;
  destroyOnlineSession();
}

const rankingInitialMode = ref<'training' | 'battle'>('battle');

async function confirmAndSaveMatchResult(rawTag: string): Promise<void> {
  const normalizedTag = rawTag ? rawTag.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{3}$/.test(normalizedTag)) {
    return;
  }
  if (!pendingMatchResult.value) {
    return;
  }
  if (saveStatus.value === 'saving' || saveStatus.value === 'saved') {
    return;
  }

  const matchData = pendingMatchResult.value;
  if (submittedMatchIdsSet.has(matchData.clientMatchId)) {
    saveStatus.value = 'saved';
    return;
  }

  saveStatus.value = 'saving';
  submittedMatchIdsSet.add(matchData.clientMatchId);

  let payload: CreateMatchInput;
  if (matchData.mode === 'training') {
    payload = {
      clientMatchId: matchData.clientMatchId,
      playerId: matchData.playerId,
      playerName: normalizedTag,
      score: matchData.score,
      linesCleared: matchData.linesCleared,
      durationMs: matchData.durationMs,
      level: matchData.level,
      mode: 'training',
      result: 'finished',
      opponentProfile: null,
    };
  } else {
    payload = {
      clientMatchId: matchData.clientMatchId,
      playerId: matchData.playerId,
      playerName: normalizedTag,
      score: matchData.score,
      linesCleared: matchData.linesCleared,
      durationMs: matchData.durationMs,
      level: matchData.level,
      mode: 'battle',
      result: matchData.result as 'victory' | 'defeat' | 'draw',
      opponentProfile: matchData.opponentProfile || selectedBotProfile.value,
    };
  }

  try {
    await submitMatch(payload);

    // REQUISITO 7: Persistir tag localmente SOLO tras POST correcto
    setPlayerTag(normalizedTag);
    updateOperatorTagState();

    saveStatus.value = 'saved';

    // REQUISITO 9 & 20: Capturar modo y navegar a Ranking de ese modo
    const completedMode = matchData.mode;
    pendingMatchResult.value = null;
    if (completedMode === 'training' || completedMode === 'battle') {
      rankingInitialMode.value = completedMode;
    }
    replaceRoute('ranking');
  } catch {
    submittedMatchIdsSet.delete(matchData.clientMatchId);
    saveStatus.value = 'failed';
  }
}

function onStateUpdate(state: GamePresentationState): void {
  gameState.value = state;

  const isEngineGameOver = state.status === 'gameOver';
  const isBattleEnded = Boolean(state.battleState && state.battleState.status !== 'running');

  if (gameMode.value === 'online') {
    if (isEngineGameOver || isBattleEnded || onlineSession.value?.status === 'ended') {
      if (currentRouteName.value !== 'results') {
        const winner = state.battleState?.winner ?? onlineSession.value?.latestGameState?.winner ?? null;
        const role = onlineSession.value?.role;
        let title = 'PARTIDA FINALIZADA';
        let subtitle: string | undefined = undefined;

        if (winner === role) {
          title = 'VICTORIA';
          subtitle = 'Has dominado el combate online';
        } else if (winner === 'draw') {
          title = 'EMPATE';
          subtitle = 'Ambos tableros colapsaron simultáneamente';
        } else if (winner !== null) {
          title = 'DERROTA';
          subtitle = 'El rival ha dominado el combate online';
        }

        gameResult.value = {
          mode: 'online',
          title,
          subtitle,
          score: state.score,
          linesCleared: state.clearedLines,
          level: state.level,
          elapsedMs: state.elapsedMs,
          battleResult: state.battleState
            ? {
                status: state.battleState.status,
                winner: state.battleState.winner,
                step: state.battleState.step,
              }
            : undefined,
        };

        pendingMatchResult.value = null;
        saveStatus.value = 'idle';
        pushRoute('results');
      }
    }
    return;
  }

  if (!isDevDemo.value && (isEngineGameOver || isBattleEnded) && (currentRouteName.value === 'training' || currentRouteName.value === 'battle')) {
    let title = 'ENTRENAMIENTO FINALIZADO';
    let subtitle: string | undefined = undefined;
    let matchResultType: 'finished' | 'victory' | 'defeat' | 'draw' = 'finished';

    if (gameMode.value === 'battle' && state.battleState) {
      const winner = state.battleState.winner;
      if (winner === 'playerOne') {
        title = 'VICTORIA';
        subtitle = 'Has derrotado al rival autónomo';
        matchResultType = 'victory';
      } else if (winner === 'playerTwo') {
        title = 'DERROTA';
        subtitle = 'El rival ha dominado la batalla';
        matchResultType = 'defeat';
      } else if (winner === 'draw') {
        title = 'EMPATE';
        subtitle = 'Ambos tableros colapsaron simultáneamente';
        matchResultType = 'draw';
      }
    }

    const playerId = getOrCreatePlayerId();
    pendingMatchResult.value = {
      clientMatchId: currentClientMatchId,
      playerId,
      score: state.score,
      linesCleared: state.clearedLines,
      durationMs: state.elapsedMs,
      level: state.level,
      mode: gameMode.value,
      result: matchResultType,
      opponentProfile: gameMode.value === 'battle' ? selectedBotProfile.value : null,
    };

    gameResult.value = {
      mode: gameMode.value,
      title,
      subtitle,
      score: state.score,
      linesCleared: state.clearedLines,
      level: state.level,
      elapsedMs: state.elapsedMs,
      battleResult: state.battleState
        ? {
          status: state.battleState.status,
          winner: state.battleState.winner,
          step: state.battleState.step,
        }
        : undefined,
    };

    pushRoute('results');

    updateOperatorTagState();
    if (hasPlayerTag()) {
      saveStatus.value = 'idle';
    } else {
      saveStatus.value = 'awaitingTag';
    }
  }
}

function onControllerReady(c: PhaserGameController): void {
  controller = c;
}

function handleTagConfirmed(rawTag: string): void {
  setPlayerTag(rawTag);
  updateOperatorTagState();
  isTagModalOpen.value = false;
}

function handleTagCancelled(): void {
  isTagModalOpen.value = false;
}



function openTagModalFromSettings(): void {
  tagModalCanCancel.value = true;
  isTagModalOpen.value = true;
}

function selectMode(mode: GameMode, botProfile?: BotProfileId): void {
  if (botProfile) {
    selectedBotProfile.value = botProfile;
  }
  void audioManager.unlock();
  audioManager.playSfx('uiClick');
  audioManager.playMusic('gameplay');
  currentClientMatchId = crypto.randomUUID();
  saveStatus.value = 'idle';
  pendingMatchResult.value = null;
  matchSeed.value = generateMatchSeed();
  gameResult.value = null;
  pushRoute(mode);
}

function doReset(): void {
  audioManager.playSfx('uiClick');
  audioManager.restartMusic('gameplay');
  currentClientMatchId = crypto.randomUUID();
  saveStatus.value = 'idle';
  pendingMatchResult.value = null;
  if (controller) {
    controller.reset();
  }
}

function doTogglePause(): void {
  audioManager.playSfx('uiClick');
  if (gameMode.value === 'online' && onlineSession.value) {
    onlineSession.value.togglePause();
  } else {
    controller?.togglePause();
  }
}

async function doReplay(): Promise<void> {
  audioManager.playSfx('uiClick');
  if (gameMode.value === 'online' && onlineSession.value) {
    onlineSession.value.requestRematch();
    return;
  }
  audioManager.restartMusic('gameplay');
  currentClientMatchId = crypto.randomUUID();
  saveStatus.value = 'idle';
  pendingMatchResult.value = null;
  controller = null;
  gameResult.value = null;
  matchSeed.value = generateMatchSeed();
  gameState.value = {
    status: 'running',
    step: 0,
    elapsedMs: 0,
    nextPieces: [],
    heldPiece: null,
    score: 0,
    clearedLines: 0,
    combo: 0,
    backToBack: 0,
    combatEnergy: 0,
    storedSabotages: [],
    pendingGarbage: 0,
    activeEffects: [],
    level: 1,
    baseGravityCellsPerSecond: 1.0,
    activeGravityCellsPerSecond: 1.0,
  };

  const targetMode = gameMode.value;
  await nextTick();
  replaceRoute(targetMode);
}

function goToMenu(): void {
  destroyOnlineSession();
  audioManager.playSfx('uiClick');
  audioManager.playMusic('menu');
  controller = null;
  gameResult.value = null;
  pendingMatchResult.value = null;

  replaceRoute('home', {});
}

function returnToMenu(): void {
  destroyOnlineSession();
  audioManager.playSfx('uiClick');
  audioManager.playMusic('menu');
  pushRoute('home');
}

function openSettings(): void {
  audioManager.playSfx('uiClick');
  pushRoute('settings');
}

function openHistory(): void {
  audioManager.playSfx('uiClick');
  pushRoute('history');
}

function openRanking(): void {
  audioManager.playSfx('uiClick');
  rankingInitialMode.value = 'battle';
  pushRoute('ranking');
}

function openDevTools(): void {
  audioManager.playSfx('uiClick');
  pushRoute('dev-tools');
}
</script>

<template>
  <div class="app">
    <!-- Vista DEV aislada: SFX LAB (sin Phaser ni partida normal) -->
    <template v-if="isSfxLab && SfxLabComponent">
      <component :is="SfxLabComponent" />
    </template>

    <template v-else>
      <!-- Aviso de ancho insuficiente -->
      <div class="width-warning" data-testid="width-warning" role="status">
        Rautfall Tactical está pensado para escritorio o portátil con más ancho de pantalla.
        La experiencia puede resultar incómoda por debajo de 760 px.
      </div>

      <!-- Menú Principal -->
      <ModeSelector
        v-if="currentRouteName === 'home'"
        @select-mode="selectMode"
        @open-online-pvp="openOnlinePvPModal"
        @open-settings="openSettings"
        @open-history="openHistory"
        @open-ranking="openRanking"
        @open-dev-tools="openDevTools"
      />

      <!-- Pantalla DEV Tools (solo en desarrollo) -->
      <component
        :is="DevLauncherScreenComponent"
        v-else-if="currentRouteName === 'dev-tools' && DevLauncherScreenComponent"
        @back-to-menu="goToMenu"
      />

      <!-- Pantalla de Configuración -->
      <SettingsScreen
        v-else-if="currentRouteName === 'settings'"
        @back="returnToMenu"
        @change-tag="openTagModalFromSettings"
      />

      <!-- Pantalla de Historial -->
      <HistoryScreen v-else-if="currentRouteName === 'history'" @back-to-menu="returnToMenu" />

      <!-- Pantalla de Ranking -->
      <RankingScreen
        v-else-if="currentRouteName === 'ranking'"
        :initial-mode="rankingInitialMode"
        @back-to-menu="returnToMenu"
      />

      <!-- Pantalla de Juego ('playing' o 'results') -->
      <div v-else class="tactical-chassis" :class="{ 'tactical-chassis--sudden-death': isSuddenDeathActive }">
        <!-- Panelización de chapas estructurales del chasis masivo -->
        <div class="chassis-armour-plates" aria-hidden="true">
          <div class="plate-section plate-section--top">
            <div class="plate-joint-line"></div>
          </div>
          <div class="plate-section plate-section--main-grid">
            <div class="plate-panel plate-panel--left"></div>
            <div class="plate-joint-vertical"></div>
            <div class="plate-panel plate-panel--center"></div>
            <div class="plate-joint-vertical plate-joint-vertical--worn"></div>
            <div class="plate-panel plate-panel--right"></div>
          </div>
          <!-- Remaches mecánicos en juntas principales del chasis -->
          <div class="chassis-rivet chassis-rivet--tl"></div>
          <div class="chassis-rivet chassis-rivet--tr chassis-rivet--worn"></div>
          <div class="chassis-rivet chassis-rivet--bl chassis-rivet--worn"></div>
          <div class="chassis-rivet chassis-rivet--br"></div>
          <div class="chassis-rivet chassis-rivet--top-l"></div>
          <div class="chassis-rivet chassis-rivet--top-r"></div>
          <div class="chassis-rivet chassis-rivet--bot-l"></div>
          <div class="chassis-rivet chassis-rivet--bot-r"></div>
          <span class="chassis-stencil-mark chassis-stencil-mark--main">RF-07 · CICLO MTN. 12</span>
          <span class="chassis-stencil-mark chassis-stencil-mark--insp">INSP. ✓ OK</span>
          <span class="chassis-stencil-mark chassis-stencil-mark--ref">REF. A-2</span>
        </div>

        <!-- Esquinas estructurales remachadas (Asset Kit) -->
        <div class="rf-asset-corner-reinforcement rf-asset-corner--tl" aria-hidden="true"></div>
        <div class="rf-asset-corner-reinforcement rf-asset-corner--tr" aria-hidden="true"></div>
        <div class="rf-asset-corner-reinforcement rf-asset-corner--bl" aria-hidden="true"></div>
        <div class="rf-asset-corner-reinforcement rf-asset-corner--br" aria-hidden="true"></div>

        <header class="app-header">
          <div class="header-badge-title">
            <h1 class="app-title">RAUTFALL</h1>
          </div>
          <div class="header-controls">
            <button
              type="button"
              class="rf-btn-tactical rf-btn-utility music-toggle-btn"
              data-testid="music-toggle-button"
              :data-music-enabled="isMusicEnabled"
              :aria-label="isMusicEnabled ? 'Desactivar música' : 'Activar música'"
              @click="toggleMusic"
            >
              <svg class="btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
              </svg>
              {{ isMusicEnabled ? 'MÚSICA: ON' : 'MÚSICA: OFF' }}
            </button>
            <button
              type="button"
              class="rf-btn-tactical rf-btn-utility sfx-toggle-btn"
              data-testid="sfx-toggle-button"
              :data-sfx-enabled="isSfxEnabled"
              :aria-label="isSfxEnabled ? 'Desactivar efectos' : 'Activar efectos'"
              @click="toggleSfx"
            >
              <svg class="btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path fill="currentColor" d="M3 9v6h4l5 5V4L8 9H3Z" />
              </svg>
              {{ isSfxEnabled ? 'SFX: ON' : 'SFX: OFF' }}
            </button>
            <button
              type="button"
              class="rf-btn-tactical rf-btn-utility exit-menu-btn"
              data-testid="exit-to-menu-button"
              @click="goToMenu"
            >
              Menú
            </button>
          </div>
        </header>

        <div v-if="isWarningDemo" class="dev-warning-demo-info" data-testid="warning-demo-info">
          <span class="warning-demo-tag">WARNING FX DEMO</span>
          <span class="warning-demo-controls">1 SOBRECARGA · 2 POLARIDAD · 3 INTERFERENCIA · 0 RESET</span>
        </div>

        <div v-if="error" class="error">
          <strong>Error:</strong> {{ error }}
        </div>

        <div class="game-layout" :class="`game-layout--${gameMode}`">
          <!-- Elementos accesibles ocultos para aserciones de estado en e2e -->
          <span class="sr-only" data-testid="session-status">{{ gameState.status }}</span>
          <span class="sr-only" data-testid="session-step">{{ gameState.step }}</span>

          <!-- UNIDAD PRINCIPAL INTEGRADA: HOLD + BOARD EN EL MISMO CHASIS -->
          <div class="main-board-unit" data-testid="own-board-unit">
            <div class="board-rivet board-rivet--tl"></div>
            <div class="board-rivet board-rivet--tr"></div>
            <div class="board-rivet board-rivet--bl"></div>
            <div class="board-rivet board-rivet--br"></div>

            <!-- Bahía mecánica de HOLD integrada a la izquierda -->
            <div class="integrated-hold-bay" data-testid="hold-column">
              <HeldPiecePreview :held-piece="gameState.heldPiece" />
              <div class="telemetry-plate-box">
                <div class="hazard-stripe-corner" aria-hidden="true"></div>
                <div class="telemetry-text-labels">
                  <span class="unit-code">UNIT B-07</span>
                  <span class="sys-code">SYS. 44A</span>
                  <span class="pwr-code">PWR. 220V</span>
                </div>
                <div class="vent-grille-bottom" aria-hidden="true"></div>
              </div>
            </div>

            <!-- Tablero Canvas Principal -->
            <div class="integrated-board-column" data-testid="own-board-column">
              <div
                class="board-bezel"
                :class="[
                  `board-bezel--${gameState.status}`,
                  {
                    'board-bezel--warning-sobrecarga': hasSobrecargaWarning,
                    'board-bezel--warning-polaridad': hasPolaridadWarning,
                    'board-bezel--warning-interferencia': hasInterferenciaWarning,
                    'board-bezel--active-sobrecarga': hasSobrecargaActive,
                    'board-bezel--active-polaridad': hasPolaridadActive,
                    'board-bezel--active-interferencia': hasInterferenciaActive,
                    'board-bezel--sabotage-blocked': isSabotageBlockedActive,
                    'board-bezel--immunity-active': hasActiveImmunity,
                  },
                ]"
                :data-warning-sobrecarga="hasSobrecargaWarning"
                :data-warning-polaridad="hasPolaridadWarning"
                :data-warning-interferencia="hasInterferenciaWarning"
                :data-active-sobrecarga="hasSobrecargaActive"
                :data-active-polaridad="hasPolaridadActive"
                :data-active-interferencia="hasInterferenciaActive"
                :data-sabotage-blocked="isSabotageBlockedActive"
                :data-immunity-active="hasActiveImmunity"
                data-testid="board-bezel"
              >
                <!-- Microplaca transient de SABOTAJE BLOQUEADO (350 ms) -->
                <div
                  v-if="isSabotageBlockedActive"
                  class="board-bezel-blocked-plate"
                  data-testid="sabotage-blocked-indicator"
                  aria-hidden="true"
                >
                  <span class="blocked-plate-title">SABOTAJE BLOQUEADO</span>
                  <span v-if="blockedReasonSubtitle" class="blocked-plate-subtitle">{{ blockedReasonSubtitle }}</span>
                </div>

                <!-- Microplaca de INMUNIDAD ACTIVA -->
                <div
                  v-if="hasActiveImmunity && !hasSobrecargaActive && !hasPolaridadActive && !hasInterferenciaActive"
                  class="board-bezel-immunity-plate"
                  data-testid="immunity-active-indicator"
                  aria-hidden="true"
                >
                  <span class="immunity-plate-dot">●</span>
                  <span class="immunity-plate-text">{{ immunityText }}</span>
                </div>

                <!-- Microplaca unificada de pre-aviso (warning 750 ms) de sabotaje -->
                <div
                  v-if="hasSobrecargaWarning || hasPolaridadWarning || hasInterferenciaWarning"
                  class="board-bezel-warning-plate"
                  :class="{
                    'board-bezel-warning-plate--sobrecarga': hasSobrecargaWarning,
                    'board-bezel-warning-plate--polaridad': hasPolaridadWarning,
                    'board-bezel-warning-plate--interferencia': hasInterferenciaWarning,
                  }"
                  :data-testid="hasPolaridadWarning ? 'polarity-warning-indicator' : 'sabotage-warning-plate'"
                  aria-hidden="true"
                >
                  <template v-if="hasSobrecargaWarning">
                    <span class="warning-plate-text">SOBRECARGA</span>
                  </template>

                  <template v-else-if="hasPolaridadWarning">
                    <span class="warning-plate-arrow warning-plate-arrow--left">►</span>
                    <span class="warning-plate-text">INVERSIÓN HZ</span>
                    <span class="warning-plate-arrow warning-plate-arrow--right">◄</span>
                  </template>

                  <template v-else-if="hasInterferenciaWarning">
                    <span class="warning-plate-text">INTERFERENCIA</span>
                  </template>
                </div>

                <!-- Microplaca de estado ACTIVO de sabotaje (Sobrecarga) -->
                <div
                  v-if="hasSobrecargaActive"
                  class="board-bezel-active-plate board-bezel-active-plate--sobrecarga"
                  data-testid="sobrecarga-active-indicator"
                  aria-hidden="true"
                >
                  <span class="active-plate-text">SOBRECARGA {{ sobrecargaCountdownText }}</span>
                </div>

                <!-- Microplaca de estado ACTIVO de sabotaje (Polaridad) -->
                <div
                  v-if="hasPolaridadActive"
                  class="board-bezel-active-plate board-bezel-active-plate--polaridad"
                  data-testid="polarity-active-indicator"
                  aria-hidden="true"
                >
                  <span class="active-plate-arrow active-plate-arrow--left">►</span>
                  <span class="active-plate-text">POLARIDAD · {{ polaridadCountdownText }}</span>
                  <span class="active-plate-arrow active-plate-arrow--right">◄</span>
                </div>

                <!-- Microplaca de estado ACTIVO de sabotaje (Interferencia) -->
                <div
                  v-if="hasInterferenciaActive"
                  class="board-bezel-active-plate board-bezel-active-plate--interferencia"
                  data-testid="interferencia-active-indicator"
                  aria-hidden="true"
                >
                  <span class="active-plate-text">INTERFERENCIA · {{ interferenciaCountdownText }}</span>
                </div>

                <!-- Indicadores/Brackets laterales de inversión de Polaridad -->
                <div
                  v-if="hasPolaridadActive"
                  class="board-bezel-polarity-bracket board-bezel-polarity-bracket--left"
                  :class="{ 'polarity-bracket--pulse': isPolaridadPulseActive }"
                  data-testid="polarity-left-bracket"
                  aria-hidden="true"
                >
                  <span class="bracket-symbol">►</span>
                </div>
                <div
                  v-if="hasPolaridadActive"
                  class="board-bezel-polarity-bracket board-bezel-polarity-bracket--right"
                  :class="{ 'polarity-bracket--pulse': isPolaridadPulseActive }"
                  data-testid="polarity-right-bracket"
                  aria-hidden="true"
                >
                  <span class="bracket-symbol">◄</span>
                </div>

                <div class="canvas-wrapper">
                  <GameCanvas
                    v-if="isCanvasMounted"
                    :key="`${gameMode}-${matchSeed}`"
                    :mode="gameMode"
                    :bot-profile="selectedBotProfile"
                    :seed="matchSeed"
                    :online-session="onlineSession"
                    :on-state-update="onStateUpdate"
                    @controller-ready="onControllerReady"
                  />
                  <PauseShutter :status="gameState.status" :can-resume="gameState.canResume ?? true" />
                </div>
                <div class="board-exhaust-vent" aria-hidden="true">
                  <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- COLUMNA 3: NEXT + VENTILACIÓN CENTRAL -->
          <div class="column-next-assembly">
            <div class="next-panel-box">
              <NextPiecesPreview :next-pieces="gameState.nextPieces" />
            </div>
            <div class="center-vent-module">
              <div class="vent-slots">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          </div>

          <!-- COLUMNA 4: INSTRUMENTACIÓN CENTRAL -->
          <div class="column-instrumentation" data-testid="tactical-column">
            <div class="instrumentation-console rf-panel">
              <CombatStatusPanel :combat-energy="gameState.combatEnergy" />
              <ScorePanel
                :score="gameState.score"
                :combo="gameState.combo"
                :back-to-back="gameState.backToBack"
                :combat-energy="gameState.combatEnergy"
                :level="gameState.level"
                :active-gravity-cells-per-second="gameState.activeGravityCellsPerSecond"
              />
              <AttackSlotsPanel
                :stored-sabotages="gameState.storedSabotages"
                :pending-garbage="gameState.pendingGarbage"
                :active-effects="gameState.activeEffects"
                :is-launch-pulse-active="isLaunchPulseActive"
                :is-launch-confirmation-active="isLaunchConfirmationActive"
                :launch-confirmation-text="launchConfirmationText"
              />
            </div>
            <div class="instrumentation-actions">
              <button
                type="button"
                class="rf-btn-tactical rf-btn-sm"
                :disabled="gameState.status === 'gameOver' || (gameState.status === 'paused' && gameState.canResume === false)"
                data-testid="pause-toggle"
                @click="doTogglePause"
              >
                {{ gameState.status === 'paused' ? (gameState.canResume === false ? 'Pausado por rival' : 'Reanudar') : 'Pausar' }}
              </button>
              <button
                v-if="gameMode !== 'online'"
                type="button"
                class="rf-btn-tactical rf-btn-destructive rf-btn-sm"
                data-testid="reset-button"
                @click="doReset"
              >
                Reiniciar
              </button>
            </div>
          </div>

          <!-- COLUMNA 5: OPPONENT MONITOR -->
          <div v-if="gameMode === 'battle' || gameMode === 'online'" class="column-opponent" data-testid="opponent-column">
            <OpponentMonitor
              :mode="gameMode"
              :player-two="gameState.battleState?.playerTwo ?? null"
              :battle-status="gameState.battleState?.status ?? null"
              :winner="gameState.battleState?.winner ?? null"
              :is-paused="gameState.status === 'paused'"
              :is-transmission-sent-active="isTransmissionSentActive"
            />
          </div>
          <div v-else class="sr-only" data-testid="opponent-column">
            <span data-testid="standby-badge">SIN OPONENTE</span>
            <span data-testid="training-telemetry">ENTRENAMIENTO</span>
          </div>
        </div>

        <!-- Panel de Telemetría DEV — Reubicado y visible solo con ?debug-panel=1 -->
        <div
          v-if="isDevDebugPanel"
          class="dev-telemetry-inspector rf-panel rf-riveted-panel"
          data-testid="battle-demo-dev-panel"
        >
          <div class="session-header">
            <span class="panel-label">DEV — TELEMETRÍA TÉCNICA E INSPECTOR DE BATALLA</span>
          </div>
          <div class="session-grid">
            <div class="session-item">
              <span class="session-label">Session Status</span>
              <span class="session-value" :class="gameState.status">{{ gameState.status }}</span>
            </div>
            <div class="session-item">
              <span class="session-label">Session Step</span>
              <span class="session-value" data-testid="dev-session-step">{{ gameState.step }}</span>
            </div>
            <div class="session-item">
              <span class="session-label">Tiempo (ms)</span>
              <span class="session-value">{{ gameState.elapsedMs }}</span>
            </div>
            <div v-if="gameState.battleState?.botDevDiagnostic?.sessionGeneration" class="session-item">
              <span class="session-label">Session Gen</span>
              <span class="session-value" data-testid="bot-session-generation">{{ gameState.battleState.botDevDiagnostic.sessionGeneration }}</span>
            </div>
            <template v-if="gameState.battleState">
              <div class="session-item">
                <span class="session-label">Battle Status</span>
                <span class="session-value" data-testid="battle-status">{{ gameState.battleState.status }}</span>
              </div>
              <div class="session-item">
                <span class="session-label">Battle Step</span>
                <span class="session-value" data-testid="battle-step">{{ gameState.battleState.step }}</span>
              </div>
              <div class="session-item">
                <span class="session-label">Ganador</span>
                <span class="session-value" data-testid="battle-winner">{{ gameState.battleState.winner ?? 'NINGUNO'
                  }}</span>
              </div>
              <div class="session-item">
                <span class="session-label">Sudden Death</span>
                <span class="session-value" data-testid="sudden-death-phase">{{ gameState.battleState.suddenDeathPhase ?? 'none' }}</span>
              </div>
              <div class="session-item">
                <span class="session-label">P2 Status</span>
                <span class="session-value" data-testid="p2-status">{{ gameState.battleState.playerTwo.status }}</span>
              </div>
              <div class="session-item">
                <span class="session-label">P2 Lvl / Energy</span>
                <span class="session-value" data-testid="p2-level-energy">Lvl {{ gameState.battleState.playerTwo.level
                  }} / {{ gameState.battleState.playerTwo.combatEnergy }} E</span>
              </div>
              <div class="session-item">
                <span class="session-label">P2 Sabotajes</span>
                <span class="session-value" data-testid="p2-sabotages">{{
                  gameState.battleState.playerTwo.storedSabotages.join(', ') || 'VACÍO' }}</span>
              </div>
              <div v-if="gameState.battleState.lastSabotageRouted" class="session-item">
                <span class="session-label">Último Enrutado</span>
                <span class="session-value" data-testid="last-sabotage-routed">{{
                  gameState.battleState.lastSabotageRouted }}</span>
              </div>
              <div v-if="gameState.battleState.lastSabotageBlocked" class="session-item">
                <span class="session-label">Último Bloqueado</span>
                <span class="session-value" data-testid="last-sabotage-blocked">{{
                  gameState.battleState.lastSabotageBlocked }}</span>
              </div>
              <template v-if="gameState.battleState.botDevDiagnostic">
                <div class="session-item">
                  <span class="session-label">P2 Piece ID</span>
                  <span class="session-value" data-testid="player-two-piece-id">{{
                    gameState.battleState.botDevDiagnostic.pieceId ?? 'NULL' }}</span>
                </div>
                <div class="session-item">
                  <span class="session-label">P2 X / Y / MinY</span>
                  <span class="session-value">
                    X:<span data-testid="player-two-x">{{ gameState.battleState.botDevDiagnostic.x ?? '-' }}</span>
                    Y:<span data-testid="player-two-y">{{ gameState.battleState.botDevDiagnostic.y ?? '-' }}</span>
                    MinY:<span data-testid="player-two-min-cell-y">{{ gameState.battleState.botDevDiagnostic.minCellY ??
                      '-' }}</span>
                  </span>
                </div>
                <div class="session-item">
                  <span class="session-label">P2 Orient / BoardCells</span>
                  <span class="session-value">
                    O:<span data-testid="player-two-orientation">{{ gameState.battleState.botDevDiagnostic.orientation
                      ?? '-' }}</span>
                    Cells:<span data-testid="player-two-board-cell-count">{{
                      gameState.battleState.botDevDiagnostic.boardCellCount }}</span>
                  </span>
                </div>
                <div class="session-item">
                  <span class="session-label">Bot Phase</span>
                  <span class="session-value" data-testid="bot-phase">{{ gameState.battleState.botDevDiagnostic.phase
                    }}</span>
                </div>
                <div class="session-item">
                  <span class="session-label">Timers (React/Int/Drop)</span>
                  <span class="session-value">
                    <span data-testid="bot-reaction-steps-remaining">{{
                      gameState.battleState.botDevDiagnostic.reactionStepsRemaining }}</span> /
                    <span data-testid="bot-action-interval-steps-remaining">{{
                      gameState.battleState.botDevDiagnostic.actionIntervalStepsRemaining }}</span> /
                    <span data-testid="bot-hard-drop-delay-steps-remaining">{{
                      gameState.battleState.botDevDiagnostic.hardDropDelayStepsRemaining }}</span>
                  </span>
                </div>
                <div class="session-item">
                  <span class="session-label">Plan Act/Len</span>
                  <span class="session-value">
                    Idx:<span data-testid="bot-action-index">{{ gameState.battleState.botDevDiagnostic.actionIndex
                      }}</span>
                    Act:<span data-testid="bot-current-action">{{ gameState.battleState.botDevDiagnostic.currentAction
                      ?? 'NULL' }}</span>
                    Len:<span data-testid="bot-plan-length">{{ gameState.battleState.botDevDiagnostic.planLength
                      }}</span>
                  </span>
                </div>
                <div class="session-item">
                  <span class="session-label">Last Action / Step</span>
                  <span class="session-value">
                    Act:<span data-testid="bot-last-action">{{ gameState.battleState.botDevDiagnostic.lastAction
                      }}</span>
                    Step:<span data-testid="bot-last-action-step">{{
                      gameState.battleState.botDevDiagnostic.lastActionStep }}</span>
                  </span>
                </div>
                <div class="session-item">
                  <span class="session-label">HD Steps / MaxBurst</span>
                  <span class="session-value">
                    HD:<span data-testid="bot-hard-drop-phase-step-count">{{
                      gameState.battleState.botDevDiagnostic.hardDropPhaseStepCount ?? 0 }}</span>
                    Burst:<span data-testid="bot-max-actions-in-single-step">{{
                      gameState.battleState.botDevDiagnostic.maxActionsInSingleStep ?? 0 }}</span>
                  </span>
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Modal de Resultados cuando currentRouteName === 'results' -->
        <ResultsModal
          v-if="currentRouteName === 'results' && gameResult"
          :result="gameResult"
          :save-status="saveStatus"
          :player-tag="currentOperatorTag"
          :rematch-pending="isOnlineRematchPending"
          :opponent-requested-rematch="isOnlineOpponentRematchRequested"
          :is-disconnected="isOnlineDisconnected"
          @replay="doReplay"
          @main-menu="goToMenu"
          @confirm-save="confirmAndSaveMatchResult"
        />

        <!-- Modal bloqueante de Desconexión del Rival durante partida PvP Online -->
        <OpponentDisconnectedModal
          v-if="isOpponentDisconnectedModalOpen"
          @main-menu="goToMenu"
        />
      </div>

      <!-- Modal / Flujo de Tag de Operador -->
      <OperatorTagModal
        :is-open="isTagModalOpen"
        :can-cancel="tagModalCanCancel"
        :initial-tag="currentOperatorTag || ''"
        @confirm="handleTagConfirmed"
        @cancel="handleTagCancelled"
      />

      <!-- Modal de Sala PvP Online -->
      <OnlineRoomModal
        :is-open="isOnlineModalOpen"
        :session="onlineSession"
        @start-create="handleStartCreateOnline"
        @start-join="handleStartJoinOnline"
        @cancel="handleCancelOnlineModal"
      />

      <!-- Popup Industrial de Activación de Audio -->
      <AudioActivationModal
        v-if="isAudioModalOpen"
        :is-initializing="isAudioInitializing"
        :error="audioInitError"
        @initialize="handleInitializeAudio"
        @keep-silent="handleKeepSilentAudio"
      />
    </template>
  </div>
</template>

<style>
html,
body,
#app {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #090a0c;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background: #090a0c;
}

/* Carcasa general: Consola monolithic ensamblada con chapas estructuradas que ocupa el 100% del viewport */
.tactical-chassis {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: radial-gradient(ellipse at 50% 30%, #242629 0%, #17181b 65%, #0d0e10 100%);
  border: 6px solid #383a42;
  outline: 2px solid #090a0b;
  outline-offset: -8px;
  box-shadow:
    inset 0 4px 0 rgba(255, 255, 255, 0.18),
    inset 0 -6px 16px rgba(0, 0, 0, 0.95);
  padding: 12px 18px;
  box-sizing: border-box;
  overflow: hidden;
}

/* Capa de Panelización de Chapas Estructurales del Chasis */
.chassis-armour-plates {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  display: flex;
  flex-direction: column;
}

/* Material base de las grandes placas (dark-steel-corten.webp).
   IMPORTANTE: opacidad simple, NO mix-blend-mode — se probó soft-light/
   overlay/screen/multiply contra el tono real de las placas y todos
   quedaban invisibles o lavaban la diferencia tonal entre ellas; con
   alfa plano el grano se ve y cada placa conserva su propio tono.
   Cada zona (top/left/center/right) tiene su PROPIA instancia — mismo
   nivel de intensidad aprobado, pero distinta posición/escala/opacidad
   para que no se lea como el mismo material clonado 4 veces. */

/* Marcas técnicas discretas (3 en total en todo el viewport, dentro del
   rango de 2-4 permitido): numeración stencil, marca de inspección y
   referencia de montaje. Muy pequeñas, muy baja opacidad. */
.chassis-stencil-mark {
  position: absolute;
  font-family: monospace;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: rgba(190, 194, 200, 0.4);
  white-space: nowrap;
}

.chassis-stencil-mark--main {
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
}

.chassis-stencil-mark--insp {
  top: 16px;
  left: 66px;
  font-size: 0.56rem;
  color: rgba(190, 194, 200, 0.38);
}

.chassis-stencil-mark--ref {
  bottom: 9px;
  right: 70px;
  font-size: 0.56rem;
  color: rgba(190, 194, 200, 0.36);
}

.plate-section--top {
  height: 54px;
  background:
    radial-gradient(ellipse 40% 130% at 92% 50%, rgba(0, 0, 0, 0.22) 0%, transparent 70%),
    linear-gradient(180deg, #2b2d33 0%, #191a1e 100%);
  border-bottom: 2px solid #090a0c;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 3px 8px rgba(0, 0, 0, 0.9);
  position: relative;
}

.plate-section--top::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/dark-steel-corten.webp');
  background-position: 0 0;
  background-size: 240px 240px;
  background-repeat: repeat;
  opacity: 0.34;
  pointer-events: none;
}

.plate-section--top::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 92px;
  width: 7px;
  height: 4px;
  background: linear-gradient(180deg, #a8adb4 0%, #6a6f77 100%);
  opacity: 0.46;
  border-radius: 1px;
  clip-path: polygon(10% 0%, 100% 15%, 85% 100%, 0% 80%);
}

.plate-joint-line {
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.3) 45%, rgba(255, 255, 255, 0.1) 100%);
}

.plate-section--main-grid {
  flex: 1;
  display: flex;
  background: #111215;
}

.plate-panel {
  flex: 1;
  position: relative;
}

/* Placa izquierda: tono ligeramente más frío + óxido localizado en la
   esquina inferior + desgaste de borde superior-izquierdo. Diagonal base
   suavizada (menos "haz de luz", más material). */
.plate-panel--left {
  flex: 0 0 32%;
  background:
    radial-gradient(ellipse 12% 9% at 4% 6%, rgba(198, 202, 208, 0.1) 0%, transparent 100%),
    radial-gradient(ellipse 10% 7% at 12% 91%, rgba(92, 42, 24, 0.38) 0%, transparent 100%),
    radial-gradient(ellipse 45% 35% at 78% 12%, rgba(255, 255, 255, 0.035) 0%, transparent 65%),
    linear-gradient(135deg, #2a2d33 0%, #1d1f24 35%, #191a1e 65%, #14151a 100%);
}

.plate-panel--left::before {
  content: '';
  position: absolute;
  top: 10px;
  right: -1px;
  width: 6px;
  height: 8px;
  background: linear-gradient(135deg, #9aa0a8 0%, #565a61 100%);
  opacity: 0.42;
  clip-path: polygon(0% 20%, 80% 0%, 100% 70%, 30% 100%);
}

.plate-panel--left::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(112deg, transparent 22%, rgba(255, 255, 255, 0.14) 22.4%, transparent 23%),
    linear-gradient(96deg, transparent 61%, rgba(255, 255, 255, 0.11) 61.5%, transparent 62.4%),
    linear-gradient(140deg, transparent 79%, rgba(0, 0, 0, 0.5) 79.6%, transparent 80.6%),
    url('/assets/industrial-kit/dark-steel-corten.webp') 40px 10px / 260px 260px repeat;
  opacity: 0.42;
  pointer-events: none;
}

/* Placa central: la más neutra/mate — apenas un contacto de sombra abajo,
   un highlight muy leve arriba y un toque de óxido muy contenido justo en
   la unión inferior (donde la chapa hace contacto con el marco). */
.plate-panel--center {
  flex: 1;
  background:
    radial-gradient(ellipse 12% 4% at 50% 99%, rgba(92, 42, 24, 0.36) 0%, transparent 100%),
    radial-gradient(ellipse 70% 50% at 50% 100%, rgba(0, 0, 0, 0.3) 0%, transparent 70%),
    radial-gradient(ellipse 45% 30% at 30% 18%, rgba(255, 255, 255, 0.03) 0%, transparent 60%),
    linear-gradient(180deg, #1a1b1f 0%, #0a0b0c 100%);
}

/* Instancia propia de textura, la más mate de las 3: tile más grande +
   menor opacidad que left/right = grano menos marcado. */
.plate-panel--center::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/dark-steel-corten.webp');
  background-position: 70px 30px;
  background-size: 320px 320px;
  background-repeat: repeat;
  opacity: 0.3;
  pointer-events: none;
}

/* Placa derecha: algo más de desgaste que la izquierda (óxido más marcado
   + abrasión puntual + roce en la esquina inferior), diagonal suavizada. */
.plate-panel--right {
  flex: 0 0 36%;
  background:
    radial-gradient(ellipse 18% 12% at 95% 92%, rgba(198, 202, 208, 0.08) 0%, transparent 100%),
    radial-gradient(ellipse 10% 7% at 88% 93%, rgba(139, 58, 27, 0.4) 0%, transparent 100%),
    radial-gradient(ellipse 50% 35% at 25% 10%, rgba(255, 255, 255, 0.04) 0%, transparent 60%),
    linear-gradient(225deg, #24262b 0%, #1b1c20 35%, #171820 65%, #0f1013 100%);
}

.plate-panel--right::before {
  content: '';
  position: absolute;
  bottom: 14px;
  left: -1px;
  width: 6px;
  height: 7px;
  background: linear-gradient(135deg, #9aa0a8 0%, #565a61 100%);
  opacity: 0.42;
  clip-path: polygon(15% 0%, 100% 10%, 85% 100%, 0% 75%);
}

.plate-panel--right::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(68deg, transparent 31%, rgba(0, 0, 0, 0.6) 31.5%, transparent 32.3%),
    linear-gradient(154deg, transparent 66%, rgba(255, 255, 255, 0.12) 66.4%, transparent 67.5%),
    radial-gradient(circle 4px at 85% 32%, rgba(0, 0, 0, 0.65) 0%, transparent 100%),
    radial-gradient(circle 3px at 40% 70%, rgba(92, 42, 24, 0.55) 0%, transparent 100%),
    url('/assets/industrial-kit/dark-steel-corten.webp') 220px 140px / 300px 300px repeat;
  opacity: 0.4;
  pointer-events: none;
}

.plate-joint-vertical {
  width: 3px;
  background: #060708;
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.1),
    inset -1px 0 0 rgba(0, 0, 0, 0.5),
    1px 0 4px rgba(0, 0, 0, 0.95);
}

/* Una de las dos juntas verticales con algo más de suciedad/óxido en el
   borde para que no sean idénticas (§5: "no todas iguales"). */
.plate-joint-vertical--worn {
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.06),
    inset -1px 0 0 rgba(139, 58, 27, 0.68),
    0 0 5px 1px rgba(92, 42, 24, 0.38),
    1px 0 4px rgba(0, 0, 0, 0.95);
}

.chassis-rivet {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #8a8c95 0%, #4a4c52 50%, #18191c 100%);
  /* Halo de suciedad oscuro y difuso (no glow: sin color saturado, solo sombra) +
     sombra de contacto, para que el remache tenga contexto sobre la chapa. */
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 0 7px 3px rgba(0, 0, 0, 0.45);
  z-index: 2;
}

/* Solo 2 de los 8 remaches con desgaste de recubrimiento/óxido leve
   alrededor (§4/§3): ni todos ni ninguno, para que se lea orgánico. */
.chassis-rivet--worn {
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 0 7px 3px rgba(0, 0, 0, 0.45),
    0 0 11px 4px rgba(92, 42, 24, 0.42);
}

.chassis-rivet--tl {
  top: 12px;
  left: 14px;
}

.chassis-rivet--tr {
  top: 12px;
  right: 14px;
}

.chassis-rivet--bl {
  bottom: 12px;
  left: 14px;
}

.chassis-rivet--br {
  bottom: 12px;
  right: 14px;
}

.chassis-rivet--top-l {
  top: 12px;
  left: 32%;
}

.chassis-rivet--top-r {
  top: 12px;
  right: 36%;
}

.chassis-rivet--bot-l {
  bottom: 12px;
  left: 32%;
}

.chassis-rivet--bot-r {
  bottom: 12px;
  right: 36%;
}

.tactical-chassis--sudden-death {
  animation: rf-emergency-alert 1.5s infinite;
  border-color: var(--rf-color-red, #e74c3c);
}

/* Cabecera: placa estructural integrada en la carcasa */
.app-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 26px 8px;
  margin-bottom: 10px;
  border-bottom: 2px solid #2a2c30;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
}

.header-badge-title {
  display: flex;
  align-items: center;
  /* Centra RAUTFALL dentro de la placa (antes había "B -" + título en
     fila; sin el prefijo, un min-width preserva el ancho/dimensiones
     de la placa en vez de encogerse al nuevo contenido, más corto). */
  justify-content: center;
  min-width: 130px;
  background: linear-gradient(180deg, #2c2d33 0%, #1a1b1e 100%);
  border: 2px solid #3a3c44;
  border-radius: 4px;
  padding: 4px 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(0, 0, 0, 0.8);
}

.app-title {
  /* Placa de identificación compacta (Tarea 0031): mismo apellido
     tipográfico que el logo del menú (Oswald 700, grafito/acero mate),
     pero a tamaño de marca de chasis, no de logo protagonista — sin el
     bisel de dos capas ni los acentos de óxido del menú. */
  font-family: 'Oswald', sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
  /* Microcorrección de brillo: highlight frontal más apagado y menos
     contraste entre extremos del degradado (bisel/relieve más plano) —
     más grafito, menos metal pulido. Mismo tamaño/posición/tracking. */
  background: linear-gradient(135deg, #919598 0%, #696b6e 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  flex-shrink: 0;
  display: inline-block;
}

/* Error */
.error {
  background: #251617;
  color: var(--rf-color-red, #e74c3c);
  padding: 0.75rem;
  border-radius: var(--rf-radius-md, 6px);
  margin-bottom: 0.75rem;
  font-family: monospace;
  border: 1px solid var(--rf-color-red, #e74c3c);
}

/* Layout Tactical de 5 Columnas Ensambladas */
.game-layout {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  gap: 14px;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

/* UNIDAD PRINCIPAL INTEGRADA: HOLD + BOARD EN EL MISMO CHASIS */
.main-board-unit {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 6px;
  background: linear-gradient(135deg, #35373d 0%, #1e1f23 60%, #131416 100%);
  border: 12px solid #4a4c54;
  border-top-color: #585a64;
  border-left-color: #54565f;
  border-bottom-color: #363840;
  border-right-color: #3a3c43;
  border-radius: 6px;
  padding: 14px 14px 10px 14px;
  box-shadow:
    inset 0 3px 0 rgba(255, 255, 255, 0.22),
    inset 0 -6px 12px rgba(0, 0, 0, 0.95),
    inset 0 0 0 1px rgba(0, 0, 0, 0.55),
    4px 12px 32px rgba(0, 0, 0, 0.85);
}

.integrated-hold-bay {
  display: flex;
  flex-direction: column;
  width: 132px;
  gap: 8px;
}

.integrated-board-column {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.telemetry-plate-box {
  position: relative;
  flex: 1;
  background: linear-gradient(180deg, #18191c 0%, #101113 100%);
  border: 2px solid #2a2c32;
  border-radius: 4px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -3px 6px rgba(0, 0, 0, 0.9);
}

.hazard-stripe-corner {
  height: 20px;
  width: 100%;
  background: repeating-linear-gradient(135deg,
      #f39c12 0 6px,
      #101113 6px 12px);
  border: 1px solid rgba(0, 0, 0, 0.7);
  border-radius: 2px;
  opacity: 0.85;
}

.telemetry-text-labels {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  font-family: monospace;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #6b6f7b;
  letter-spacing: 0.08em;
}

.unit-code {
  color: #a0a4b0;
  font-size: 0.75rem;
}

.sys-code {
  color: #6b6f7b;
}

.pwr-code {
  color: #6b6f7b;
}

.vent-grille-bottom {
  height: 32px;
  background-image: url('/assets/industrial-kit/vent-grille.svg');
  background-size: auto 100%;
  background-repeat: repeat-x;
  border: 1px solid #23252a;
  border-radius: 2px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.95);
}

.board-rivet {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #8a8c95 0%, #4a4c52 50%, #202124 100%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  z-index: 5;
}

/* Centrado óptico sobre el grosor real del marco (border: 12px):
   el contenedor posiciona el hijo absoluto contra el borde de padding, así que
   un offset negativo de -10px (radio 4px + mitad del borde 6px) lleva el centro
   del remache exactamente al punto medio de la banda metálica de 12px, dejando
   2px de margen limpio hacia el borde exterior y 2px hacia el padding interior. */
.board-rivet--tl {
  top: -10px;
  left: -10px;
}

.board-rivet--tr {
  top: -10px;
  right: -10px;
}

.board-rivet--bl {
  bottom: -10px;
  left: -10px;
}

.board-rivet--br {
  bottom: -10px;
  right: -10px;
}

.board-bezel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.canvas-wrapper {
  position: relative;
  display: flex;
  background: #08090b;
  border: 3px solid #1a1b1f;
  border-radius: 3px;
  box-shadow:
    inset 0 6px 18px rgba(0, 0, 0, 0.98),
    inset 0 0 0 1px rgba(0, 0, 0, 0.9),
    0 1px 0 rgba(255, 255, 255, 0.08);
  padding: 4px;
}

.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 11, 13, 0.75);
  color: var(--rf-color-amber, #f39c12);
  font-size: 1.5rem;
  font-weight: bold;
  letter-spacing: 0.2em;
  pointer-events: none;
  border-radius: 3px;
}

.board-exhaust-vent {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 12px;
  background: #0d0e11;
  border: 1px solid #23252a;
  border-radius: 2px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9);
}

.board-exhaust-vent span {
  width: 20px;
  height: 6px;
  background: #060708;
  border-radius: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* COLUMNA 3: NEXT + VENTILACIÓN CENTRAL */
.column-next-assembly {
  display: flex;
  flex-direction: column;
  width: 136px;
  gap: 12px;
}

.next-panel-box {
  background: linear-gradient(180deg, #1d1e22 0%, #121316 100%);
  border: 3px solid #32343a;
  border-radius: 6px;
  padding: 8px;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.12),
    inset 0 -3px 6px rgba(0, 0, 0, 0.9),
    0 6px 16px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.center-vent-module {
  flex: 1;
  min-height: 160px;
  background: linear-gradient(180deg, #18191c 0%, #101113 100%);
  border: 3px solid #2a2c32;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -3px 6px rgba(0, 0, 0, 0.9),
    0 6px 16px rgba(0, 0, 0, 0.7);
}

.vent-slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.vent-slots span {
  width: 100%;
  height: 10px;
  background: #08090b;
  border: 1px solid #1f2025;
  border-radius: 2px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.95);
}

/* COLUMNA 4: INSTRUMENTACIÓN CENTRAL */
.column-instrumentation {
  display: flex;
  flex-direction: column;
  width: 350px;
  gap: 6px;
}

/* Carcasa exterior común para ENERGY/SCORE/COMBO/ATTACK SLOTS (Tarea
   0031): unifica los 4 módulos en un único bloque de consola ensamblado
   en vez de 4 cards independientes. Reutiliza el panel metálico
   genérico (.rf-panel, tactical-theme.css) como marco/bisel exterior.
   Los .rf-console-module internos pierden su marco/sombra individual
   (overrides abajo) y quedan unidos por juntas técnicas (hairline +
   resalte sutil) en vez de huecos — mismos datos, tamaños y jerarquía. */
.instrumentation-console {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2px;
}

.instrumentation-console::before,
.instrumentation-console::after {
  content: '';
  position: absolute;
  top: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--rf-rivet);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  pointer-events: none;
  z-index: 2;
}

.instrumentation-console::before {
  left: 7px;
}

.instrumentation-console::after {
  right: 7px;
}

.instrumentation-console .rf-console-module {
  background-image: none;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}

/* Juntas técnicas entre secciones (todas menos ENERGY, la primera):
   hairline + resalte sutil justo debajo, en vez de un hueco entre
   cards. */
.instrumentation-console .score-module,
.instrumentation-console .combo-module,
.instrumentation-console .attack-slots-module {
  border-top: 1px solid rgba(0, 0, 0, 0.65);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.instrumentation-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

/* COLUMNA 5: OPPONENT MONITOR */
.column-opponent {
  display: flex;
  flex-direction: column;
  width: 360px;
}

.console-section--actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.console-divider {
  height: 1px;
  flex-shrink: 0;
  background: linear-gradient(90deg, transparent, var(--rf-color-metal-600, #3a3b3f), transparent);
}

.session-header {
  margin-bottom: 0.5rem;
}

.panel-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.session-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.session-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.session-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.session-value {
  font-size: 1rem;
  font-family: monospace;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.session-value.running {
  color: var(--rf-color-cyan, #00d4ff);
}

.session-value.paused {
  color: var(--rf-color-amber, #f39c12);
}

.session-value.gameOver {
  color: var(--rf-color-red, #e74c3c);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.dev-telemetry-inspector {
  margin-top: 1.25rem;
  padding: 1rem 1.25rem;
  background: var(--rf-color-graphite-900, #141517);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-cyan, #00d4ff);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-recessed);
}

/* Acciones */
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-primary, #e8e8ec);
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

button:hover:not(:disabled) {
  background: var(--rf-color-graphite-800, #1f2023);
}

button:active:not(:disabled) {
  background: var(--rf-color-graphite-900, #17181a);
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Controles: fila más dentro de la misma consola, sin chrome de tarjeta propia */
.controls-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.controls-help ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.controls-help li {
  font-size: 0.8125rem;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.controls-help kbd {
  background: var(--rf-color-graphite-700, #28292c);
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
  font-family: monospace;
  font-size: 0.75rem;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Game Over */
.game-over-banner {
  background: var(--rf-color-graphite-900, #17181a);
  color: var(--rf-color-red, #e74c3c);
  padding: 0.75rem;
  border-radius: var(--rf-radius-md, 6px);
  text-align: center;
  font-size: 1.25rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  border: 1px solid var(--rf-color-red, #e74c3c);
  border-left: 4px solid var(--rf-color-red, #e74c3c);
}

/* Zona 3: Monitor rival */
.opponent-column {
  flex-shrink: 0;
}

/* Aviso de ancho insuficiente */
.width-warning {
  display: none;
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-amber, #f39c12);
  padding: 0.75rem 1rem;
  border-radius: var(--rf-radius-md, 6px);
  margin-bottom: 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--rf-color-amber, #f39c12);
  text-align: center;
}

.footnote {
  margin-top: 2rem;
  font-size: 0.75rem;
  opacity: 0.4;
  text-align: center;
}

/* === RESPONSIVE === */

/* Portátil compacto: 760px – 1199px — tablero fijo a la izquierda,
   columna táctica y monitor rival apilados a la derecha en ese orden */
@media (max-width: 1199px) {
  .game-layout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .board-column {
    grid-column: 1;
    grid-row: 1 / span 2;
  }

  .tactical-column {
    grid-column: 2;
    grid-row: 1;
    max-width: none;
  }

  .opponent-column {
    grid-column: 2;
    grid-row: 2;
  }
}

/* Suelo mínimo: < 760px */
@media (max-width: 759px) {
  .game-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .width-warning {
    display: flex;
  }

  .board-column,
  .tactical-column,
  .opponent-column {
    max-width: 100%;
    min-width: auto;
    width: auto;
  }
}

.dev-warning-demo-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: rgba(18, 19, 22, 0.85);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: var(--rf-font-mono, monospace);
  color: var(--rf-color-cyan, #00d4ff);
  margin-bottom: 0.5rem;
}

.warning-demo-tag {
  font-weight: bold;
  letter-spacing: 0.08em;
}

.warning-demo-controls {
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}
</style>
