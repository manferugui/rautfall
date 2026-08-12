import { describe, it, expect } from 'vitest';
import { DEV_DEMOS, buildDemoTargetUrl, clearDevDemoQueryParams } from './dev-demos';

describe('dev-demos (Registro Centralizado de Demos DEV)', () => {
  it('contiene 14 escenarios canónicos registrados', () => {
    expect(DEV_DEMOS.length).toBe(14);
  });

  it('garantiza que todos los identificadores (ID) son únicos', () => {
    const ids = DEV_DEMOS.map((demo) => demo.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('garantiza que cada definición posee label, descripción, categoría y query no vacíos', () => {
    for (const demo of DEV_DEMOS) {
      expect(demo.id.trim()).not.toBe('');
      expect(demo.label.trim()).not.toBe('');
      expect(demo.description.trim()).not.toBe('');
      expect(['battle', 'mechanics', 'audio']).toContain(demo.category);
      expect(Object.keys(demo.query).length).toBeGreaterThan(0);
    }
  });

  it('construye una URL limpia desde cero sin arrastrar query params previos', () => {
    const tspinQuery = { 'tspin-demo': '1' };
    const targetUrl = buildDemoTargetUrl(tspinQuery, '/');
    expect(targetUrl).toBe('/?tspin-demo=1');

    const battleQuery = { 'battle-demo': '1', 'sudden-death-demo': '1' };
    const battleUrl = buildDemoTargetUrl(battleQuery, '/app');
    expect(battleUrl).toBe('/app?battle-demo=1&sudden-death-demo=1');
  });

  it('devuelve únicamente el pathname si la query está vacía', () => {
    const cleanUrl = buildDemoTargetUrl({}, '/');
    expect(cleanUrl).toBe('/');
  });

  describe('clearDevDemoQueryParams', () => {
    it('elimina battle-demo de la URL', () => {
      const result = clearDevDemoQueryParams('/?battle-demo=1');
      expect(result).toBe('/');
    });

    it('elimina debug-panel de la URL', () => {
      const result = clearDevDemoQueryParams('/?debug-panel=1');
      expect(result).toBe('/');
    });

    it('elimina combinaciones de múltiples flags DEV', () => {
      const result = clearDevDemoQueryParams('/?battle-demo=1&debug-panel=1&sudden-death-demo=1');
      expect(result).toBe('/');
    });

    it('preserva parámetros de consulta no DEV / desconocidos', () => {
      const result = clearDevDemoQueryParams('/?battle-demo=1&foo=bar');
      expect(result).toBe('/?foo=bar');
    });

    it('sin query no altera la URL original', () => {
      const result = clearDevDemoQueryParams('/path#section');
      expect(result).toBe('/path#section');
    });
  });
});
