import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    // El motor Phaser 3.80.1 (~1.2 MB minificado) se carga de forma diferida (lazy-loaded)
    // vía dynamic import() en GameCanvas.vue. Se incrementa el límite a 1500 kB únicamente
    // para autorizar de forma consciente dicho chunk asíncrono de partida sin afectar al
    // bundle inicial del navegador (~327 kB).
    chunkSizeWarningLimit: 1500,
  },
});
