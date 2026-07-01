/*
 * fetch-sub100k-public.js — igual ao fetch-sub100k.js, mas usa o endpoint
 * PÚBLICO recursivo do ordinals.com (https://ordinals.com/r/inscription/<id>),
 * que devolve o campo "number" (inscription number) SEM precisar de API key.
 *
 * COMO RODAR (Node 18+):
 *     node fetch-sub100k-public.js
 *
 * SAÍDA: sub100k.json — array com os inscription ids sub-100k.
 */

const fs = require("fs");

const THRESHOLD = 100000;
const FILE = "inscriptionlist.txt";
const BASE = "https://ordinals.com/r/inscription/";

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
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(BASE + id, { headers: { Accept: "application/json" } });
      calls++;
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status} no índice ${i} (${id})`);
      const json = await res.json();
      const n = json.number;
      if (typeof n !== "number") throw new Error(`resposta sem "number" no índice ${i}`);
      cache.set(i, n);
      return n;
    } catch (e) {
      if (attempt === 7) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`Falhou demais no índice ${i}.`);
}

(async () => {
  // 1) amostra pra ver se está ordenado por inscription number
  const probes = [0, (N * 0.25) | 0, (N * 0.5) | 0, (N * 0.75) | 0, N - 1];
  const seen = [];
  for (const i of probes) { seen.push([i, await numberAt(i)]); await sleep(200); }

  console.log("Amostra (badger # → inscription #):");
  seen.forEach(([i, n]) => console.log(`  badger #${i + 1}  →  inscription #${n}`));
  console.log("");

  const ascending = seen.every((v, k) => k === 0 || v[1] >= seen[k - 1][1]);

  if (ascending) {
    console.log("✅ Lista ordenada por inscription number → busca binária.\n");
    let lo = 0, hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const n = await numberAt(mid);
      await sleep(200);
      if (n < THRESHOLD) lo = mid + 1; else hi = mid;
    }
    const cutoff = lo;
    const sub = ids.slice(0, cutoff);
    fs.writeFileSync("sub100k.json", JSON.stringify(sub));
    console.log(`🦡 ${cutoff} badgers são sub-100k (de ${N}).`);
    console.log(`   Chamadas usadas: ${calls}`);
    console.log(`   Escrevi sub100k.json.`);
  } else {
    console.log("⚠  Lista NÃO ordenada por inscription number. Rodando modo COMPLETO…\n");
    const sub = [];
    for (let i = 0; i < N; i++) {
      const n = await numberAt(i);
      if (n < THRESHOLD) sub.push(ids[i]);
      if (i % 100 === 0) console.log(`  ${i}/${N}  (sub-100k até agora: ${sub.length})`);
      await sleep(150);
    }
    fs.writeFileSync("sub100k.json", JSON.stringify(sub));
    console.log(`\n🦡 ${sub.length} badgers são sub-100k. Escrevi sub100k.json.`);
  }
})().catch(e => { console.error("\nErro:", e.message); process.exit(1); });
