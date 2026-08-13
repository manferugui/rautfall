<script setup lang="ts">
/**
 * Componente de Menú Principal / Selector de Modos de Rautfall.
 *
 * Responsabilidades:
 * - Mostrar la identidad tipográfica y descriptor de Rautfall.
 * - Permitir la selección del modo de juego (Entrenamiento 1P o Batalla Local 2P contra rival automatizado).
 * - Exponer resumen de controles de teclado.
 * - Proporcionar control de audio (Mute/Unmute) accesible y desbloqueo tras gesto.
 * - Exponer un acceso discreto a las herramientas DEV (solo en desarrollo);
 *   el propio launcher de demos vive en su pantalla propia (`DevLauncherScreen.vue`).
 * - No contiene enlaces ni elementos ficticios de características fuera del MVP.
 *
 * Remozado visual (Industrial Dramatic): chasis propio, independiente del de
 * Battle (`.tactical-chassis` en App.vue no se toca) pero construido con los
 * mismos assets/tokens compartidos (dark-steel-corten.webp, module-bezel.svg,
 * panel-plate.svg, control-button-bezel.svg, rf-console-*, rf-btn-*) para que
 * Menú y Battle se lean como la misma máquina sin duplicar ni modificar el
 * CSS de Battle. Los botones de la toolbar (CONFIGURACIÓN/AUDIO/HISTORIAL/
 * RANKING) usan `.rf-btn-console` (global, en tactical-theme.css): su chrome
 * es geometría SVG real (control-button-bezel.svg), no CSS-only.
 *
 * Estructura de scroll (marco fijo / viewport con scroll / contenido):
 * `.menu-frame` (marco, textura, borde, remaches — no hace scroll) >
 * `.menu-scroll-viewport` (único elemento con overflow-y:auto) >
 * `.menu-content` (layout/ancho/gaps, sin scrollbar propia).
 */

import { ref, onMounted } from 'vue';
import type { GameMode } from '../game/types';
import { getAudioManager } from '../audio';

import { useSettings } from '../settings/settings-store';
import { formatKeyDisplay } from '../settings/control-bindings';

// Constante de compilación: en producción es `false` y Vue nunca monta el
// nodo del acceso DEV (no existe en el DOM). Mismo patrón que el resto de
// guardas DEV de la app (SfxLabComponent, DevLauncherScreenComponent...).
const isDevBuild = import.meta.env.DEV;

const emit = defineEmits<{
  (e: 'selectMode', mode: GameMode): void;
  (e: 'openSettings'): void;
  (e: 'openHistory'): void;
  (e: 'openRanking'): void;
  (e: 'openDevTools'): void;
}>();

const audioManager = getAudioManager();
const isMuted = ref(audioManager.isMuted());
const { bindings } = useSettings();

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
  emit('selectMode', mode);
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
        <!-- Placa de marca: mismo sistema de placa atornillada que la consola de Battle -->
        <div class="rf-console-module menu-brand-plate">
          <div class="rf-console-face menu-brand-face">
            <h1 class="menu-title">RAUTFALL</h1>
            <p class="menu-descriptor">BUILD · DISRUPT · SURVIVE</p>
          </div>
        </div>

        <!-- Barra de utilidades global: misma familia UTILITY, una sola fila -->
        <div class="menu-toolbar">
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

        <!-- Módulos principales: BATTLE (primario) / TRAINING (secundario) -->
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
        </div>

        <!-- Controles de teclado: módulo técnico secundario, mismo lenguaje de consola -->
        <div class="rf-console-module controls-module">
          <div class="rf-console-face controls-face">
            <span class="rf-console-label">Controles de teclado</span>
            <ul class="controls-list">
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.moveLeft) }}</kbd> <kbd class="rf-keycap">{{
                formatKeyDisplay(bindings.moveRight) }}</kbd> Mover horizontalmente</li>
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.rotateClockwise) }}</kbd> Rotación horaria (CW)
              </li>
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.rotateCounterClockwise) }}</kbd> Rotación
                antihoraria (CCW)</li>
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.hardDrop) }}</kbd> Caída instantánea (Hard Drop)
              </li>
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.softDrop) }}</kbd> Caída suave (Soft Drop)</li>
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.hold) }}</kbd> Reserva de pieza (Hold)</li>
              <li><kbd class="rf-keycap">{{ formatKeyDisplay(bindings.triggerSabotage) }}</kbd> Lanzar sabotaje táctico
              </li>
              <li><kbd class="rf-keycap">Esc</kbd> Pausar / Reanudar</li>
              <li><kbd class="rf-keycap">R</kbd> Reiniciar partida</li>
            </ul>
          </div>
        </div>

        <!-- Acceso DEV discreto: solo en desarrollo, no existe en el DOM en producción -->
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
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===================================================================
   MARCO — fijo, no hace scroll. Textura, borde, bisel y remaches viven
   aquí. Independiente de .tactical-chassis (Battle): CSS propia.
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
  /* Contiene el viewport interior: el marco (borde, remaches, textura)
     nunca se desplaza con el scroll. */
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

