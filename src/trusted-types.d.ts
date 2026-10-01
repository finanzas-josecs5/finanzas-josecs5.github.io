// Tipos mínimos de la API Trusted Types (aún no incluida en lib.dom de TypeScript).
interface PoliticaTrustedTypes {
  createScriptURL(url: string): unknown;
}

interface FabricaTrustedTypes {
  createPolicy(
    nombre: string,
    reglas: { createScriptURL?: (url: string) => string | null },
  ): PoliticaTrustedTypes;
}

interface Window {
  trustedTypes: FabricaTrustedTypes;
}
