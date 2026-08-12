/**
 * Ayudante visual compartido para dar volumen/bisel a los tetrominós en el render
 * de Phaser (GameScene). Solo aclara/oscurece un color 0xRRGGBB — no toca lógica
 * de dominio, colisiones ni PieceType.
 */

/**
 * Aclara (percent > 0) u oscurece (percent < 0) un color 0xRRGGBB.
 * percent está en el rango [-1, 1].
 */
export function shadeColor(color: number, percent: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const mix = (channel: number): number =>
    percent >= 0 ? channel + (255 - channel) * percent : channel * (1 + percent);

  return (clamp(mix(r)) << 16) | (clamp(mix(g)) << 8) | clamp(mix(b));
}
