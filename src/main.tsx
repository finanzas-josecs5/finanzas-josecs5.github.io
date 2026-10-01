import { render } from 'preact';
import { comprobarMarco } from './antiframe';
import { App } from './ui/App';
import './ui/tema.css';

if (comprobarMarco()) {
  const raiz = document.getElementById('app');
  if (raiz) render(<App />, raiz);
}