/* Remaches del marco: offsets pequeños y positivos (7-8px), muy dentro del
   borde de 6px — nunca se acercan al área de scroll ni se recortan con el
   overflow:hidden del marco. No se desplazan al hacer scroll (son hijos de
   .menu-frame, no de .menu-scroll-viewport). */
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

.menu-rivet--tl {
  top: 7px;
  left: 8px;
}

.menu-rivet--tr {
  top: 7px;
  right: 8px;
}

.menu-rivet--bl {
  bottom: 7px;
  left: 8px;
}

.menu-rivet--br {
  bottom: 7px;
  right: 8px;
}

/* ===================================================================
   VIEWPORT DE SCROLL — único elemento con overflow-y:auto. Aire propio
   (28px arriba/abajo/izquierda, 18px a la derecha) para que la scrollbar
   quede lejos del borde exterior y de los remaches.
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
  /* Scrollbar industrial (Firefox): grafito/acero, sin cian ni neón. */
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
   CONTENIDO — solo layout/ancho/gaps. Sin scrollbar propia, sin definir
   el marco exterior (eso es responsabilidad exclusiva de .menu-frame).
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

/* Placa de marca — mismo panel-plate.svg + tinte que la consola de Battle. */
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
  /* Grafito/acero oscuro mate: rango de tono muy estrecho, texto real
     (background-clip: text), no un degradado metálico dramático.
     Luminancia +~6% respecto a la versión anterior (#9a9ea4/#55575c)
     para dar algo más de presencia sin acercarse a aluminio/chrome. */
  background: linear-gradient(135deg, #a0a4a9 0%, #5f6166 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  /* Bisel muy contenido + iluminación superior-izquierda apenas
     perceptible: filo e inferior reducidos frente a la versión anterior
     para que se sienta como metal mecanizado mate, no texto en 3D. */
  text-shadow:
    -0.3px -0.3px 0 rgba(203, 206, 211, 0.18),
    0.6px 0.8px 1px rgba(0, 0, 0, 0.35);
}

/* Óxido corten (2 motas, muy sutiles): ancladas SOBRE zonas concretas de
   letras reales (primera "R" y segunda "A"), nunca fuera del bloque de
   texto — antes quedaban flotando a los lados por usar offsets mayores
   que el propio ancho del logotipo. */
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

/* ===================================================================
   CONFIGURACIÓN / AUDIO / HISTORIAL / RANKING / HERRAMIENTAS DEV usan el
   chrome físico compartido `.rf-btn-console` (global, tactical-theme.css
   — construido sobre control-button-bezel.svg, no CSS-only). Aquí solo
   queda lo específico de ESTE menú: el layout de la barra (.toolbar-btn),
   el mapeo de cada icono a su SVG concreto (.icon-*) y el ajuste del
   acceso DEV (.dev-access-link). NO toca .rf-btn-tactical / .rf-btn-utility
   (esas las usa también Battle).
   =================================================================== */

.icon-settings {
  mask-image: url('/assets/icons/ui/settings.svg');
  -webkit-mask-image: url('/assets/icons/ui/settings.svg');
}

.icon-audio {
  mask-image: url('/assets/icons/ui/audio.svg');
  -webkit-mask-image: url('/assets/icons/ui/audio.svg');
}

