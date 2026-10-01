import { elegirEspacio, useEspacios } from './estado';

/** Selector Yo · Pareja · Piso (SPEC §5). Los espacios compartidos llegan en T13. */
export function SelectorEspacio() {
  const { espacios, actual } = useEspacios();

  if (espacios.length === 0) return <span class="cabecera__espacio" />;

  return (
    <label class="cabecera__espacio">
      <span class="solo-lectores">Espacio</span>
      <select value={actual?.id ?? ''} onChange={(e) => elegirEspacio(e.currentTarget.value)}>
        {espacios.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
