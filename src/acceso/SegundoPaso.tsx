import { useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';
import { navegar, RUTA_INICIO } from '../ui/router';
import { limpiarCodigo } from './mfa';
import { cerrarSesion } from './sesion';

/** Segundo paso del login cuando el usuario tiene la verificación en dos pasos activada. */
export function SegundoPaso() {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: Event) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const mfa = supabase().auth.mfa;
    const { data: factores } = await mfa.listFactors();
    const factor = factores?.totp.find((f) => f.status === 'verified');
    if (!factor) {
      setEnviando(false);
      setError('No se encuentra tu método de verificación. Pide ayuda al administrador.');
      return;
    }
    const { error: fallo } = await mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
    setEnviando(false);
    if (fallo) {
      setError('Código incorrecto o caducado. Usa el código que aparece ahora en tu app.');
      setCodigo('');
      return;
    }
    navegar(RUTA_INICIO, true);
  }

  return (
    <main class="acceso">
      <form class="tarjeta acceso__formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <h1>Verificación en dos pasos</h1>
        <p>Escribe el código de 6 cifras de tu app de autenticación.</p>
        <label class="campo">
          <span>Código</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={7}
            value={codigo}
            onInput={(e) => setCodigo(limpiarCodigo(e.currentTarget.value))}
          />
        </label>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="boton boton--principal" type="submit" disabled={enviando || codigo.length !== 6}>
          {enviando ? 'Comprobando…' : 'Verificar'}
        </button>
        <p>
          <button class="boton-enlace" type="button" onClick={() => void cerrarSesion()}>
            Cancelar y cerrar sesión
          </button>
        </p>
      </form>
    </main>
  );
}
