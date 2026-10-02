import { supabase } from '../datos/cliente';
import type { Espacio } from '../espacios/estado';
import { sinCamposServidor, VERSION_COPIA, type Copia, type DatosEspacio } from './formato';

type Fila = Record<string, unknown>;

async function filas(tabla: string, filtro?: [string, string]): Promise<Fila[]> {
  let consulta = supabase().from(tabla).select('*');
  if (filtro) consulta = consulta.eq(filtro[0], filtro[1]);
  const { data, error } = await consulta.returns<Fila[]>();
  if (error) throw new Error(`No se ha podido leer «${tabla}».`);
  return data;
}

async function datosEspacio(e: Espacio): Promise<DatosEspacio> {
  const [categorias, movimientos, recurrencias, comercios] = await Promise.all(
    ['categorias', 'movimientos', 'recurrencias', 'comercios'].map((t) => filas(t, ['espacio_id', e.id])),
  );
  return { nombre: e.nombre, categorias: categorias ?? [], movimientos: movimientos ?? [], recurrencias: recurrencias ?? [], comercios: comercios ?? [] };
}

/** Todos tus datos: los individuales y una copia de los espacios compartidos (SPEC §4.11). */
export async function exportarDatos(espacios: readonly Espacio[]): Promise<Copia> {
  const yo = espacios.find((e) => e.tipo === 'individual');
  if (!yo) throw new Error('No se encuentra tu espacio «Yo».');
  const [individual, nomina, ajustes, liquidez, fondos, aportaciones, valoraciones, compartidos] = await Promise.all([
    datosEspacio(yo),
    filas('nomina'),
    filas('ajustes'),
    filas('liquidez'),
    filas('fondos'),
    filas('aportaciones'),
    filas('valoraciones'),
    Promise.all(
      espacios
        .filter((e) => e.tipo === 'compartido')
        .map(async (e) => ({ ...(await datosEspacio(e)), liquidaciones: await filas('liquidaciones', ['espacio_id', e.id]) })),
    ),
  ]);
  return {
    formato: 'finanzas-personales-datos',
    version: VERSION_COPIA,
    exportado: new Date().toISOString(),
    individual: { ...individual, nomina: nomina[0] ?? null, ajustes: ajustes[0] ?? null, liquidez, fondos, aportaciones, valoraciones },
    compartidos,
  };
}

async function ejecutar(promesa: PromiseLike<{ error: { message: string } | null }>, accion: string): Promise<void> {
  const { error } = await promesa;
  if (error) throw new Error(`No se ha podido ${accion}. Tus datos pueden haber quedado a medias: vuelve a importar la copia.`);
}

/**
 * Sustituye TUS datos individuales por los de la copia (SPEC CA12.1). Los espacios compartidos
 * no se tocan: también son de la otra persona. Se reutilizan los identificadores originales,
 * así las relaciones (categoría, recurrente, fondo) se conservan sin tener que rehacerlas.
 */
export async function importarDatos(copia: Copia, espacioYo: string): Promise<void> {
  const db = supabase();
  const i = copia.individual;
  const enYo = (f: Fila, quitar: string[] = []) => ({ ...sinCamposServidor(f, ['espacio_id', ...quitar]), espacio_id: espacioYo });

  // 1. Borrar lo actual (en orden, por las claves foráneas)
  await ejecutar(db.from('comercios').delete().eq('espacio_id', espacioYo), 'borrar los comercios');
  await ejecutar(db.from('movimientos').delete().eq('espacio_id', espacioYo), 'borrar los movimientos');
  await ejecutar(db.from('recurrencias').delete().eq('espacio_id', espacioYo), 'borrar los recurrentes');
  await ejecutar(db.from('categorias').delete().eq('espacio_id', espacioYo), 'borrar las categorías');
  await ejecutar(db.from('fondos').delete().not('id', 'is', null), 'borrar los fondos');
  await ejecutar(db.from('liquidez').delete().not('id', 'is', null), 'borrar la liquidez');
  await ejecutar(db.from('nomina').delete().not('pagas', 'is', null), 'borrar la nómina');

  // 2. Insertar la copia (categorías → recurrentes → movimientos → comercios; fondos → aportaciones y valores)
  if (i.categorias.length > 0) await ejecutar(db.from('categorias').insert(i.categorias.map((f) => enYo(f))), 'restaurar las categorías');
  if (i.recurrencias.length > 0) {
    await ejecutar(db.from('recurrencias').insert(i.recurrencias.map((f) => enYo(f, ['pagado_por']))), 'restaurar los recurrentes');
  }
  if (i.movimientos.length > 0) {
    await ejecutar(db.from('movimientos').insert(i.movimientos.map((f) => enYo(f, ['pagado_por', 'reparto']))), 'restaurar los movimientos');
  }
  if (i.comercios.length > 0) await ejecutar(db.from('comercios').insert(i.comercios.map((f) => enYo(f))), 'restaurar los comercios');
  if (i.fondos.length > 0) await ejecutar(db.from('fondos').insert(i.fondos.map((f) => sinCamposServidor(f))), 'restaurar los fondos');
  if (i.aportaciones.length > 0) await ejecutar(db.from('aportaciones').insert(i.aportaciones.map((f) => sinCamposServidor(f))), 'restaurar las aportaciones');
  if (i.valoraciones.length > 0) await ejecutar(db.from('valoraciones').insert(i.valoraciones.map((f) => sinCamposServidor(f))), 'restaurar los valores');
  if (i.liquidez.length > 0) await ejecutar(db.from('liquidez').insert(i.liquidez.map((f) => sinCamposServidor(f))), 'restaurar la liquidez');
  if (i.nomina) await ejecutar(db.from('nomina').insert(sinCamposServidor(i.nomina)), 'restaurar la nómina');
  if (i.ajustes) {
    const { data: sesion } = await db.auth.getSession();
    const userId = sesion.session?.user.id;
    if (userId) await ejecutar(db.from('ajustes').upsert({ ...sinCamposServidor(i.ajustes), user_id: userId }, { onConflict: 'user_id' }), 'restaurar los ajustes');
  }
}
