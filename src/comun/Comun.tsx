import { useEffect, useState } from 'preact/hooks';
import { listarLiquidaciones, movimientosParaSaldo, type LiquidacionGuardada } from '../datos/repos/comun';
import { idUsuarioActual, listarMiembros, type Miembro } from '../datos/repos/espacios';
import { useEspacios, type Espacio } from '../espacios/estado';
import { formatearEUR } from '../nucleo/formato';
import { nombreDia } from '../nucleo/textos';
import { estadoPara, saldos, type EstadoSaldo } from './saldo';

interface DatosEspacio {
  yo: string;
  otro: Miembro | null;
  estado: EstadoSaldo;
  liquidaciones: LiquidacionGuardada[];
}

async function cargar(espacio: Espacio): Promise<DatosEspacio> {
  const [yo, miembros, movimientos, liquidaciones] = await Promise.all([
    idUsuarioActual(),
    listarMiembros(espacio.id),
    movimientosParaSaldo(espacio.id),
    listarLiquidaciones(espacio.id),
  ]);
  if (!yo) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  const otro = miembros.find((m) => m.user_id !== yo) ?? null;
  const estado = otro ? estadoPara(yo, otro.user_id, saldos(movimientos, liquidaciones)) : ({ tipo: 'en-paz' } as const);
  return { yo, otro, estado, liquidaciones };
}

/** Textos del saldo desde el punto de vista de quien mira (SPEC §4.6). */
export function textoSaldo(estado: EstadoSaldo, otro: Miembro | null): string {
  const nombre = otro?.email ?? 'la otra persona';
  switch (estado.tipo) {
    case 'te-deben':
      return `${nombre} te debe ${formatearEUR(estado.importe)}`;
    case 'debes':
      return `Debes ${formatearEUR(estado.importe)} a ${nombre}`;
    case 'en-paz':
      return 'Estáis en paz';
  }
}

/** Pestaña «Común»: saldo de cada espacio compartido y su historial de pagos (SPEC F6). */
export function Comun() {
  const { cargado, espacios } = useEspacios();
  const compartidos = espacios.filter((e) => e.tipo === 'compartido');

  if (!cargado) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <h1>Común</h1>
      {compartidos.length === 0 ? (
        <p class="vacio">
          Aún no tienes espacios compartidos. <a href="#/ajustes/espacios">Crea «Pareja» o «Piso»</a> para llevar los gastos comunes.
        </p>
      ) : (
        compartidos.map((e) => <TarjetaEspacio key={e.id} espacio={e} />)
      )}
    </section>
  );
}

function TarjetaEspacio({ espacio }: { espacio: Espacio }) {
  const [datos, setDatos] = useState<DatosEspacio | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cargar(espacio).then(setDatos, (e: Error) => setError(e.message));
  }, [espacio.id]);

  return (
    <section class="tarjeta bloque" aria-labelledby={`saldo-${espacio.id}`}>
      <h2 id={`saldo-${espacio.id}`}>{espacio.nombre}</h2>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {!error && !datos && <p class="nota">Cargando…</p>}
      {datos && !datos.otro && (
        <p class="nota">
          Aún no has añadido a la otra persona. <a href="#/ajustes/espacios">Añadirla</a>
        </p>
      )}
      {datos?.otro && (
        <>
          <p class={`saldo saldo--${datos.estado.tipo}`} data-testid="saldo">
            {textoSaldo(datos.estado, datos.otro)}
          </p>
          {datos.estado.tipo !== 'en-paz' && (
            <p>
              <a class="boton" href={`#/comun/${espacio.id}/saldar`}>
                Saldar
              </a>
            </p>
          )}
          {datos.liquidaciones.length > 0 && (
            <>
              <h3 class="subtitulo">Pagos registrados</h3>
              <ul class="lista-simple">
                {datos.liquidaciones.slice(0, 5).map((l) => (
                  <li key={l.id}>
                    <span>
                      {l.de_user === datos.yo ? 'Pagaste' : 'Te pagó'} {formatearEUR(l.importe)}
                      {l.nota ? ` · ${l.nota}` : ''}
                    </span>
                    <span class="nota">{nombreDia(l.fecha)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
