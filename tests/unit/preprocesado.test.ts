import { describe, expect, it } from 'vitest';
import { grisConContraste, tamanoReducido } from '../../src/ocr/preprocesado';

describe('preprocesado de la imagen del ticket', () => {
  it('reduce al lado máximo conservando la proporción y nunca amplía', () => {
    expect(tamanoReducido(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 });
    expect(tamanoReducido(1080, 4000)).toEqual({ ancho: 432, alto: 1600 });
    expect(tamanoReducido(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(tamanoReducido(10000, 1)).toEqual({ ancho: 1600, alto: 1 });
  });

  it('pasa a gris y estira el contraste de 0 a 255', () => {
    // Dos píxeles desvaídos: gris claro (200) y gris medio (100)
    const pixeles = new Uint8ClampedArray([200, 200, 200, 255, 100, 100, 100, 255]);
    grisConContraste(pixeles);
    expect([...pixeles]).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
  });

  it('usa la luminancia: el rojo puro es más oscuro que el verde puro', () => {
    const pixeles = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 255]);
    grisConContraste(pixeles);
    expect(pixeles[0]).toBeLessThan(pixeles[4] ?? 0);
  });

  it('una imagen de un solo tono se queda como está', () => {
    const pixeles = new Uint8ClampedArray([120, 120, 120, 255, 120, 120, 120, 255]);
    grisConContraste(pixeles);
    expect([...pixeles]).toEqual([120, 120, 120, 255, 120, 120, 120, 255]);
  });
});
