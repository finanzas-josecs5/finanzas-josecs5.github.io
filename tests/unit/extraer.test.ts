import { describe, expect, it } from 'vitest';
import { extraer } from '../../src/ocr/extraer';

// Textos tal como los devuelve el OCR de los tickets sintéticos (tests/fixtures/ticket-sintetico-*.png)
const TICKET_1 = `SUPERMERCADO EJEMPLO S.A.
C/ Inventada 123, Madrid
NIF A00000000
05/09/26 18:42

PAN DE MOLDE 1,85
LECHE ENTERA 6U 5,40
MANZANAS 1KG 2,75

SUBTOTAL 10,00
IVA 21% 2,10
TOTAL 12,10

TARJETA 12,10`;

const TICKET_2 = `FARMACIA DEMO
Avda. Ficticia 9, Valencia
Fecha: 12-08-2026

IBUPROFENO 600 3,20
CREMA SOLAR 20,25

TOTAL EUR 23,45`;

const TICKET_3 = `RESTAURANTE PRUEBA
Plaza Imaginaria 1, Sevilla
21/09/2026 22:10

2 MENU DEL DIA 30,00
1 VINO TINTO 12,50
2 CAFE 2,80
BASE IMPONIBLE 41,27
IVA 10% 4,13
TOTAL A PAGAR 48,90
CAMBIO 1,10`;

describe('extraer datos del texto del OCR (CA5.1–CA5.4)', () => {
  it('CA5.1: con subtotal e IVA, el total es 12,10 con confianza alta', () => {
    expect(extraer(TICKET_1)).toEqual({ importe: 1210, fecha: '2026-09-05', comercio: 'SUPERMERCADO EJEMPLO S.A', confianza: 'alta' });
  });

  it('CA5.2: «TOTAL EUR 1.234,56» → 1.234,56', () => {
    expect(extraer('TIENDA\nTOTAL EUR 1.234,56').importe).toBe(123456);
    expect(extraer(TICKET_2)).toEqual({ importe: 2345, fecha: '2026-08-12', comercio: 'FARMACIA DEMO', confianza: 'alta' });
  });

  it('ignora la base imponible, el IVA y el cambio', () => {
    expect(extraer(TICKET_3)).toMatchObject({ importe: 4890, fecha: '2026-09-21', comercio: 'RESTAURANTE PRUEBA', confianza: 'alta' });
  });

  it('CA5.3: sin «TOTAL», el importe mayor con confianza baja', () => {
    expect(extraer('BAR PEPE\nCAFE 1,20\nTOSTADA 2,50\nCAMBIO 6,30')).toMatchObject({ importe: 250, confianza: 'baja' });
  });

  it('CA5.3: texto vacío → todo vacío con confianza baja', () => {
    expect(extraer('')).toEqual({ importe: null, fecha: null, comercio: null, confianza: 'baja' });
    expect(extraer('   \n \n')).toEqual({ importe: null, fecha: null, comercio: null, confianza: 'baja' });
  });

  it('CA5.4: «05/09/26» → 2026-09-05 y otras formas de fecha', () => {
    expect(extraer('05/09/26').fecha).toBe('2026-09-05');
    expect(extraer('Fecha 3.7.2026').fecha).toBe('2026-07-03');
    expect(extraer('31/02/26 y luego 01/03/26').fecha).toBe('2026-03-01');
    expect(extraer('sin fecha').fecha).toBeNull();
  });

  it('errores típicos del OCR: «T0TAL» con cero da confianza media; punto decimal', () => {
    expect(extraer('KIOSCO\nT0TAL 7.50')).toMatchObject({ importe: 750, confianza: 'media' });
  });

  it('con dos líneas de total se queda la mayor', () => {
    expect(extraer('TOTAL ARTICULOS 3\nTOTAL 9,99\nTOTAL EUR 9,99')).toMatchObject({ importe: 999, confianza: 'alta' });
  });

  it('el comercio salta direcciones, NIF y líneas con importes', () => {
    expect(extraer('NIF B12345678\nC/ Mayor 1\nPANADERIA LA ESPIGA\nTOTAL 3,00').comercio).toBe('PANADERIA LA ESPIGA');
    expect(extraer('12,00\n45\nTOTAL 12,00').comercio).toBeNull();
  });
});
