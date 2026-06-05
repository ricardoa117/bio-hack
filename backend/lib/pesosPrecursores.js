export const PESOS = {
  basura_organica: 10,
  fuga_agua: 8,
  terreno_baldio: 6,
  basura_inorganica: 4,
  barranca_sucia: 7,
};

export function getPeso(tipo) {
  return PESOS[tipo] || 5;
}
