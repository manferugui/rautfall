# Registro de Trazabilidad de Assets de Audio de Rautfall

Este documento registra el origen, licencia, metadatos y transformaciones técnicas aplicadas a todos los assets de audio externos integrados en Rautfall.

---

## 1. Asset: `sudden-death-started.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/sudden-death-started.wav`
- **Uso en la aplicación**: Muestra sonora procesada principal reproducida una sola vez al comenzar la Muerte Súbita (`suddenDeathStarted`).
- **Título original**: Mayotte EAS Alarm 🇾🇹 (Again)
- **Autor / Creador**: JeremayJimenez
- **Fuente original / URL**: [Pixabay — Mayotte EAS Alarm 🇾🇹 (Again)](https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-mayotte-eas-alarm-bandera_mayotte-again-374016/)
- **Fecha de descarga**: 6 de agosto de 2026
- **Licencia**: [Pixabay Content License](https://pixabay.com/service/license-summary/)
- **Atribución voluntaria**: *"Efecto de sonido de JeremayJimenez en Pixabay (Mayotte EAS Alarm 🇾🇹 Again)"*.
- **Duración original**: ~29,28 segundos.
- **Fragmento seleccionado**: 0,20 s a 10,20 s (10,000 segundos). Abarca 2 ciclos completos continuos de la alarma EAS Mayotte con desarrollo sonoro sostenido.
- **Transformaciones técnicas aplicadas**:
  1. Recorte de tramo continuo de alarma (de $t=0{,}20\text{ s}$ a $t=10{,}20\text{ s}$, duración exacta de $10{,}000\text{ s}$).
  2. Mezcla y conversión a canal Mono (1 canal).
  3. Remuestreo a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 80 Hz) para eliminar sub-rumbo innecesario.
  5. Reducción inicial de ganancia de -10,5 dB ($0{,}2985$ lineal).
  6. Envolvente con fade-in exponencial de 30 ms y fade-out lineal suave de 500 ms.
  7. Exportación a PCM uncompressed de 16 bits.
  8. Pico máximo de $-10{,}76\text{ dBFS}$, RMS de $-23{,}91\text{ dBFS}$.
- **Formato final**: PCM 16-bit Mono 48 kHz (RIFF WAVE header, 960.044 bytes).
- **Condición de distribución**: Se distribuye exclusivamente procesado y transformado como parte integrada de la aplicación cliente (`apps/web`). El archivo MP3 fuente original no se distribuye ni se conserva dentro del repositorio.

---

