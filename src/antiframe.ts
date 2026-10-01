// SPEC S15: GitHub Pages no permite la cabecera frame-ancestors, así que la app
// solo se muestra si no está dentro de un marco (protección contra clickjacking).
// El CSS oculta <html> hasta que esta comprobación añade la clase.
export function comprobarMarco(): boolean {
  const fuera = window.top === window.self;
  if (fuera) document.documentElement.classList.add('sin-marco');
  return fuera;
}
