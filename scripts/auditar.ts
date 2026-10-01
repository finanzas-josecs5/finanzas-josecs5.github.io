// Ejecuta `npm audit` (SPEC S4) quitando del entorno la configuración allow-scripts
// que npm propaga a los subprocesos de `npm run`; con ella, npm 12 rechaza el comando.
import { spawnSync } from 'node:child_process';

const env = Object.fromEntries(
  Object.entries(process.env).filter(([clave]) => clave.toLowerCase() !== 'npm_config_allow_scripts'),
);
const resultado = spawnSync('npm', ['audit', '--audit-level=moderate'], { stdio: 'inherit', env, shell: true });
process.exit(resultado.status ?? 1);