## 2. Asset: `game-over.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/game-over.wav`
- **Uso en la aplicación**: SFX terminal de derrota / Game Over (`gameOver`).
- **Título original**: `Electric Failure – High Voltage Power Down #2 ATP2 (CC0)`
- **Autor / Creador**: `ATP2-kh`
- **Fuente original / URL**: [Freesound — Electric Failure – High Voltage Power Down #2 ATP2 (ID 844244)](https://freesound.org/people/ATP2-kh/sounds/844244/)
- **Fecha de publicación**: 4 de febrero de 2026
- **Fecha de descarga**: 9 de agosto de 2026
- **Licencia**: [Creative Commons Zero (CC0 1.0 Universal)](https://creativecommons.org/publicdomain/zero/1.0/)
- **Atribución requerida**: No obligatoria por la licencia CC0.
- **Atribución voluntaria recomendada**: *"Electric Failure – High Voltage Power Down #2 ATP2 (CC0)" — ATP2-kh / Freesound*.
- **Duración original**: ~2,089 segundos.
- **Fragmento seleccionado**: 0,00 s a 1,70 s (1,700 segundos / 1.700 ms). Aísla el transitorio de fallo inicial, chisporroteo eléctrico, inestabilidad de voltaje y caída limpia de potencia (power-down) eliminando el micro-silencio y zumbido sordo final.
- **Transformaciones técnicas aplicadas**:
  1. Recorte de tramo limpio de $1{,}700\text{ s}$ ($1.700\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos preciso (`highpass` a 120 Hz) que erradica el zumbido sordo de 50 Hz sin vaciar el cuerpo armónico del transformador.
  5. Realce muy suave y ancho en medios (`peaking` +1.5 dB en 1.5 kHz, Q=0.7).
  6. Reducción de ganancia de -1,0 dB ($0{,}8913$ lineal).
  7. Envolvente con fade-in de 3 ms y fade-out lineal de 220 ms.
  8. Exportación a PCM uncompressed de 16 bits Estéreo.
  9. Pico máximo de $-9{,}53\text{ dBFS}$ (sin clipping) y RMS de $-27{,}56\text{ dBFS}$.
  10. **Distribución espectral final (Variante C)**: $<120\text{ Hz}$ ($21,5\%$), $120\text{--}500\text{ Hz}$ ($6,1\%$), $500\text{ Hz--}2\text{ kHz}$ ($11,6\%$), $2\text{k--}8\text{ kHz}$ ($60,9\%$ de textura brillante de arcos eléctricos sin zumbidos graves).
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 326.444 bytes).
- **Condición de distribución**: Se integra como parte de la experiencia interactiva del juego y no se distribuye de forma independiente.

---

## 3. Asset BGM: `victory.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/music/victory.wav`
- **Uso en la aplicación**: Pieza musical única de victoria y fondo sostenido en la pantalla de resultados (`ResultsModal`) al ganar la batalla (`battleEnded(playerOne)`).
- **Título original**: `Sector Secured.wav`
- **Duración original**: 62,23 segundos.
- **Fragmento seleccionado**: 0,00 s a 16,00 s (16,000 segundos). Conserva el arranque potente de impacto de victoria en los primeros 4–5s y sostiene la energía industrial durante todo el modal de resultados.
- **Transformaciones técnicas aplicadas**:
  1. Recorte de tramo inicial potente y rítmico (de $t=0{,}00\text{ s}$ a $t=16{,}00\text{ s}$, duración de $16{,}000\text{ s}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 55 Hz en ambos canales).
  5. Reducción de ganancia inicial de -7,0 dB ($0{,}4467$ lineal).
  6. Envolvente con fade-in de 10 ms y micro fade-out de 50 ms.
  7. Exportación a PCM uncompressed de 16 bits Estéreo.
  8. Pico máximo de $-7{,}88\text{ dBFS}$ y RMS de $-24{,}81\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 3.072.044 bytes).

---

## 4. Asset SFX: `victory-fallback.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/victory-fallback.wav`
- **Uso en la aplicación**: Fallback real de victoria (`victoryFallback`) reproducido únicamente si la pista musical principal de victoria (`victory.wav` / Sector Secured) no se puede cargar o falla la red.
- **Título original**: `Level Up / Mission Complete`
- **Autor / Creador**: `Beetlemuse`
- **Fuente original / URL**: [Freesound — Level Up / Mission Complete (ID 528958)](https://freesound.org/people/Beetlemuse/sounds/528958/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 3,431 segundos.
- **Fragmento seleccionado**: 0,00 s a 1,80 s (1,800 segundos).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de frase de triunfo de $1{,}800\text{ s}$ ($1800\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 44.1 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 50 Hz).
  5. Reducción de ganancia de -2,0 dB ($0{,}7943$ lineal).
  6. Envolvente con fade-in de 3 ms y fade-out de 250 ms.
  7. Pico máximo de $-7{,}33\text{ dBFS}$ y RMS de $-23{,}50\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 345.644 bytes).

---

## 5. Asset SFX: `ui-click.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/ui-click.wav`
- **Uso en la aplicación**: Clic mecánico discreto de interfaz de usuario (`uiClick`).
- **Título original**: `Industrial Switch With Spring`
- **Autor / Creador**: `cookies+policy`
- **Fuente original / URL**: [Freesound — Industrial Switch With Spring (ID 556635)](https://freesound.org/people/cookies+policy/sounds/556635/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 2,955625 segundos.
- **Fragmento seleccionado**: 0,0280 s a 0,1080 s (0,080 segundos / 80 ms).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de transitorio de ataque mecánico seco de $0{,}080\text{ s}$ ($80\text{ ms}$).
  2. Mantenimiento del canal Mono (1 canal).
  3. Remuestreo de 96 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 100 Hz).
  5. Reducción de ganancia de -12,0 dB ($0{,}2512$ lineal).
  6. Envolvente con fade-in de 1 ms y fade-out de 25 ms.
  7. Pico máximo de $-10{,}85\text{ dBFS}$ y RMS de $-29{,}21\text{ dBFS}$.
- **Formato final**: PCM 16-bit Mono 48 kHz (RIFF WAVE header, 7.724 bytes).

---

## 6. Asset SFX: `piece-locked.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/piece-locked.wav`
- **Uso en la aplicación**: SFX de encaje / cierre mecánico de pieza fijada en la cuadrícula (`pieceLocked`).
- **Título original**: `Mechanical switch (latch) 02`
- **Autor / Creador**: `xkeril`
- **Fuente original / URL**: [Freesound — Mechanical switch (latch) 02 (ID 815493)](https://freesound.org/people/xkeril/sounds/815493/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 1,7998 segundos.
- **Fragmento seleccionado**: 0,1570 s a 0,2870 s (0,130 segundos / 130 ms).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de transitorio de encaje mecánico de $0{,}130\text{ s}$ ($130\text{ ms}$).
  2. Mantenimiento del canal Mono (1 canal).
  3. Remuestreo a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 80 Hz).
  5. Reducción de ganancia de -9,5 dB ($0{,}3350$ lineal).
  6. Envolvente con fade-in de 2 ms y fade-out de 35 ms.
  7. Pico máximo de $-9{,}95\text{ dBFS}$ y RMS de $-28{,}04\text{ dBFS}$.
- **Formato final**: PCM 16-bit Mono 48 kHz (RIFF WAVE header, 12.524 bytes).

---

## 7. Asset SFX: `lines-cleared.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/lines-cleared.wav`
- **Uso en la aplicación**: SFX de barrido espectral y limpieza tecnológica de 1 a 3 líneas (`linesCleared`).
- **Título original**: `Short Muddy Sweep`
- **Autor / Creador**: `D_Yonqui`
- **Fuente original / URL**: [Freesound — Short Muddy Sweep (ID 864419)](https://freesound.org/people/D_Yonqui/sounds/864419/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 0,750 segundos.
- **Fragmento seleccionado**: 0,1150 s a 0,3950 s (0,280 segundos / 280 ms).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de movimiento de barrido tecnológico de $0{,}280\text{ s}$ ($280\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 44.1 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 120 Hz).
  5. Reducción de ganancia de -12,0 dB ($0{,}2512$ lineal).
  6. Envolvente con fade-in de 2 ms y fade-out de 45 ms.
  7. Pico máximo de $-7{,}98\text{ dBFS}$ y RMS de $-22{,}46\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 53.808 bytes).

---

## 8. Asset SFX: `hard-drop.wav` *(Sustituido en iteración auditiva por Kitchen Dish Clank)*

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/hard-drop.wav`
- **Uso en la aplicación**: SFX mecánico principal para el impacto de asentamiento de pieza pesada (`hardDrop`).
- **Título original**: `Kitchen Dish Clank` *(Nota: Sustituyó a "Anvil Sound" ID 700416 por FaKexxChaos para eliminar fatiga auditiva y campaneo)*.
- **Autor / Creador**: `OwlStorm`
- **Fuente original / URL**: [Freesound — Kitchen Dish Clank (ID 209009)](https://freesound.org/people/OwlStorm/sounds/209009/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: ~0,754 segundos.
- **Fragmento seleccionado**: 0,0380 s a 0,2180 s (0,180 segundos / 180 ms). Impacto seco de choque de pieza metálica/asentamiento sin retumbos ni cola metálica larga.
- **Transformaciones técnicas aplicadas**:
  1. Recorte de impacto seco de $0{,}180\text{ s}$ ($180\text{ ms}$).
  2. Mantenimiento del canal Mono (1 canal).
  3. Remuestreo de 44.1 kHz a 48.000 Hz (48 kHz).
  4. Conservación natural de la banda armónica entre 150 Hz y 2.5 kHz sin filtros pasa-altos agresivos.
  5. Ajuste de ganancia de +2,5 dB ($1{,}3335$ lineal).
  6. Envolvente con fade-in de 1 ms y fade-out de 45 ms.
  7. Pico máximo de $-6{,}12\text{ dBFS}$ (sin clipping) y RMS de $-22{,}99\text{ dBFS}$.
  8. **Distribución espectral**: $<120\text{ Hz}$ ($0,7\%$), $120\text{--}500\text{ Hz}$ ($18,8\%$), $500\text{ Hz--}2\text{ kHz}$ ($79,5\%$ de *clunk* mecánico seco), $2\text{k--}8\text{ kHz}$ ($1,1\%$).
- **Formato final**: PCM 16-bit Mono 48 kHz (RIFF WAVE header, 17.324 bytes).

---

## 9. Asset SFX: `residues-triggered.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/residues-triggered.wav`
- **Uso en la aplicación**: SFX táctico de sabotaje Residuos enviado/activado por el jugador local (`residuesTriggered`).
- **Título original**: `Scrap metal dropping / crashing`
- **Autor / Creador**: `SamsterBirdies`
- **Fuente original / URL**: [Freesound — Scrap metal dropping / crashing (ID 587443)](https://freesound.org/people/SamsterBirdies/sounds/587443/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 17,693 segundos.
- **Fragmento seleccionado**: 0,10 s a 0,52 s (0,420 segundos / 420 ms).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de variante seca y metálica de $0{,}420\text{ s}$ ($420\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 44.1 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 140 Hz).
  5. Reducción de ganancia de -5,5 dB ($0{,}5309$ lineal).
  6. Envolvente con fade-in de 2 ms y fade-out de 50 ms.
  7. Pico máximo de $-6{,}81\text{ dBFS}$ y RMS de $-16{,}62\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 80.684 bytes).

---

## 10. Asset SFX: `residues-received.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/residues-received.wav`
- **Uso en la aplicación**: SFX táctico de sabotaje Residuos recibido por el jugador local (`residuesReceived`).
- **Título original**: `Scrap metal dropping / crashing`
- **Autor / Creador**: `SamsterBirdies`
- **Fuente original / URL**: [Freesound — Scrap metal dropping / crashing (ID 587443)](https://freesound.org/people/SamsterBirdies/sounds/587443/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 17,693 segundos.
- **Fragmento seleccionado**: 10,95 s a 11,90 s (0,950 segundos / 950 ms).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de variante caótica metálica de $0{,}950\text{ s}$ ($950\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 44.1 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 120 Hz).
  5. Reducción de ganancia de -6,5 dB ($0{,}4732$ lineal).
  6. Envolvente con fade-in de 3 ms y fade-out de 100 ms.
  7. Pico máximo de $-6{,}05\text{ dBFS}$ y RMS de $-27{,}33\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 182.444 bytes).

---

## 11. Asset SFX: `overload-triggered.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/overload-triggered.wav`
- **Uso en la aplicación**: SFX táctico de sabotaje Sobrecarga enviado/activado por el jugador local (`overloadTriggered`).
- **Título original**: `DSGNSynth_Electric Arc 01_KVV AUDIO_FREE`
- **Autor / Creador**: `KVV_Audio`
- **Fuente original / URL**: [Freesound — DSGNSynth_Electric Arc 01_KVV AUDIO_FREE (ID 729250)](https://freesound.org/people/KVV_Audio/sounds/729250/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 10,000 segundos.
- **Fragmento seleccionado**: 0,15 s a 0,50 s (0,350 segundos).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de chasquido de arco voltaico seco de $0{,}350\text{ s}$ ($350\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 96 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 90 Hz).
  5. Reducción de ganancia de -5,5 dB ($0{,}5309$ lineal).
  6. Envolvente con fade-in de 2 ms y fade-out de 50 ms.
  7. Pico máximo de $-7{,}18\text{ dBFS}$ y RMS de $-25{,}56\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 67.244 bytes).

---

## 12. Asset SFX: `overload-received.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/overload-received.wav`
- **Uso en la aplicación**: SFX táctico de sabotaje Sobrecarga recibido por el jugador local (`overloadReceived`).
- **Título original**: `DSGNSynth_Electric Arc 01_KVV AUDIO_FREE`
- **Autor / Creador**: `KVV_Audio`
- **Fuente original / URL**: [Freesound — DSGNSynth_Electric Arc 01_KVV AUDIO_FREE (ID 729250)](https://freesound.org/people/KVV_Audio/sounds/729250/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 10,000 segundos.
- **Fragmento seleccionado**: 4,20 s a 5,05 s (0,850 segundos).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de ráfaga sostenida de descarga voltaica de $0{,}850\text{ s}$ ($850\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 96 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 85 Hz).
  5. Reducción de ganancia de -5,0 dB ($0{,}5623$ lineal).
  6. Envolvente con fade-in de 3 ms y fade-out de 140 ms.
  7. Pico máximo de $-7{,}13\text{ dBFS}$ y RMS de $-24{,}69\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 163.244 bytes).

---

## 13. Asset SFX: `reverse-polarity-triggered.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/reverse-polarity-triggered.wav`
- **Uso en la aplicación**: SFX táctico de sabotaje Polaridad Inversa enviado/activado por el jugador local (`reversePolarityTriggered`).
- **Título original**: `square sweep.wav`
- **Autor / Creador**: `Blackie666`
- **Fuente original / URL**: [Freesound — square sweep.wav (ID 85340)](https://freesound.org/people/Blackie666/sounds/85340/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: 1,044375 segundos.
- **Fragmento seleccionado**: 0,7180 s a 1,0980 s (0,380 segundos / 380 ms).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de ráfaga digital agresiva de $0{,}380\text{ s}$ ($380\text{ ms}$).
  2. Mantenimiento del canal Mono (1 canal).
  3. Remuestreo de 96 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 100 Hz).
  5. Reducción de ganancia de -10,0 dB ($0{,}3162$ lineal).
  6. Envolvente con fade-in de 2 ms y fade-out de 60 ms.
  7. Pico máximo de $-9{,}11\text{ dBFS}$ y RMS de $-14{,}26\text{ dBFS}$.
- **Formato final**: PCM 16-bit Mono 48 kHz (RIFF WAVE header, 36.524 bytes).

---

## 14. Asset SFX: `reverse-polarity-received.wav`

- **Ruta final en el proyecto**: `apps/web/public/audio/sfx/reverse-polarity-received.wav`
- **Uso en la aplicación**: SFX táctico de sabotaje Polaridad Inversa recibido por el jugador local (`reversePolarityReceived`).
- **Título original**: `Noisevember Skrewell Sweeps`
- **Autor / Creador**: `funkymuskrat`
- **Fuente original / URL**: [Freesound — Noisevember Skrewell Sweeps (ID 407549)](https://freesound.org/people/funkymuskrat/sounds/407549/)
- **Licencia**: Creative Commons Zero (CC0 1.0 Universal).
- **Duración original**: ~120,66 segundos.
- **Fragmento seleccionado**: 14,10 s a 14,95 s (0,850 segundos).
- **Transformaciones técnicas aplicadas**:
  1. Recorte de ráfaga modulada caótica de $0{,}850\text{ s}$ ($850\text{ ms}$).
  2. Mantenimiento del canal Estéreo (2 canales).
  3. Remuestreo de 96 kHz a 48.000 Hz (48 kHz).
  4. Filtro pasa-altos suave (`highpass` a 90 Hz).
  5. Reducción de ganancia de -5,5 dB ($0{,}5309$ lineal).
  6. Envolvente con fade-in de 3 ms y fade-out de 130 ms.
  7. Pico máximo de $-7{,}09\text{ dBFS}$ y RMS de $-23{,}66\text{ dBFS}$.
- **Formato final**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 163.244 bytes).

---

## 15. Asset BGM: `menu.wav` *(Terminal Pulse Loop v01)*

- **Ruta final en el proyecto**: `apps/web/public/audio/music/menu.wav`
- **Uso en la aplicación**: Música ambiental principal de Menú Principal en bucle continuo sostenido (`ModeSelector`).
- **Nombre del archivo fuente original**: `rautfall_music_menu_terminal-pulse_loop_v01.wav`
- **Ubicación fuente**: `/mnt/c/Users/manue/Downloads/rautfall_music_menu_terminal-pulse_loop_v01.wav`
- **Procedencia / Generación**: Pista original de producción musical industrial/futurista para Rautfall.
- **Fecha de creación/descarga**: 4 de agosto de 2026
- **Licencia / Uso**: Integración exclusiva para la experiencia de producción de Rautfall.
- **Formato original**: PCM 16-bit Estéreo 44.1 kHz (RIFF WAVE header, 5.556.644 bytes).
- **Duración original**: 31,500 segundos (1.389.150 frames).
- **Métricas originales**: Peak izquierdo $-1{,}70\text{ dBFS}$, Peak derecho $-1{,}00\text{ dBFS}$, RMS $-15{,}94\text{ dBFS}$.
- **Distribución espectral original**: $<60\text{ Hz}$ ($43\%$), $60\text{--}120\text{ Hz}$ ($31,6\%$), $120\text{--}500\text{ Hz}$ ($21,5\%$), $500\text{ Hz--}2\text{ kHz}$ ($3\%$), $2\text{--}8\text{ kHz}$ ($<1\%$).
- **Análisis de loop y seam**: Comprobación continua de amplitud, fase y derivada en el empalme $t=31{,}500\text{ s} \to t=0{,}000\text{ s}$. El empalme entre la cola final ($L=5646$, $R=7691$) y el arranque ($L=5420$, $R=7659$) es perfectamente fluido y sin clicks (salto $< 0.7\%$ de escala), por lo que se mantiene la pista completa de $31{,}500\text{ s}$ sin recortes de duración ni crossfades destructivos.
- **Transformaciones técnicas aplicadas**:
  1. Filtro pasa-altos Butterworth de 2º orden a **50 Hz** ($Q=0{,}7071$) para erradicar el rumble subgrave $<50\text{ Hz}$ sin restar peso industrial.
  2. Ecualizador paramétrico peaking sutil en **80 Hz** ($-1{,}5\text{ dB}$, $Q=0{,}7$) para controlar la acumulación en graves.
  3. Reducción de ganancia global de **$-5{,}0\text{ dB}$** ($0{,}5623$ lineal) para dejar headroom suficiente para SFX, ducking y mezcla master.
  4. Remuestreo de alta calidad a **48.000 Hz** (48 kHz, 1.512.000 frames total).
  5. Exportación a PCM uncompressed de 16 bits Estéreo.
- **Métricas finales de producción**:
  - Peak máximo: **$-6{,}83\text{ dBFS}$** (Canal Izquierdo $-6{,}83\text{ dBFS}$, Canal Derecho $-7{,}45\text{ dBFS}$).
  - RMS medio: **$-23{,}50\text{ dBFS}$** (Canal Izquierdo $-23{,}54\text{ dBFS}$, Canal Derecho $-23{,}45\text{ dBFS}$).
  - Duración final: **31,500 segundos** (1.512.000 frames).
  - Puntos de loop: `loopStart = 0`, `loopEnd = 31.5` (archivo completo, `source.loop = true`).
  - Formato final: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 6.048.044 bytes).

---

## 16. Asset BGM: `gameplay.wav` *(Breach Protocol Loop v04)*

- **Ruta final en el proyecto**: `apps/web/public/audio/music/gameplay.wav`
- **Uso en la aplicación**: Música ambiental acelerada de combate durante la partida activa (`Training` / `Battle`).
- **Nombre del archivo fuente original**: `rautfall_music_gameplay_breach-protocol_loop_v04.wav`
- **Ubicación fuente**: `/mnt/c/Users/manue/Downloads/rautfall_music_gameplay_breach-protocol_loop_v04.wav`
- **Procedencia / Generación**: Pista musical de producción industrial electrónica rítmica para Rautfall.
- **Fecha de creación/descarga**: 6 de agosto de 2026
- **Licencia / Uso**: Integración exclusiva para la experiencia de producción de Rautfall.
- **Formato original**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 24.210.372 bytes).
- **Duración original**: 126,095 segundos (6.052.582 frames).
- **Análisis de loop y seam**: Comprobación continua de amplitud y fase en $t=126{,}095\text{ s} \to t=0{,}000\text{ s}$. El empalme es fluido sin clics ni cortes (salto $<0.023$ de amplitud relativa). Se mantiene el archivo completo de $126{,}095\text{ s}$ (`loopStart = 0`, `loopEnd = 126.1`, `source.loop = true`).
- **Transformaciones técnicas aplicadas**:
  1. Filtro pasa-altos Butterworth de 2º orden a **55 Hz** ($Q=0{,}7071$) para eliminar rumble no deseado $<55\text{ Hz}$.
  2. Peaking EQ paramétrico en **80 Hz** ($-1{,}5\text{ dB}$, $Q=0{,}7$) para controlar acumulación en graves.
  3. Reducción de ganancia global de **$-5{,}0\text{ dB}$** ($0{,}5623$ lineal) para dejar headroom suficiente para SFX, ducking y mezcla master.
  4. Formato PCM uncompressed 16-bit Estéreo 48 kHz.
- **Métricas finales de producción**:
  - Peak máximo: **$-6{,}41\text{ dBFS}$** (Canal Izquierdo $-6{,}41\text{ dBFS}$, Canal Derecho $-7{,}16\text{ dBFS}$).
  - RMS medio: **$-24{,}11\text{ dBFS}$** (Canal Izquierdo $-24{,}08\text{ dBFS}$, Canal Derecho $-24{,}15\text{ dBFS}$).
  - Duración final: **126,095 segundos** (6.052.582 frames).
  - Formato final: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 24.210.372 bytes).

---

## 17. Asset BGM: `sudden-death.wav` *(Breach Protocol 138 BPM Loop v01)*

- **Ruta final en el proyecto**: `apps/web/public/audio/music/sudden-death.wav`
- **Uso en la aplicación**: Música de máxima tensión y presión rítmica durante la fase final de Muerte Súbita (`Sudden Death`).
- **Nombre del archivo fuente original**: `rautfall_music_sudden-death_breach-protocol_138bpm_loop_v01.wav`
- **Ubicación fuente**: `/mnt/c/Users/manue/Downloads/rautfall_music_sudden-death_breach-protocol_138bpm_loop_v01.wav`
- **Procedencia / Generación**: Pista musical de alta tensión industrial a 138 BPM perteneciente a la misma familia sonora que Gameplay.
- **Fecha de creación/descarga**: 6 de agosto de 2026
- **Licencia / Uso**: Integración exclusiva para la experiencia de producción de Rautfall.
- **Formato original**: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 19.299.012 bytes).
- **Duración original / Tempo**: 100,515 segundos (4.824.742 frames) / 138 BPM.
- **Análisis de loop y seam**: Empalme limpio y fluido en $t=100{,}515\text{ s} \to t=0{,}000\text{ s}$. Se utiliza el archivo completo (`loopStart = 0`, `loopEnd = 100.5`, `source.loop = true`).
- **Transformaciones técnicas aplicadas**:
  1. Filtro pasa-altos Butterworth de 2º orden a **55 Hz** ($Q=0{,}7071$).
  2. Peaking EQ paramétrico en **80 Hz** ($-1{,}5\text{ dB}$, $Q=0{,}7$).
  3. Reducción de ganancia global de **$-5{,}0\text{ dB}$** ($0{,}5623$ lineal).
  4. Formato PCM uncompressed 16-bit Estéreo 48 kHz.
- **Ducking de la alarma EAS**: Al iniciarse `suddenDeathStarted`, `Sudden Death BGM` arranca inmediatamente pero su ganancia se atenúa a **$-10\text{ dB}$** ($0{,}3162$ lineal) con ataque rápido de 30 ms durante la reproducción de la alarma (10,0 s), recuperando suavemente el nivel nominal a lo largo de 800 ms al finalizar la alarma.
- **Métricas finales de producción**:
  - Peak máximo: **$-6{,}42\text{ dBFS}$** (Canal Izquierdo $-6{,}42\text{ dBFS}$, Canal Derecho $-7{,}17\text{ dBFS}$).
  - RMS medio: **$-24{,}30\text{ dBFS}$** (Canal Izquierdo $-24{,}27\text{ dBFS}$, Canal Derecho $-24{,}34\text{ dBFS}$).
  - Duración final: **100,515 segundos** (4.824.742 frames).
  - Formato final: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 19.299.012 bytes).

---

## 18. Asset BGM: `victory.wav` *(Sector Secured - Option 2)*

- **Ruta final en el proyecto**: `apps/web/public/audio/music/victory.wav`
- **Uso en la aplicación**: Música de victoria e himno continuado de la pantalla de Resultados (`ResultsModal`).
- **Historial de candidatos**:
  - *Candidato inicial*: `Sector Secured.wav` ($16{,}0\text{ s}$) — Sustituido durante la validación auditiva final por resultar demasiado breve para la pantalla de Resultados.
  - *Candidato definitivo*: `/mnt/c/Users/manue/Downloads/Sector Secured (Loop) - Option 2.wav` — Seleccionado por su declaración de victoria inmediata en la apertura ($0{,}0\text{--}0{,}5\text{ s}$) y su textura industrial épica sostenida.
- **Nombre del archivo fuente original**: `Sector Secured (Loop) - Option 2.wav`
- **Ubicación fuente**: `/mnt/c/Users/manue/Downloads/Sector Secured (Loop) - Option 2.wav`
- **Procedencia / Generación**: Pista musical original de victoria e himno táctico para Rautfall.
- **Fecha de creación/descarga**: 9 de agosto de 2026
- **Licencia / Uso**: Integración exclusiva para la experiencia de producción de Rautfall.
- **Formato original**: PCM 16-bit Estéreo 48 kHz ($170{,}176\text{ s}$, 8.168.448 frames, RIFF WAVE header, 32.686.806 bytes).
- **Métricas originales**: Peak derecho $0{,}00\text{ dBFS}$ (izquierdo $-1{,}23\text{ dBFS}$), RMS $-21{,}28\text{ dBFS}$.
- **Construcción del loop**:
  - Región seleccionada: $0{,}000\text{ s}$ a $42{,}000\text{ s}$ ($42{,}000\text{ s}$ exactos, 2.016.000 frames).
  - Crossfade de igual potencia de $150\text{ ms}$ en la frontera del empalme ($t=42{,}000\text{ s} \to t=0{,}000\text{ s}$) para una transición limpia y sin cortes.
  - Análisis del empalme (Seam): RMS Head ($0\text{--}500\text{ ms}$) $-23{,}15\text{ dBFS}$, RMS Tail (últimos $500\text{ ms}$) $-22{,}81\text{ dBFS}$, variación de energía $\Delta = 0{,}34\text{ dB}$. Discontinuidad de muestra en empalme $< 2\%$ de escala.
- **Transformaciones técnicas aplicadas**:
  1. Filtro pasa-altos Butterworth de 2º orden a **55 Hz** ($Q=0{,}7071$).
  2. Peaking EQ paramétrico en **80 Hz** ($-1{,}5\text{ dB}$, $Q=0{,}7$).
  3. Ajuste de ganancia global de **$-0{,}5\text{ dB}$** ($0{,}9441$ lineal) para ubicar el pico máximo en el rango objetivo entre $-6$ y $-8\text{ dBFS}$.
  4. Formato PCM uncompressed 16-bit Estéreo 48 kHz.
- **Métricas finales de producción**:
  - Peak máximo: **$-7{,}40\text{ dBFS}$** (Canal Izquierdo $-7{,}40\text{ dBFS}$, Canal Derecho $-7{,}42\text{ dBFS}$).
  - RMS medio: **$-25{,}73\text{ dBFS}$** (Canal Izquierdo $-25{,}73\text{ dBFS}$, Canal Derecho $-25{,}77\text{ dBFS}$).
  - Duración final: **42,000 segundos** (2.016.000 frames).
  - Puntos de loop: `loopStart = 0`, `loopEnd = 42.0` (`source.loop = true`).
  - Formato final: PCM 16-bit Estéreo 48 kHz (RIFF WAVE header, 8.064.044 bytes).
