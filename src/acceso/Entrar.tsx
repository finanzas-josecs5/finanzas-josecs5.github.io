import { useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';
import { navegar, RUTA_INICIO } from '../ui/router';
import { mensajeErrorAuth } from './contrasena';

export function Entrar({ motivo }: { motivo: string | null }) {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: Event) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const { error: fallo } = await supabase().auth.signInWithPassword({ email: email.trim(), password: contrasena });
    setEnviando(false);
    if (fallo) {
      setError(mensajeErrorAuth(fallo.message));
      return;
    }
    navegar(RUTA_INICIO, true);
  }

  return (
    <main class="acceso">
      <form class="tarjeta acceso__formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <h1>Finanzas</h1>
        {motivo === 'inactividad' && (
          <p class="aviso" role="status">
            Se ha cerrado la sesión tras 30 minutos sin uso.
          </p>
        )}
        <label class="campo">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>
        <label class="campo">
          <span>Contraseña</span>
          <input
            type="password"
            name="contrasena"
            autoComplete="current-password"
            required
            value={contrasena}
            onInput={(e) => setContrasena(e.currentTarget.value)}
          />
        </label>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="boton boton--principal" type="submit" disabled={enviando || !email || !contrasena}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p class="nota">¿Has olvidado la contraseña? Pide al administrador que la restablezca.</p>
      </form>
    </main>
  );
}