.icon-history {
  /* Ligero ajuste óptico: el documento de history.svg tiene más "masa"
     de tinta que sliders/podio a igual caja — se reduce un poco su
     mask-size para igualar el peso visual percibido entre los 4. */
  mask-size: 88%;
  -webkit-mask-size: 88%;
  mask-image: url('/assets/icons/ui/history.svg');
  -webkit-mask-image: url('/assets/icons/ui/history.svg');
}

.icon-ranking {
  mask-image: url('/assets/icons/ui/ranking.svg');
  -webkit-mask-image: url('/assets/icons/ui/ranking.svg');
}

/* Variante muda: mismo audio.svg + barra diagonal CSS mínima (no crea un
   quinto archivo de icono). */
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

/* Módulos de modo: placas mecánicas de selección, no "cards" web. Todo el
   chrome cabe dentro del ancho de la columna del grid: .mode-module tiene
   ancho AUTO (lo da el grid), altura FIJA (132px, no min-height: los
   insets porcentuales de bezel/face necesitan una altura definida para
   resolverse) y box-sizing por defecto es irrelevante aquí porque
   border/padding son 0 en el propio botón.

   TRES niveles reales, no dos (Tarea 0031 — corrección: la cara negra
   ocupaba casi todo el marco y leía como "card encima de una placa"):
     .mode-module-plate → MARCO exterior, SVG real (module-bezel.svg).
     .mode-module-bezel → BISEL intermedio, metal medio (CSS), visible
                           como anillo entre el marco y la superficie.
     .mode-module-face  → SUPERFICIE de selección, oscura y hundida,
                           con chaflán propio (clip-path) que sigue la
                           geometría angular del marco. Es más pequeña
                           que antes a propósito: debe quedar metal
                           visible alrededor para leer la pieza mecánica. */
