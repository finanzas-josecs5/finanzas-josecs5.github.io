import type { Factor } from '@supabase/supabase-js';
import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';
import { limpiarCodigo, qrComoBlob } from './mfa';

interface Alta {
  factorId: string;
  qrUrl: string;
  secreto: string;
}

/** Ajustes → Seguridad: contraseña y verificación en dos pasos opcional (SPEC F1, S9). */
export function Seguridad() {
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [alta, setAlta] = useState<Alta | null>(null);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function cargar() {
    const { data } = await supabase().auth.mfa.listFactors();
    setFactores(data?.totp ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  // Libera la imagen del QR al terminar
  useEffect(() => () => alta && URL.revokeObjectURL(alta.qrUrl), [alta]);

  async function empezarAlta() {
    setError('');
    setMensaje('');
    const mfa = supabase().auth.mfa;
    // Si quedó un alta a medias, se elimina antes de empezar otra
    for (const f of factores ?? []) if (f.status !== 'verified') await mfa.unenroll({ factorId: f.id });
    const { data, error: fallo } = await mfa.enroll({ factorType: 'totp', friendlyName: 'App de autenticación' });
    if (fallo) {
      setError('No se ha podido iniciar la activación. Inténtalo de nuevo.');
      return;
    }
    setAlta({ factorId: data.id, qrUrl: URL.createObjectURL(qrComoBlob(data.totp.qr_code)), secreto: data.totp.secret });
  }

  async function confirmarAlta(e: Event) {
    e.preventDefault();
    if (!alta) return;
    const { error: fallo } = await supabase().auth.mfa.challengeAndVerify({ factorId: alta.factorId, code: codigo });
    if (fallo) {
      setError('El código no es correcto. Comprueba la hora del móvil y usa el código actual.');
      return;
    }
    setAlta(null);
    setCodigo('');
    setMensaje('Verificación en dos pasos activada. A partir de ahora te pediremos el código al entrar.');
    await cargar();
  }

  async function desactivar(factor: Factor) {
    setError('');
    const { error: fallo } = await supabase().auth.mfa.unenroll({ factorId: factor.id });
    if (fallo) {
      setError('No se ha podido desactivar. Vuelve a entrar con tu código e inténtalo de nuevo.');
      return;
    }
    await supabase().auth.refreshSession();
    setMensaje('Verificación en dos pasos desactivada.');
    await cargar();
  }

  const verificado = factores?.find((f) => f.status === 'verified');

  return (
    <section>
      <h1>Seguridad</h1>

      <div class="tarjeta bloque">
        <h2>Contraseña</h2>
        <p>
          <a href="#/cambiar-contrasena">Cambiar contraseña</a>
        </p>
      </div>

      <div class="tarjeta bloque">
        <h2>Verificación en dos pasos</h2>
        {mensaje && (
          <p class="aviso" role="status">
            {mensaje}
          </p>
        )}
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        {factores === null && <p class="nota">Cargando…</p>}

        {verificado && !alta && (
          <>
            <p>
              <strong>Activada.</strong> Al entrar te pediremos el código de tu app de autenticación.
            </p>
            <button class="boton" type="button" onClick={() => void desactivar(verificado)}>
              Desactivar
            </button>
          </>
        )}

        {factores !== null && !verificado && !alta && (
          <>
            <p>Opcional. Además de la contraseña, al entrar te pediremos un código de una app como Google Authenticator, Microsoft Authenticator o 1Password.</p>
            <button class="boton" type="button" onClick={() => void empezarAlta()}>
              Activar
            </button>
          </>
        )}

        {alta && (
          <form onSubmit={(e) => void confirmarAlta(e)} noValidate>
            <ol>
              <li>Escanea este código QR con tu app de autenticación.</li>
              <li>Escribe el código de 6 cifras que te muestre.</li>
            </ol>
            <img class="qr" src={alta.qrUrl} alt="Código QR para la app de autenticación" width={200} height={200} />
            <p class="nota">
              ¿No puedes escanearlo? Introduce esta clave a mano: <code data-testid="secreto-totp">{alta.secreto}</code>
            </p>
            <label class="campo">
              <span>Código de 6 cifras</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigo}
                onInput={(e) => setCodigo(limpiarCodigo(e.currentTarget.value))}
              />
            </label>
            <button class="boton boton--principal" type="submit" disabled={codigo.length !== 6}>
              Confirmar y activar
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
