import { useEffect, useState } from 'preact/hooks';
import { borrarLiquidez, guardarLiquidez, listarLiquidez, type ApunteLiquidez } from '../datos/repos/liquidez';
import { parsearImporte } from '../nucleo/dinero';
import { esFechaISO, hoy } from '../nucleo/fechas';
import { formatearEUR } from '../nucleo/formato';
import { nombreDia } from '../nucleo/textos';
import { ListaErrores } from '../ui/ListaErrores';

/** Ajustes → Liquidez: saldo total de tus cuentas, para los consejos de colchón (SPEC P2). */
export function AjustesLiquidez() {
  const [apuntes, setApuntes] = useState<ApunteLiquidez[] | null>(null);
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState<string>(hoy());
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');

  const cargar = () => listarLiquidez().then(setApuntes, (e: Error) => setErrores([e.message]));
  useEffect(() => {
    void cargar();
  }, []);

  async function enviar(e: Event) {
    e.preventDefault();
    setMensaje('');
    const i = parsearImporte(importe);
    const problemas: string[] = [];
    if (!i.ok || i.importe < 0) problemas.push('Escribe el saldo total de tus cuentas (por ejemplo 15.000).');
    if (!esFechaISO(fecha)) problemas.push('La fecha no es válida.');
    setErrores(problemas);
    if (problemas.length > 0 || !i.ok || !esFechaISO(fecha)) return;
    try {
      await guardarLiquidez(fecha, i.importe);
      setImporte('');
      setMensaje('Liquidez guardada.');
      await cargar();
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    }
  }

  return (
    <section>
      <p>
        <a href="#/ajustes">‹ Ajustes</a>
      </p>
      <h1>Liquidez</h1>
      <p class="nota">
        El dinero disponible en tus cuentas (sin contar fondos). Solo tú lo ves. Sirve para saber si tu colchón cubre tus gastos y si
        te sobra liquidez. Te lo recordaremos cada mes.
      </p>
      <form class="formulario tarjeta bloque" onSubmit={(e) => void enviar(e)} noValidate>
        <div class="fila-campos fila-campos--iguales">
          <label class="campo">
            <span>Saldo total (€)</span>
            <input type="text" inputMode="decimal" value={importe} onInput={(e) => setImporte(e.currentTarget.value)} />
          </label>
          <label class="campo">
            <span>Fecha</span>
            <input type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
          </label>
        </div>
        <ListaErrores errores={errores} />
        {mensaje && (
          <p class="aviso" role="status">
            {mensaje}
          </p>
        )}
        <button class="boton boton--principal" type="submit">
          Guardar liquidez
        </button>
      </form>

      {apuntes && apuntes.length > 0 && (
        <section class="tarjeta bloque" aria-labelledby="titulo-apuntes-liquidez">
          <h2 id="titulo-apuntes-liquidez">Apuntes</h2>
          <ul class="lista-simple">
            {apuntes.map((a) => (
              <li key={a.id}>
                <span>
                  {formatearEUR(a.importe)} <span class="nota">· {nombreDia(a.fecha)}</span>
                </span>
                <button class="boton-enlace" type="button" aria-label={`Borrar apunte de ${formatearEUR(a.importe)}`} onClick={() => void borrarLiquidez(a.id).then(cargar)}>
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
