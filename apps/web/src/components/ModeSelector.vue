<script setup lang="ts">
/**
 * Componente de Menú Principal / Selector de Modos de Rautfall.
 *
 * Responsabilidades:
 * - Mostrar la identidad tipográfica y descriptor de Rautfall.
 * - Permitir la selección del modo de juego en 3 tarjetas simétricas (Entrenamiento, Batalla Táctica, Contra Jugador).
 * - Selector contextual independiente de dificultad BOT PROFILE para Batalla Táctica.
 * - Proporcionar acceso a la modal de controles de teclado (`ControlsModal.vue`).
 * - Proporcionar control de audio (Mute/Unmute) accesible y desbloqueo tras gesto.
 * - Exponer un acceso discreto a las herramientas DEV (solo en desarrollo).
 */

import { ref, onMounted } from 'vue';
import type { GameMode } from '../game/types';
import { getAudioManager } from '../audio';
import type { BotProfileId } from '@rautfall/battle-engine';
import ControlsModal from './ControlsModal.vue';
import BotDifficultyModal from './BotDifficultyModal.vue';

const isDevBuild = import.meta.env.DEV;

const emit = defineEmits<{
  (e: 'selectMode', mode: GameMode, botProfile?: BotProfileId): void;
  (e: 'openSettings'): void;
  (e: 'openHistory'): void;
  (e: 'openRanking'): void;
  (e: 'openDevTools'): void;
  (e: 'openOnlinePvp'): void;
}>();

const audioManager = getAudioManager();
const isMuted = ref(audioManager.isMuted());
const isControlsModalOpen = ref(false);
const isDifficultyModalOpen = ref(false);

onMounted(() => {
  if (audioManager.isUnlocked()) {
    audioManager.playMusic('menu');
  }
});

function toggleAudioMute(): void {
  void audioManager.unlock().catch(() => {});
  audioManager.playSfx('uiClick');
  isMuted.value = audioManager.toggleMute();
}

function onSelectMode(mode: GameMode): void {
  void audioManager.unlock().catch(() => {});
  audioManager.playSfx('uiClick');
  if (mode === 'battle') {
    isDifficultyModalOpen.value = true;
  } else {
    emit('selectMode', mode);
  }
}

function handleSelectBotProfile(profile: BotProfileId): void {
  isDifficultyModalOpen.value = false;
  emit('selectMode', 'battle', profile);
}

function onOpenOnlinePvP(): void {
  void audioManager.unlock();
  audioManager.playSfx('uiClick');
  emit('openOnlinePvp');
}

function onOpenControls(): void {
  void audioManager.unlock().catch(() => {});
  audioManager.playSfx('uiClick');
  isControlsModalOpen.value = true;
}

function onOpenSettings(): void {
  void audioManager.unlock().catch(() => {});
  audioManager.playSfx('uiClick');
  emit('openSettings');
}

function onOpenHistory(): void {
  void audioManager.unlock();
  audioManager.playSfx('uiClick');
  emit('openHistory');
}

function onOpenRanking(): void {
  void audioManager.unlock();
  audioManager.playSfx('uiClick');
  emit('openRanking');
}

function onOpenDevTools(): void {
  void audioManager.unlock();
  audioManager.playSfx('uiClick');
  emit('openDevTools');
}
</script>

