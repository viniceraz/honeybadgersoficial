/*
 * fetch-sub100k.js  —  descobre quais Honey Badgers são "sub-100k"
 * (inscription_number < 100000), os raros OG.
 *
 * COMO RODAR (precisa Node 18+):
 *   1. Deixa o inscriptionlist.txt na mesma pasta (um inscription id por linha).
 *   2. No terminal:
 *        ORDISCAN_KEY=sua_key_aqui  node fetch-sub100k.js
 *
 * O QUE FAZ:
 *   Primeiro checa se tua lista está ordenada por inscription number.
 *   - Se estiver (provável, se veio de um indexer): acha o corte dos 100k com
 *     BUSCA BINÁRIA usando ~20 chamadas. Cabe no free tier (1.000/mês).
 *   - Se NÃO estiver: avisa. Pra rodar mesmo assim buscando TODOS (9999 chamadas,
 *     precisa plano pago ou cota suficiente), roda com FULL=1.
 *
 * SAÍDA:
 *   sub100k.json  → array com os inscription ids que são sub-100k.
 *   Manda esse arquivo de volta que eu ligo no site.
 */

const fs = require("fs");

const KEY = process.env.ORDISCAN_KEY;
const THRESHOLD = 100000;
const FILE = "inscriptionlist.txt";

if (!KEY) {
  console.error("❌ Faltou a key. Rode assim:  ORDISCAN_KEY=xxxx node fetch-sub100k.js");
  process.exit(1);
}
if (!fs.existsSync(FILE)) {
  console.error(`❌ Não achei ${FILE} nesta pasta.`);
  process.exit(1);
}

const ids = fs.readFileSync(FILE, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const N = ids.length;
console.log(`Carregados ${N} inscription ids.\n`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const cache = new Map();
let calls = 0;

async function numberAt(i) {
  if (cache.has(i)) return cache.get(i);
  const id = ids[i];
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.ordiscan.com/v1/inscription/${id}`, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    calls++;
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} no índice ${i} (${id})`);
    const json = await res.json();
    const n = json.data.inscription_number;
    cache.set(i, n);
    return n;
  }
  throw new Error(`Rate-limit demais no índice ${i}. Espera um pouco e roda de novo.`);
}

(async () => {
  // 1) amostra pra ver se está ordenado por inscription number
  const probes = [0, (N * 0.25) | 0, (N * 0.5) | 0, (N * 0.75) | 0, N - 1];
  const seen = [];
  for (const i of probes) seen.push([i, await numberAt(i)]);

  console.log("Amostra (badger # → inscription #):");
  seen.forEach(([i, n]) => console.log(`  badger #${i + 1}  →  inscription #${n}`));
  console.log("");

  const ascending = seen.every((v, k) => k === 0 || v[1] >= seen[k - 1][1]);

  if (ascending) {
    console.log("✅ Lista ordenada por inscription number → busca binária.\n");
    // acha o primeiro índice com inscription_number >= THRESHOLD
    let lo = 0, hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const n = await numberAt(mid);
      if (n < THRESHOLD) lo = mid + 1; else hi = mid;
    }
    const cutoff = lo;
    const sub = ids.slice(0, cutoff);
    fs.writeFileSync("sub100k.json", JSON.stringify(sub));
    console.log(`🦡 ${cutoff} badgers são sub-100k (de ${N}).`);
    console.log(`   Chamadas usadas: ${calls}`);
    console.log(`   Escrevi sub100k.json  → manda esse arquivo de volta.`);
  } else {
    console.log("⚠  Tua lista NÃO está ordenada por inscription number.");
    console.log("   A busca binária não serve. Pra rotular todos precisaria buscar");
    console.log(`   os ${N} um a um (excede o free tier de 1.000/mês).`);
    console.log("   Opções: (1) re-exporta a lista em ordem de inscription number, ou");
    console.log("           (2) roda modo completo:  FULL=1 ORDISCAN_KEY=xxx node fetch-sub100k.js\n");

    if (process.env.FULL === "1") {
      console.log("Rodando modo COMPLETO (throttle ~85/min pra respeitar rate-limit)…\n");
      const sub = [];
      for (let i = 0; i < N; i++) {
        const n = await numberAt(i);
        if (n < THRESHOLD) sub.push(ids[i]);
        if (i % 100 === 0) console.log(`  ${i}/${N}  (sub-100k até agora: ${sub.length})`);
        await sleep(700);
      }
      fs.writeFileSync("sub100k.json", JSON.stringify(sub));
      console.log(`\n🦡 ${sub.length} badgers são sub-100k. Escrevi sub100k.json.`);
    }
  }
})().catch(e => { console.error("\nErro:", e.message); process.exit(1); });
