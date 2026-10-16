// Regras do rolador (puras, sem DOM nem rede). Mudou a regra no manual? Mude aqui.
export const SUCCESS_MIN = 5; // 5 ou 6 é sucesso
export const STUMBLE = 1; // 1 é Tropeço

/** Sorteia `qtd` d6 com crypto (ou um rng injetado, para testes). */
export function rollDice(qtd, rng = defaultRng) {
  return Array.from(rng(qtd), v => (v % 6) + 1);
}

function defaultRng(qtd) {
  const buf = new Uint32Array(qtd);
  crypto.getRandomValues(buf);
  return buf;
}

/** PR gasto vira sucesso automático; cada 1 é um Tropeço. */
export function tally(dice, pr = 0) {
  return {
    successes: dice.filter(d => d >= SUCCESS_MIN).length + pr,
    stumbles: dice.filter(d => d === STUMBLE).length,
  };
}

/** Sem dificuldade escolhida não há veredito. */
export function verdict(successes, difficulty) {
  if (!difficulty) return null;
  return successes >= difficulty ? 'Sucesso' : 'Falha';
}