.mode-modules {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;

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

/* BISEL intermedio: metal medio, ni el acero claro del marco ni el negro
   de la superficie — el "escalón" que hace evidente que hay profundidad
   real entre el marco y la cara, no una superposición plana. */
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
  /* Posicionada en absoluto con inset (no margin + height:100%): el inset
     porcentual se resuelve contra la altura FIJA del botón (arriba), y el
     ancho/alto resultante de la cara SIEMPRE cabe exactamente entre los
     insets — no hay width/padding en conflicto que pueda desbordar.
     Inset claramente mayor que el del bisel: deja un anillo de bisel
     visible en todo el perímetro (antes la cara casi coincidía con el
     hueco del marco y tapaba el bisel por completo). */
  position: absolute;
  inset: 22% 15.5%;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.6rem 0.85rem;
  background: linear-gradient(135deg, rgba(32, 34, 38, 0.92) 0%, rgba(15, 16, 18, 0.97) 100%);
  /* Chaflán propio: sigue la geometría angular del marco en vez de ser
     un rectángulo de esquinas rectas. */
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

/* Badge inferior: ranura técnica propia, no una etiqueta flotando suelta
   — hairline superior que la separa del texto y flex-shrink:0 para que
   nunca sea lo primero en perder espacio dentro de la cara. */
.mode-module-tag {
  align-self: flex-start;
  flex-shrink: 0;
  max-width: 100%;
  margin-top: 0.45rem;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-family: monospace;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  box-sizing: border-box;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

/* HOVER: mismo material (grafito), incremento contenido de luminosidad
   (~15%) — NO un salto a acero claro. El marco (.mode-module-plate) y
   el bisel (.mode-module-bezel) permanecen estables — solo la cara
   reacciona. */
.mode-module:hover .mode-module-face {
  transform: translateY(-1px);
  background: linear-gradient(135deg, rgba(42, 45, 50, 0.95) 0%, rgba(19, 20, 23, 0.97) 100%);
  border-left-color: #5c6066;
}

/* FOCUS-VISIBLE: el marco (plate + bezel) no recibe ninguna regla de
   foco. Los brackets técnicos viven DENTRO de la superficie de
   selección (.mode-module-face), no alrededor del marco exterior. */
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

/* ACTIVE/PRESSED: hundimiento claro — fondo casi negro, sombra inset
   pesada, highlight superior casi anulado, desplazamiento positivo. */
.mode-module:active .mode-module-face {
  transform: translateY(1px);
  background: linear-gradient(135deg, rgba(4, 4, 5, 0.97) 0%, rgba(0, 0, 0, 1) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.02),
    inset 0 5px 12px rgba(0, 0, 0, 0.95),
    inset 0 0 0 1px rgba(0, 0, 0, 0.75),
    inset 0 0 16px rgba(0, 0, 0, 0.7);
}


.mode-module--battle .mode-module-title {
  font-size: 1.2rem;
  color: var(--rf-color-cyan, #00d4ff);
}

.mode-module--battle .mode-module-tag {
  color: var(--rf-color-cyan, #00d4ff);
  border-top-color: rgba(0, 212, 255, 0.35);
}

.mode-module--battle:hover .mode-module-face {
  background: linear-gradient(135deg, rgba(42, 45, 50, 0.95) 0%, rgba(19, 20, 23, 0.97) 100%);
  border-left-color: var(--rf-color-cyan, #00d4ff);
}

/* Controles de teclado: módulo técnico secundario, densidad alta, poco
   protagonismo — mismo marco de consola que el resto, pero compacto. */
.controls-module {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  /* Marco más visible: se cede parte del padding de la cara (abajo) al
     marco (rf-console-module), para que se lea más metal/remache del
     panel-plate.svg alrededor de la cara. El tamaño total del módulo
     no cambia — solo se redistribuye entre marco y cara. */
  padding: 13px 17px;
}

.controls-face {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 7px 10px;
  /* Bisel direccional (luz superior-izquierda, sin glow): separa la cara
     del marco mediante geometría, no mediante brillo — mismo lenguaje
     que el resto del kit (control-button-bezel/mode-module). */
  border-top: 1px solid rgba(120, 126, 134, 0.3);
  border-left: 1px solid rgba(95, 100, 107, 0.25);
  border-right: 1px solid rgba(0, 0, 0, 0.55);
  border-bottom: 1px solid rgba(0, 0, 0, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -3px 6px rgba(0, 0, 0, 0.8),
    0 2px 5px rgba(0, 0, 0, 0.4);
}

/* +14px de separación entre el título y la primera fila de teclas (no se
   toca .rf-console-label global: la usa también la consola de Battle). */
.controls-face>.rf-console-label {
  margin-bottom: 14px;
}

.controls-list {
  box-sizing: border-box;
  max-width: 100%;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 1.4rem;
  margin: 0;
  padding: 0;
  position: relative;
  /* z-index:0 (no "auto"): abre un stacking context propio para esta
     lista, así el z-index:-1 de las bahías (abajo) queda contenido aquí
     y no puede quedar por detrás de nada fuera de este bloque. */
  z-index: 0;
}

/* Dos bahías internas encastradas, una por columna de teclas — rompen
   la superficie única de la cara en dos trays técnicos independientes.
   Grafito oscuro, bisel sutil, profundidad contenida, sin glow. Se
   extienden un poco más allá del propio grid (dentro del padding de
   .controls-face) para dar aire al texto sin tocar la distribución. */
.controls-list::before,
.controls-list::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: calc(50% - 0.7rem + 6px);
  z-index: -1;
  border-radius: 3px;
  background: linear-gradient(135deg, rgba(20, 21, 23, 0.85) 0%, rgba(9, 10, 11, 0.92) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 -2px 4px rgba(0, 0, 0, 0.65),
    inset 0 0 0 1px rgba(0, 0, 0, 0.45);
}

.controls-list::before {
  left: -6px;
}

.controls-list::after {
  right: -6px;
}

.controls-list li {
  font-size: 0.7rem;
  color: var(--rf-color-text-primary, #e8e8ec);
  min-width: 0;
}

.controls-list kbd {
  margin-right: 2px;
}

/* Acceso DEV discreto: comparte la familia .rf-btn-console (mismo chrome/
   hover/focus/pressed) pero más pequeño y apagado — no es un CTA. */
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

@media (max-width: 640px) {
  .mode-modules {
    grid-template-columns: 1fr;
  }

  .controls-list {
    grid-template-columns: 1fr;
  }
}
</style>
