const face = n => String.fromCodePoint(0x267F + n); // ⚀ ⚁ ⚂ ⚃ ⚄ ⚅

/** Troca de faces por ~600 ms e depois cada dado para no valor já decidido. */
export function animarRolagem(caixa, resultados) {
  caixa.replaceChildren();
  const dados = resultados.map(() => {
    const d = document.createElement('div');
    d.className = 'dado rolando';
    caixa.append(d);
    return d;
  });
  const giro = setInterval(() => {
    dados.forEach(d => {
      if (d.classList.contains('rolando')) d.textContent = face(1 + Math.floor(Math.random() * 6));
    });
  }, 70);
  dados.forEach((d, i) => setTimeout(() => {
    d.classList.remove('rolando');
    d.textContent = face(resultados[i]);
    d.classList.add(resultados[i] >= 5 ? 'sucesso' : resultados[i] === 1 ? 'tropeco' : 'neutro');
  }, 600 + i * 150));
  setTimeout(() => clearInterval(giro), 600 + resultados.length * 150);
}
