import { ultimaValoracion } from '../cartera/cartera';
import { categoriaComun, misPartes } from '../comun/miParte';
import { estadoPara, saldos } from '../comun/saldo';
import { obtenerAjustes } from '../datos/repos/ajustes';
import { listarFondos, movimientosCartera } from '../datos/repos/cartera';
import { listarLiquidaciones, movimientosParaSaldo } from '../datos/repos/comun';
import { idUsuarioActual, listarMiembros } from '../datos/repos/espacios';
import { listarLiquidez } from '../datos/repos/liquidez';
import { listarCategorias, listarMovimientosEntre } from '../datos/repos/movimientos';
import { listarRecurrencias } from '../datos/repos/recurrencias';
import type { Espacio } from '../espacios/estado';
import type { MovimientoBasico } from '../movimientos/calculos';
import { pasoEnMeses, proximaOcurrencia } from '../movimientos/recurrencias';
import { centimos, type Centimos } from '../nucleo/dinero';
import { claveMes, hoy, mesesCompletosAnteriores, ultimoDiaDelMes, type FechaISO } from '../nucleo/fechas';
import { normalizarComercio } from '../nucleo/normalizar';
import { UMBRALES_DEFECTO, type DatosConsejos, type MesResumido, type Umbrales } from './reglas';

/** Umbrales guardados en Ajustes → Preferencias, completados con los de por defecto. */
export function umbralesDe(guardados: Record<string, unknown>): Umbrales {
  const u = { ...UMBRALES_DEFECTO };
  for (const clave of Object.keys(u) as (keyof Umbrales)[]) {
    const v = guardados[clave];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) u[clave] = v;
  }
  return u;
}

/** Junta los datos que necesitan las reglas (SPEC §7.6). Solo lectura; todo lo filtra la RLS. */
export async function cargarDatosConsejos(espacios: readonly Espacio[]): Promise<{ datos: DatosConsejos; umbrales: Umbrales }> {
  const fecha = hoy();
  const meses = mesesCompletosAnteriores(fecha, 12);
  const primero = `${meses[0] ?? claveMes(fecha)}-01`;
  const ultimoMes = meses.at(-1) ?? claveMes(fecha);
  const ultimo = `${ultimoMes}-${String(ultimoDiaDelMes(ultimoMes)).padStart(2, '0')}`;
  const yoEspacio = espacios.find((e) => e.tipo === 'individual');
  const compartidos = espacios.filter((e) => e.tipo === 'compartido');
  const yo = await idUsuarioActual();
  if (!yoEspacio || !yo) throw new Error('No se han podido cargar tus datos.');

  const [ajustes, categorias, movimientos, liquidez, fondos, cartera, recurrencias, comunes] = await Promise.all([
    obtenerAjustes().catch(() => ({ simulador: {}, umbrales: {} })),
    listarCategorias(yoEspacio.id),
    listarMovimientosEntre(yoEspacio.id, primero, ultimo),
    listarLiquidez(),
    listarFondos(),
    movimientosCartera(),
    listarRecurrencias(yoEspacio.id),
    Promise.all(
      compartidos.map(async (e) => ({
        espacio: e,
        movimientosMes: await listarMovimientosEntre(e.id, primero, ultimo),
        todos: await movimientosParaSaldo(e.id),
        liquidaciones: await listarLiquidaciones(e.id),
        miembros: await listarMiembros(e.id),
      })),
    ),
  ]);

  // Meses con mis movimientos y mi parte de lo común (SPEC CA6.3)
  const nombres = new Map(categorias.map((c) => [c.id, c.nombre]));
  for (const e of compartidos) {
    for (const c of [categoriaComun(e.id, e.nombre, 'salida'), categoriaComun(e.id, e.nombre, 'entrada')]) nombres.set(c.id, c.nombre);
  }
  const todos: MovimientoBasico[] = [...movimientos, ...comunes.flatMap((c) => misPartes(c.movimientosMes, yo, c.espacio.id))];
  const resumidos: MesResumido[] = meses.map((m) => {
    const delMes = todos.filter((x) => claveMes(x.fecha) === m);
    const porCategoria: Record<string, Centimos> = {};
    let entradas = 0;
    let salidas = 0;
    for (const x of delMes) {
      if (x.sentido === 'entrada') entradas += x.importe;
      else {
        salidas += x.importe;
        const nombre = nombres.get(x.categoria_id) ?? 'Otros';
        porCategoria[nombre] = centimos((porCategoria[nombre] ?? 0) + x.importe);
      }
    }
    return { mes: m, entradas: centimos(entradas), salidas: centimos(salidas), porCategoria };
  });
  // Los meses anteriores a empezar a usar la app no cuentan (falsearían las medias)
  const primerConDatos = resumidos.findIndex((m) => m.entradas > 0 || m.salidas > 0);

  const suscripciones = recurrencias
    .filter((r) => r.sentido === 'salida' && normalizarComercio(nombres.get(r.categoria_id) ?? '') === 'suscripciones')
    .filter((r) => proximaOcurrencia(r, fecha) !== null)
    .map((r) => ({ nombre: r.comercio ?? r.concepto ?? 'Suscripción', anual: centimos(Math.round((r.importe * 12) / pasoEnMeses(r))) }));

  const saldosPendientes = comunes.flatMap((c) => {
    const otro = c.miembros.find((m) => m.user_id !== yo);
    if (!otro) return [];
    const estado = estadoPara(yo, otro.user_id, saldos(c.todos, c.liquidaciones));
    if (estado.tipo === 'en-paz') return [];
    const desde: FechaISO | null = c.liquidaciones[0]?.fecha ?? c.todos[0]?.fecha ?? null;
    return [{ espacio: c.espacio.nombre, tipo: estado.tipo, importe: estado.importe, desde }];
  });

  return {
    umbrales: umbralesDe(ajustes.umbrales),
    datos: {
      hoy: fecha,
      meses: primerConDatos < 0 ? [] : resumidos.slice(primerConDatos),
      liquidez: liquidez[0] ? { fecha: liquidez[0].fecha, importe: liquidez[0].importe } : null,
      fondos: fondos.map((f) => ({
        nombre: f.nombre,
        ter: f.ter,
        ultimaValoracion: ultimaValoracion(cartera.valoraciones.filter((v) => v.fondo_id === f.id))?.fecha ?? null,
      })),
      suscripciones,
      saldos: saldosPendientes,
    },
  };
}
