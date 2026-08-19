<script setup lang="ts">
import { computed } from 'vue';
import type { SessionStatus } from '../game/types';

const props = withDefaults(
  defineProps<{
    status: SessionStatus;
    canResume?: boolean;
  }>(),
  {
    canResume: true,
  }
);

const isPaused = computed(() => props.status === 'paused');
const isGameOver = computed(() => props.status === 'gameOver');
</script>

<template>
  <div
    v-if="!isGameOver"
    class="rf-pause-shutter"
    :class="{ 'rf-pause-shutter--sealed': isPaused }"
    data-testid="pause-shutter"
    role="status"
    aria-live="polite"
    :aria-hidden="!isPaused"
  >
    <!-- Guías mecánicas laterales -->
    <div class="shutter-guide shutter-guide--left" aria-hidden="true">
      <div class="guide-track"></div>
      <div class="guide-notch guide-notch--top"></div>
      <div class="guide-notch guide-notch--bot"></div>
    </div>
    <div class="shutter-guide shutter-guide--right" aria-hidden="true">
      <div class="guide-track"></div>
      <div class="guide-notch guide-notch--top"></div>
      <div class="guide-notch guide-notch--bot"></div>
    </div>

    <!-- Conjunto de lamas industriales móviles -->
    <div class="shutter-curtain-assembly">
      <div class="shutter-slat shutter-slat--1">
        <div class="slat-bevel-top"></div>
        <div class="slat-rib"></div>
        <div class="slat-rivet slat-rivet--left"></div>
        <div class="slat-rivet slat-rivet--right"></div>
        <div class="slat-joint-line"></div>
      </div>
      <div class="shutter-slat shutter-slat--2">
        <div class="slat-rib"></div>
        <div class="slat-rivet slat-rivet--left"></div>
        <div class="slat-rivet slat-rivet--right"></div>
        <div class="slat-joint-line"></div>
      </div>
      <div class="shutter-slat shutter-slat--3">
        <!-- Placa de señalética industrial central en la lama principal -->
        <div class="shutter-signage-plate" :class="{ 'shutter-signage-plate--opponent-paused': props.canResume === false }">
          <div class="signage-hazard-stripes" aria-hidden="true"></div>
          <div class="signage-header">
            <span class="signage-dot"></span>
            <span class="signage-system-tag">{{ props.canResume === false ? 'PAUSA REMOTA' : 'SYSTEM HOLD' }}</span>
            <span class="signage-dot"></span>
          </div>
          <div class="signage-main-text">{{ props.canResume === false ? 'PAUSADA POR EL RIVAL' : 'PAUSED' }}</div>
          <div class="signage-sub-text">{{ props.canResume === false ? 'ESPERANDO REANUDACIÓN...' : 'ESC — RESUME' }}</div>
          <div class="signage-hazard-stripes" aria-hidden="true"></div>
        </div>
        <div class="slat-rib"></div>
        <div class="slat-joint-line"></div>
      </div>
      <div class="shutter-slat shutter-slat--4">
        <div class="slat-rib"></div>
        <div class="slat-rivet slat-rivet--left"></div>
        <div class="slat-rivet slat-rivet--right"></div>
        <div class="slat-joint-line"></div>
      </div>
      <div class="shutter-slat shutter-slat--5">
        <div class="slat-rib"></div>
        <div class="slat-rivet slat-rivet--left"></div>
        <div class="slat-rivet slat-rivet--right"></div>
        <div class="slat-bevel-bot"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rf-pause-shutter {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 200ms ease;
}

.rf-pause-shutter--sealed {
  pointer-events: auto;
  opacity: 1;
}

/* Guías mecánicas laterales encastradas */
.shutter-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  background: linear-gradient(90deg, #0d0f12 0%, #1a1d22 50%, #0a0b0d 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-left: 1px solid rgba(0, 0, 0, 0.8);
  z-index: 42;
}

.shutter-guide--left {
  left: 0;
}

.shutter-guide--right {
  right: 0;
}

