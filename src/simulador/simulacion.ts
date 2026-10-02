import { cuotaAhorro } from './impuestos';

// Simulador: aportaciones mensuales a fondos indexados frente a una cuenta remunerada
// (SPEC §7.1–§7.3). Euros en float; los resultados se redondean al céntimo.
export interface Parametros {
  /** Aportación inicial (€) */
  inicial: number;
  /** Aportación mensual (€), al final de cada mes */
  mensual: number;
  /** Plazo en años */
  anios: number;
  /** TAE de la cuenta (0,025 = 2,5 %) */
  tae: number;
  /** Rentabilidad bruta anual del fondo por escenario */
  rentabilidades: { pesimista: number; base: number; optimista: number };
  /** TER anual del fondo (0,002 = 0,2 %) */
  ter: number;
  /** Inflación anual (0,02 = 2 %) */
  inflacion: number;
}

export interface PuntoAnual {
  anio: number;
  aportado: number;
  valor: number;
}

export interface Resultado {
  aportado: number;
  /** Valor final antes de impuestos (en la cuenta, los intereses ya han tributado cada año) */
  bruto: number;
  impuestos: number;
  neto: number;
  /** Neto en euros de hoy: neto / (1 + inflación)^años */
  netoReal: number;
  serie: PuntoAnual[];
}

const redondear = (x: number) => Math.round(x * 100) / 100;

/**
 * Cuenta remunerada (SPEC §7.2): tipo mensual (1 + TAE)^(1/12) − 1; los intereses de cada año
 * tributan al cierre del año [por verificar] y lo que queda sigue capitalizando.
 */
export function simularCuenta(p: Parametros, conImpuestos = true): Resultado {
  const i = (1 + p.tae) ** (1 / 12) - 1;
  const meses = Math.round(p.anios * 12);
  let saldo = p.inicial;
  let interesesAnio = 0;
  let impuestos = 0;
  const serie: PuntoAnual[] = [{ anio: 0, aportado: p.inicial, valor: p.inicial }];
  for (let m = 1; m <= meses; m += 1) {
    const interes = saldo * i;
    saldo += interes + p.mensual;
    interesesAnio += interes;
    if (m % 12 === 0 || m === meses) {
      if (conImpuestos) {
        const cuota = cuotaAhorro(interesesAnio);
        saldo -= cuota;
        impuestos += cuota;
      }
      interesesAnio = 0;
      serie.push({ anio: Math.ceil(m / 12), aportado: redondear(p.inicial + p.mensual * m), valor: redondear(saldo) });
    }
  }
  const neto = redondear(saldo);
  return {
    aportado: redondear(p.inicial + p.mensual * meses),
    bruto: neto,
    impuestos: redondear(impuestos),
    neto,
    netoReal: redondear(neto / (1 + p.inflacion) ** p.anios),
    serie,
  };
}

/**
 * Fondo indexado (SPEC §7.3): factor mensual (1 + r)^(1/12) · (1 − TER)^(1/12); no tributa
 * hasta el reembolso (traspasos sin peaje fiscal [por verificar]); reembolso total en el año N.
 */
export function simularFondo(p: Parametros, rentabilidad: number): Resultado {
  const factor = (1 + rentabilidad) ** (1 / 12) * (1 - p.ter) ** (1 / 12);
  const meses = Math.round(p.anios * 12);
  let valor = p.inicial;
  const serie: PuntoAnual[] = [{ anio: 0, aportado: p.inicial, valor: p.inicial }];
  for (let m = 1; m <= meses; m += 1) {
    valor = valor * factor + p.mensual;
    if (m % 12 === 0 || m === meses) {
      serie.push({ anio: Math.ceil(m / 12), aportado: redondear(p.inicial + p.mensual * m), valor: redondear(valor) });
    }
  }
  const bruto = redondear(valor);
  const aportado = redondear(p.inicial + p.mensual * meses);
  const impuestos = cuotaAhorro(Math.max(bruto - aportado, 0));
  const neto = redondear(bruto - impuestos);
  return { aportado, bruto, impuestos, neto, netoReal: redondear(neto / (1 + p.inflacion) ** p.anios), serie };
}

export interface Comparativa {
  cuenta: Resultado;
  pesimista: Resultado;
  base: Resultado;
  optimista: Resultado;
}

export function simular(p: Parametros): Comparativa {
  return {
    cuenta: simularCuenta(p),
    pesimista: simularFondo(p, p.rentabilidades.pesimista),
    base: simularFondo(p, p.rentabilidades.base),
    optimista: simularFondo(p, p.rentabilidades.optimista),
  };
}

export const PARAMETROS_DEFECTO: Parametros = {
  inicial: 0,
  mensual: 200,
  anios: 15,
  tae: 0.025,
  rentabilidades: { pesimista: 0.02, base: 0.05, optimista: 0.07 },
  ter: 0.002,
  inflacion: 0.025,
};
