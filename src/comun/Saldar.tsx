import { useEffect, useState } from 'preact/hooks';
import { crearLiquidacion, listarLiquidaciones, movimientosParaSaldo } from '../datos/repos/comun';
import { idUsuarioActual, listarMiembros, type Miembro } from '../datos/repos/espacios';
import { useEspacios } from '../espacios/estado';
import { parsearImporte, textoEditable } from '../nucleo/dinero';
import { esFechaISO, hoy } from '../nucleo/fechas';
import { formatearEUR } from '../nucleo/formato';
import { ListaErrores } from '../ui/ListaErrores';
import { navegar } from '../ui/router';
import { liquidacionPendiente, saldos, type Liquidacion } from './saldo';

/**
 * Registrar un pago entre los dos miembros (SPEC §4.6). Se propone lo pendiente, pero
 * se puede saldar solo una parte. No mueve dinero real: solo lo apunta.
 */
export function Saldar({ espacioId }: { espacioId: string }) {
  const { espacios } = useEspacios();
  const espacio = espacios.find((e) => e.id === espacioId);
  const [pendiente, setPendiente] = useState<Liquidacion | null | undefined>(undefined);
  const [yo, setYo] = useState('');
  const [otro, setOtro] = useState<Miembro | null>(null);
  const [importeTexto, setImporteTexto] = useState('');
  const [fecha, setFecha] = useState<string>(hoy());
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [id, miembros, movimientos, liquidaciones] = await Promise.all([
          idUsuarioActual(),
          listarMiembros(espacioId),
          movimientosParaSaldo(espacioId),
          listarLiquidaciones(espacioId),
        ]);
        const elOtro = miembros.find((m) => m.user_id !== id) ?? null;
        if (!id || !elOtro) {
          setPendiente(null);
          return;
        }
        const l = liquidacionPendiente(id, elOtro.user_id, saldos(movimientos, liquidaciones));
        setYo(id);
        setOtro(elOtro);
        setPendiente(l);
        if (l) setImporteTexto(textoEditable(l.importe));
      } catch (e) {
        setErrores([e instanceof Error ? e.message : 'No se ha podido cargar el saldo.']);
        setPendiente(null);
      }
    })();
  }, [espacioId]);

  if (pendiente === undefined) return <p class="cargando">Cargando…</p>;

  const volver = (
    <p>
      <a href="#/comun">‹ Común</a>
    </p>
  );
  if (!pendiente || !otro) {
    return (
      <section>
        {volver}
        <h1>Saldar</h1>
        <ListaErrores errores={errores} />
        <p>No hay nada pendiente en {espacio?.nombre ?? 'este espacio'}: estáis en paz.</p>
      </section>
    );
  }

  const pagoYo = pendiente.de_user === yo;

  async function enviar(e: Event) {
    e.preventDefault();
    if (!pendiente) return;
    const importe = parsearImporte(importeTexto);
    const problemas: string[] = [];
    if (!importe.ok || importe.importe <= 0) problemas.push('Escribe un importe mayor que cero.');
    else if (importe.importe > pendiente.importe) problemas.push(`No puede ser mayor que lo pendiente (${formatearEUR(pendiente.importe)}).`);
    if (!esFechaISO(fecha)) problemas.push('La fecha no es válida.');
    setErrores(problemas);
    if (problemas.length > 0 || !importe.ok || !esFechaISO(fecha)) return;
    setGuardando(true);
    try {
      await crearLiquidacion(espacioId, {
        de_user: pendiente.de_user,
        a_user: pendiente.a_user,
        importe: importe.importe,
        fecha,
        nota: nota.trim() || null,
      });
      navegar('/comun');
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
      setGuardando(false);
    }
  }

  return (
    <section>
      {volver}
      <h1>Saldar · {espacio?.nombre}</h1>
      <p data-testid="sentido-pago">
        {pagoYo ? `Le pagas a ${otro.email}` : `${otro.email} te paga`}. Pendiente: <strong>{formatearEUR(pendiente.importe)}</strong>.
      </p>
      <p class="nota">Solo se apunta el pago; la app no mueve dinero.</p>
      <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <label class="campo campo--importe">
          <span>Importe (€)</span>
          <input type="text" inputMode="decimal" autoComplete="off" value={importeTexto} onInput={(e) => setImporteTexto(e.currentTarget.value)} />
        </label>
        <div class="fila-campos fila-campos--iguales">
          <label class="campo">
            <span>Fecha</span>
            <input type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
          </label>
          <label class="campo">
            <span>Nota (opcional)</span>
            <input type="text" maxLength={120} value={nota} onInput={(e) => setNota(e.currentTarget.value)} placeholder="Bizum, efectivo…" />
          </label>
        </div>
        <ListaErrores errores={errores} />
        <button class="boton boton--principal" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Registrar pago'}
        </button>
      </form>
    </section>
  );
}