.guide-track {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 5px;
  background: #050607;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.9);
}

.guide-notch {
  position: absolute;
  width: 8px;
  height: 4px;
  left: 3px;
  background: #282d34;
  border-radius: 1px;
}

.guide-notch--top {
  top: 12px;
}

.guide-notch--bot {
  bottom: 12px;
}

/* Ensamblaje de lamas */
.shutter-curtain-assembly {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  z-index: 41;
}

/* Lama industrial */
.shutter-slat {
  flex: 1;
  position: relative;
  background: linear-gradient(180deg, #2b313a 0%, #1c2026 40%, #14171c 80%, #0d0f12 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: 1px solid rgba(0, 0, 0, 0.85);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -2px 4px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Transición por defecto: Apertura rápida (240 ms) cuando running */
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 240ms cubic-bezier(0.4, 0, 0.6, 1), opacity 200ms ease;
}

/* Cierre progresivo (500 ms) cuando sealed (paused) */
.rf-pause-shutter--sealed .shutter-slat {
  transform: translateY(0);
  opacity: 1;
  transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease;
}

/* Desplazamiento escalonado sutil para efecto persiana pesada */
.shutter-slat--1 { transition-delay: 0ms; }
.shutter-slat--2 { transition-delay: 20ms; }
.shutter-slat--3 { transition-delay: 35ms; }
.shutter-slat--4 { transition-delay: 50ms; }
.shutter-slat--5 { transition-delay: 65ms; }

.rf-pause-shutter--sealed .shutter-slat--1 { transition-delay: 0ms; }
.rf-pause-shutter--sealed .shutter-slat--2 { transition-delay: 30ms; }
.rf-pause-shutter--sealed .shutter-slat--3 { transition-delay: 50ms; }
.rf-pause-shutter--sealed .shutter-slat--4 { transition-delay: 70ms; }
.rf-pause-shutter--sealed .shutter-slat--5 { transition-delay: 90ms; }

/* Detalle de costilla central */
.slat-rib {
  position: absolute;
  left: 20px;
  right: 20px;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.1) 80%, transparent 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.slat-rivet {
  position: absolute;
  width: 5px;
  height: 5px;
  background: radial-gradient(circle, #5a6575 0%, #1a1e24 80%);
  border-radius: 50%;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 1px 2px rgba(0, 0, 0, 0.8);
  top: 50%;
  transform: translateY(-50%);
}

.slat-rivet--left {
  left: 22px;
}

.slat-rivet--right {
  right: 22px;
}

.slat-joint-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: #08090a;
}

/* Placa de señalética industrial */
.shutter-signage-plate {
  position: relative;
  z-index: 45;
  background: radial-gradient(ellipse at center, #181c22 0%, #0d0f13 100%);
  border: 1px solid #ffb700;
  box-shadow: 0 0 15px rgba(255, 183, 0, 0.25), inset 0 0 10px rgba(0, 0, 0, 0.9);
  padding: 12px 28px;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 200px;
}

.signage-hazard-stripes {
  width: 100%;
  height: 4px;
  background: repeating-linear-gradient(
    -45deg,
    #ffb700,
    #ffb700 8px,
    #121418 8px,
    #121418 16px
  );
  border-radius: 1px;
  opacity: 0.85;
}

.signage-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.signage-dot {
  width: 4px;
  height: 4px;
  background-color: #ffb700;
  border-radius: 50%;
  box-shadow: 0 0 4px #ffb700;
}

.signage-system-tag {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #ffb700;
  text-transform: uppercase;
}

.signage-main-text {
  font-family: var(--font-display, var(--font-mono, sans-serif));
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 4px;
  color: #e6edf3;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  margin: 2px 0;
  text-align: center;
}

.signage-sub-text {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: #8b949e;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 4px;
  width: 100%;
  text-align: center;
}

/* Accessibility: Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .shutter-slat {
    transition: transform 0.001s step-end, opacity 0.001s step-end !important;
    transition-delay: 0ms !important;
  }
}
</style>