<template>
  <div class="menu-frame" data-testid="mode-selector">
    <!-- Textura híbrida compartida con Battle, en su propia capa -->
    <div class="menu-frame-texture" aria-hidden="true"></div>
    <div class="menu-rivet menu-rivet--tl" aria-hidden="true"></div>
    <div class="menu-rivet menu-rivet--tr" aria-hidden="true"></div>
    <div class="menu-rivet menu-rivet--bl" aria-hidden="true"></div>
    <div class="menu-rivet menu-rivet--br" aria-hidden="true"></div>

    <div class="menu-scroll-viewport">
      <div class="menu-content">
        <!-- Placa de marca -->
        <div class="rf-console-module menu-brand-plate">
          <div class="rf-console-face menu-brand-face">
            <h1 class="menu-title">RAUTFALL</h1>
            <p class="menu-descriptor">BUILD · DISRUPT · SURVIVE</p>
          </div>
        </div>

        <!-- Barra de utilidades global -->
        <div class="menu-toolbar">
          <button
            type="button"
            class="rf-btn-console toolbar-btn"
            data-testid="open-controls-button"
            @click="onOpenControls"
          >
            <span class="rf-btn-console-face">
              <span>CONTROLES</span>
            </span>
          </button>

          <button
            type="button"
            class="rf-btn-console toolbar-btn"
            data-testid="open-settings-button"
            @click="onOpenSettings"
          >
            <span class="rf-btn-console-face">
              <span class="rf-btn-console-icon icon-settings" aria-hidden="true"></span>
              <span>CONFIGURACIÓN</span>
            </span>
          </button>

          <button
            type="button"
            class="rf-btn-console toolbar-btn"
            data-testid="audio-mute-button"
            :data-audio-muted="isMuted"
            :aria-label="isMuted ? 'Activar audio' : 'Silenciar audio'"
            @click="toggleAudioMute"
          >
            <span class="rf-btn-console-face">
              <span
                class="rf-btn-console-icon icon-audio"
                :class="{ 'icon-audio--muted': isMuted }"
                aria-hidden="true"
              ></span>
              <span>{{ isMuted ? 'AUDIO SILENCIADO' : 'AUDIO ACTIVO' }}</span>
            </span>
          </button>

          <button
            type="button"
            class="rf-btn-console toolbar-btn"
            data-testid="open-history-button"
            @click="onOpenHistory"
          >
            <span class="rf-btn-console-face">
              <span class="rf-btn-console-icon icon-history" aria-hidden="true"></span>
              <span>HISTORIAL</span>
            </span>
          </button>

          <button
            type="button"
            class="rf-btn-console toolbar-btn"
            data-testid="open-ranking-button"
            @click="onOpenRanking"
          >
            <span class="rf-btn-console-face">
              <span class="rf-btn-console-icon icon-ranking" aria-hidden="true"></span>
              <span>RANKING</span>
            </span>
          </button>
        </div>

        <!-- Módulos principales: 3 modos equilibrados -->
        <div class="mode-modules">
          <button
            type="button"
            class="mode-module mode-module--training"
            data-testid="start-training-button"
            @click="onSelectMode('training')"
          >
            <div class="mode-module-plate" aria-hidden="true"></div>
            <div class="mode-module-bezel" aria-hidden="true"></div>
            <div class="mode-module-face">
              <span class="mode-module-title">ENTRENAMIENTO</span>
              <span class="mode-module-desc">Práctica individual 1P</span>
              <span class="mode-module-tag">1P · SOLO</span>
            </div>
          </button>

          <button
            type="button"
            class="mode-module mode-module--battle"
            data-testid="start-battle-button"
            @click="onSelectMode('battle')"
          >
            <div class="mode-module-plate" aria-hidden="true"></div>
            <div class="mode-module-bezel" aria-hidden="true"></div>
            <div class="mode-module-face">
              <span class="mode-module-title">BATALLA TÁCTICA</span>
              <span class="mode-module-desc">Combate 2P determinista contra rival automatizado</span>
              <span class="mode-module-tag">2P · VS BOT</span>
            </div>
          </button>

          <button
            type="button"
            class="mode-module mode-module--online"
            data-testid="start-online-pvp-button"
            @click="onOpenOnlinePvP"
          >
            <div class="mode-module-plate" aria-hidden="true"></div>
            <div class="mode-module-bezel" aria-hidden="true"></div>
            <div class="mode-module-face">
              <span class="mode-module-title">CONTRA JUGADOR</span>
              <span class="mode-module-desc">Combate 2P online autoritativo en tiempo real</span>
              <span class="mode-module-tag">2P · ONLINE PVP</span>
            </div>
          </button>
        </div>

        <!-- Acceso DEV discreto (solo en desarrollo) -->
        <button
          v-if="isDevBuild"
          type="button"
          class="rf-btn-console dev-access-link"
          data-testid="open-dev-tools-button"
          @click="onOpenDevTools"
        >
          <span class="dev-access-badge">DEV</span>
          <span>Herramientas DEV</span>
        </button>

        <!-- Modal de selección de dificultad para Batalla Táctica -->
        <BotDifficultyModal
          :is-open="isDifficultyModalOpen"
          @select-profile="handleSelectBotProfile"
          @cancel="isDifficultyModalOpen = false"
        />

        <!-- Modal de controles -->
        <ControlsModal
          :is-open="isControlsModalOpen"
          @close="isControlsModalOpen = false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===================================================================
   MARCO — fijo, no hace scroll. Textura, borde, bisel y remaches viven aquí.
   =================================================================== */
