import { useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';
import { ListaErrores } from '../ui/ListaErrores';
import { navegar, RUTA_INICIO } from '../ui/router';
import { mensajeErrorAuth, problemasContrasena } from './contrasena';

/** Obligatoria en el primer acceso, antes de mostrar ningún dato (SPEC CA1.3). */
export function CambiarContrasena({ obligatoria }: { obligatoria: boolean }) {
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: Event) {
    e.preventDefault();
    const problemas = problemasContrasena(nueva, repetida);
    setErrores(problemas);
    if (problemas.length > 0) return;
    setEnviando(true);
    const { error } = await supabase().auth.updateUser({
      password: nueva,
      data: { debe_cambiar_contrasena: false },
    });
    setEnviando(false);
    if (error) {
      setErrores([mensajeErrorAuth(error.message)]);
      return;
    }
    navegar(RUTA_INICIO, true);
  }

  return (
    <main class="acceso">
      <form class="tarjeta acceso__formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <h1>{obligatoria ? 'Elige tu contraseña' : 'Cambiar contraseña'}</h1>
        {obligatoria && <p>Es tu primer acceso: sustituye la contraseña temporal por una tuya.</p>}
        <p class="nota" id="requisitos">
          Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
        </p>
        <label class="campo">
          <span>Nueva contraseña</span>
          <input
            type="password"
            name="nueva"
            autoComplete="new-password"
            aria-describedby="requisitos"
            value={nueva}
            onInput={(e) => setNueva(e.currentTarget.value)}
          />
        </label>
        <label class="campo">
          <span>Repite la contraseña</span>
          <input
            type="password"
            name="repetida"
            autoComplete="new-password"
            value={repetida}
            onInput={(e) => setRepetida(e.currentTarget.value)}
          />
        </label>
        <ListaErrores errores={errores} />
        <button class="boton boton--principal" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </main>
  );
}
