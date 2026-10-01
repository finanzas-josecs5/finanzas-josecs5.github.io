import { render } from 'preact';
import { App } from './ui/App';
import './ui/tema.css';

const raiz = document.getElementById('app');
if (raiz) render(<App />, raiz);