.menu-frame {
  position: relative;
  width: min(1320px, calc(100vw - 64px));
  max-height: calc(100vh - 64px);
  margin: 32px auto;
  border: 6px solid #383a42;
  border-radius: 8px;
  background: radial-gradient(ellipse at 50% 15%, #242629 0%, #17181b 60%, #0d0e10 100%);
  box-shadow:
    inset 0 4px 0 rgba(255, 255, 255, 0.16),
    inset 0 -6px 16px rgba(0, 0, 0, 0.9),
    0 24px 64px rgba(0, 0, 0, 0.75);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.menu-frame-texture {
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/dark-steel-corten.webp');
  background-size: 340px 340px;
  background-repeat: repeat;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}

.menu-rivet {
  position: absolute;
  width: 11px;
  height: 11px;
  background-image: url('/assets/industrial-kit/rivet-bolt.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.9));
  z-index: 3;
  pointer-events: none;
}

.menu-rivet--tl { top: 7px; left: 8px; }
.menu-rivet--tr { top: 7px; right: 8px; }
.menu-rivet--bl { bottom: 7px; left: 8px; }
.menu-rivet--br { bottom: 7px; right: 8px; }

/* ===================================================================
   VIEWPORT DE SCROLL
   =================================================================== */
.menu-scroll-viewport {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 28px 18px 28px 28px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: #4a4c54 #14151a;
}

.menu-scroll-viewport::-webkit-scrollbar {
  width: 9px;
}

.menu-scroll-viewport::-webkit-scrollbar-track {
  background: #14151a;
}

.menu-scroll-viewport::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #52545c 0%, #34363c 100%);
  border: 1px solid #0a0b0c;
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.menu-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #62646c 0%, #40424a 100%);
}

/* ===================================================================
   CONTENIDO
   =================================================================== */
.menu-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 1100px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
}

.menu-brand-plate {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
}

.menu-brand-face {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0.9rem 1rem;
}

.menu-title {
  position: relative;
  font-family: 'Oswald', sans-serif;
  font-size: 3.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
  background: linear-gradient(135deg, #a0a4a9 0%, #5f6166 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  text-shadow:
    -0.3px -0.3px 0 rgba(203, 206, 211, 0.18),
    0.6px 0.8px 1px rgba(0, 0, 0, 0.35);
}

.menu-title::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 62%;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  pointer-events: none;
  box-shadow:
    -1.85em 0.15em 0 1px rgba(139, 58, 27, 0.6),
    0.85em -0.1em 0 1px rgba(139, 58, 27, 0.55);
}

.menu-descriptor {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin: 0.2rem 0 0;
}

.menu-toolbar {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  display: flex;
  gap: 0.6rem;
}

.icon-settings {
  mask-image: url('/assets/icons/ui/settings.svg');
  -webkit-mask-image: url('/assets/icons/ui/settings.svg');
}

.icon-audio {
  mask-image: url('/assets/icons/ui/audio.svg');
  -webkit-mask-image: url('/assets/icons/ui/audio.svg');
}

.icon-history {
  mask-size: 88%;
  -webkit-mask-size: 88%;
  mask-image: url('/assets/icons/ui/history.svg');
  -webkit-mask-image: url('/assets/icons/ui/history.svg');
}

.icon-ranking {
  mask-image: url('/assets/icons/ui/ranking.svg');
  -webkit-mask-image: url('/assets/icons/ui/ranking.svg');
}

.icon-audio--muted::after {
  content: '';
  position: absolute;
  left: -1px;
  top: 50%;
  width: 22px;
  height: 2px;
  background: currentColor;
  transform: translateY(-50%) rotate(-45deg);
}

.toolbar-btn {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  justify-content: center;
  background: inherit;

  &:hover:not(:disabled) {
    background: inherit;
  }
}

/* ===================================================================
   MÓDULOS DE MODO: 3 columnas simétricas en escritorio
   =================================================================== */
.mode-modules {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
  align-items: center;
}

.mode-module {
  position: relative;
  border: 0;
  background: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  height: 190px;
  width: 100%;
  max-width: 100%;

  &:hover:not(:disabled) {
    background: inherit;
  }
}

.mode-module-plate {
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/module-bezel.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  z-index: 0;
}

.mode-module-bezel {
  position: absolute;
  inset: 15% 10%;
  z-index: 1;
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  background: linear-gradient(135deg, rgba(64, 68, 74, 0.9) 0%, rgba(22, 24, 27, 0.95) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -3px 6px rgba(0, 0, 0, 0.65);
}

.mode-module-face {
  position: absolute;
  inset: 22% 15.5%;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.6rem 0.85rem;
  background: linear-gradient(135deg, rgba(32, 34, 38, 0.92) 0%, rgba(15, 16, 18, 0.97) 100%);
  clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px);
  border-left: 3px solid var(--rf-color-metal-600, #3a3b3f);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 2px 5px rgba(0, 0, 0, 0.85),
    inset 0 0 0 1px rgba(0, 0, 0, 0.6);
  transition: transform 0.1s, box-shadow 0.1s, background 0.1s;
  overflow: hidden;
}

.mode-module-title {
  flex-shrink: 0;
  font-size: 1.05rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--rf-color-text-primary, #e8e8ec);
  max-width: 100%;
}

.mode-module-desc {
  font-size: 0.72rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  max-width: 100%;
}

.mode-module-tag {
  align-self: flex-start;
  flex-shrink: 0;
  max-width: 100%;
  margin-top: auto;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-family: monospace;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  box-sizing: border-box;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.mode-module:hover .mode-module-face {
  transform: translateY(-1px);
  background: linear-gradient(135deg, rgba(42, 45, 50, 0.95) 0%, rgba(19, 20, 23, 0.97) 100%);
  border-left-color: #5c6066;
}

.mode-module:focus-visible {
  outline: none;
}

.mode-module:focus-visible .mode-module-face::before,
.mode-module:focus-visible .mode-module-face::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.mode-module:focus-visible .mode-module-face::before {
  top: 4px;
  left: 4px;
  border-top: 2px solid var(--rf-color-cyan, #00d4ff);
  border-left: 2px solid var(--rf-color-cyan, #00d4ff);
}

.mode-module:focus-visible .mode-module-face::after {
  bottom: 4px;
  right: 4px;
  border-bottom: 2px solid var(--rf-color-cyan, #00d4ff);
  border-right: 2px solid var(--rf-color-cyan, #00d4ff);
}

.mode-module:active .mode-module-face {
  transform: translateY(1px);
  background: linear-gradient(135deg, rgba(4, 4, 5, 0.97) 0%, rgba(0, 0, 0, 1) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.02),
    inset 0 5px 12px rgba(0, 0, 0, 0.95),
    inset 0 0 0 1px rgba(0, 0, 0, 0.75),
    inset 0 0 16px rgba(0, 0, 0, 0.7);
}

/* Identidad Batalla Táctica (Cian) */
.mode-module--battle .mode-module-title {
  color: var(--rf-color-cyan, #00d4ff);
}

.mode-module--battle .mode-module-tag {
  color: var(--rf-color-cyan, #00d4ff);
  border-top-color: rgba(0, 212, 255, 0.35);
}

.mode-module--battle:hover .mode-module-face {
  border-left-color: var(--rf-color-cyan, #00d4ff);
}

/* Identidad PvP Online (Verde Radiactivo) */
.mode-module--online .mode-module-title {
  color: var(--rf-color-pvp-green, #a6ff00);
}

.mode-module--online .mode-module-tag {
  color: var(--rf-color-pvp-green, #a6ff00);
  border-top-color: rgba(166, 255, 0, 0.35);
}

.mode-module--online:hover .mode-module-face {
  border-left-color: var(--rf-color-pvp-green, #a6ff00);
}

.mode-module--online:focus-visible .mode-module-face::before {
  border-top-color: var(--rf-color-pvp-green, #a6ff00);
  border-left-color: var(--rf-color-pvp-green, #a6ff00);
}

.mode-module--online:focus-visible .mode-module-face::after {
  border-bottom-color: var(--rf-color-pvp-green, #a6ff00);
  border-right-color: var(--rf-color-pvp-green, #a6ff00);
}

/* ===================================================================
   SELECTOR DE DIFICULTAD BOT PROFILE (Contextual para Batalla Táctica)
   =================================================================== */
.bot-profile-selector {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.75rem;
  background: linear-gradient(135deg, rgba(24, 26, 30, 0.92) 0%, rgba(12, 13, 15, 0.97) 100%);
  border: 1px solid rgba(0, 212, 255, 0.28);
  border-left: 3px solid var(--rf-color-cyan, #00d4ff);
  border-radius: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -2px 4px rgba(0, 0, 0, 0.75),
    0 3px 10px rgba(0, 0, 0, 0.45);
}

.bot-profile-label {
  font-family: monospace;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--rf-color-cyan, #00d4ff);
  text-transform: uppercase;
}

.bot-profile-buttons {
  display: flex;
  gap: 0.4rem;
}

.bot-profile-btn {
  flex: 1;
  padding: 0.35rem 0.5rem;
  font-family: 'Oswald', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.65));
  background: rgba(18, 19, 22, 0.92);
  border: 1px solid rgba(80, 84, 92, 0.6);
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
  text-align: center;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

@media (hover: hover) {
  .bot-profile-btn:hover:not(.bot-profile-btn--selected):not(.bot-profile-btn--active) {
    color: #ffffff;
    border-color: rgba(160, 165, 175, 0.8);
    background: rgba(34, 37, 42, 0.95);
  }

  .bot-profile-btn--selected:hover,
  .bot-profile-btn--active:hover {
    background: #1ae0ff;
    border-color: #33e5ff;
    color: #000000;
    box-shadow: 0 0 12px rgba(0, 212, 255, 0.45);
  }
}

.bot-profile-btn--selected,
.bot-profile-btn--active {
  color: #000000;
  font-weight: 800;
  background: var(--rf-color-cyan, #00d4ff);
  border-color: #00e1ff;
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.35);
}

.bot-profile-btn:focus-visible {
  outline: 2px solid var(--rf-color-cyan, #00d4ff);
  outline-offset: 2px;
}

.bot-profile-btn:focus:not(:focus-visible) {
  outline: none;
}

.dev-access-link {
  align-self: center;
  margin-top: 0.2rem;
  height: 26px;
  padding: 0 0.6rem;
  font-size: 0.68rem;
  color: rgba(139, 145, 155, 0.7);
  opacity: 0.85;
}

.dev-access-link:hover:not(:disabled) {
  opacity: 1;
}

.dev-access-badge {
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 1px 5px;
  border-radius: 2px;
  color: #0b0b0d;
  background: var(--rf-color-amber, #f39c12);
}

@media (max-width: 768px) {
  .mode-modules {
    grid-template-columns: 1fr;
  }

  .menu-toolbar {
    flex-wrap: wrap;
  }
}
</style>
