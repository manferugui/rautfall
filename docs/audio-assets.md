# Registro de Assets de Audio — Rautfall

## Estado actual
- **Estado de activos musicales**: No hay assets musicales integrados todavía.
- **Infraestructura**: El subsistema de audio (`apps/web/src/audio/`) está completamente preparado con soporte para Web Audio API, efectos de sonido sintéticos y una API de música ambiental (`playMusic`, `stopMusic`, `setMusicIntensity`) libre de peticiones de red o errores 404 ante la ausencia de ficheros binarios.

---

## Estructura del registro y campos requeridos para futuras exportaciones

Cuando se generen e integren pistas musicales desde **Google Flow Music**, cada recurso deberá registrarse obligatoriamente en este archivo completando la siguiente ficha técnica:

```markdown
### `public/audio/music/[nombre-fichero].mp3`

- **Identificador de pista**: `menu` | `gameplay` | `suddenDeath`
- **Herramienta de generación**: Google Flow Music
- **Prompt textual utilizado**: "[Prompt exacto introducido en Google Flow Music]"
- **Fecha de generación**: YYYY-MM-DD
- **Versión seleccionada**: v1.0
- **Formato original**: MP3 / WAV
- **Transformaciones realizadas**: Normalización LUFS, trimming, ajuste de loop, fade in/out
- **Condiciones de uso y licencia**: Licencia verificada de Google Flow Music para el TFM Rautfall
- **Atribución**: [Texto de atribución si procede]
```

---

## Instrucciones para documentar exportaciones de Google Flow Music

1. Generar la pieza musical en Google Flow Music ajustada a la dirección estética *Industrial Dramatic*.
2. Exportar el recurso en formato `.mp3` (192 kbps o superior).
3. Guardar el archivo en `apps/web/public/audio/music/` respetando los nombres estables del contrato (`menu.mp3`, `gameplay.mp3`, `sudden-death.mp3`).
4. Añadir una entrada completa en este documento completando todos los campos obligatorios antes de declarar finalizada la tarea de integración musical.
