/*
 * build-tardgers.js — gera o manifesto da coleção V2 "Tardgers" e injeta em index.html
 * como window.TARDGERS, no MESMO formato de window.TRAITS.
 *
 * COMO RODAR (Node 18+):
 *     node build-tardgers.js [caminho_da_pasta_tardgers]
 *
 *   Sem argumento, usa SRC_DEFAULT abaixo. As traits NÃO são copiadas pro repo —
 *   viram base64 embutido no index.html (igual as traits da coleção original).
 *
 * O QUE FAZ:
 *   - Lê as 7 subpastas, normaliza os nomes pras 7 camadas canônicas.
 *   - Cada PNG vira { id, label, src(dataURL base64) }.
 *   - id  = snake_case (minúsculo, não-alfanumérico -> "_")
 *   - label = Title Case a partir do nome do arquivo
 *   - Injeta/atualiza <script> window.TARDGERS entre marcadores, antes do babel.
 */

const fs = require("fs");
const path = require("path");

// pasta de origem (fora do repo). Troque aqui ou passe como argumento.
const SRC_DEFAULT = "C:\\Users\\kusht\\Downloads\\Tardgers";
const SRC = process.argv[2] || SRC_DEFAULT;
const HTML = path.join(__dirname, "index.html");

// nome-da-subpasta -> camada canônica (case-insensitive)
const FOLDER_TO_LAYER = {
  bg: "background",
  manes: "mane",
  body: "body",
  eyes: "eyes",
  claws: "claws",
  head: "headgear",
  artifacts: "artifact",
};
// ordem de composição (== window.TRAITS / LAYERS do maker)
const ORDER = ["background", "mane", "body", "eyes", "claws", "headgear", "artifact"];

function baseName(f) { return f.replace(/\.png$/i, ""); }
function toId(f) {
  return baseName(f).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function toLabel(f) {
  return baseName(f).trim().split(/[\s_]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

if (!fs.existsSync(SRC)) {
  console.error(`❌ Não achei a pasta de traits: ${SRC}`);
  process.exit(1);
}

// mapeia subpastas reais -> camada
const subdirs = fs.readdirSync(SRC, { withFileTypes: true }).filter(d => d.isDirectory());
const byLayer = {};
for (const d of subdirs) {
  const layer = FOLDER_TO_LAYER[d.name.toLowerCase()];
  if (!layer) { console.warn(`⚠  ignorando subpasta desconhecida: ${d.name}`); continue; }
  byLayer[layer] = d.name;
}

const missing = ORDER.filter(l => !byLayer[l]);
if (missing.length) {
  console.error(`❌ Faltam camadas: ${missing.join(", ")} (subpastas encontradas: ${subdirs.map(d => d.name).join(", ")})`);
  process.exit(1);
}

const manifest = {};
let total = 0;
const perLayer = [];
for (const layer of ORDER) {
  const dir = path.join(SRC, byLayer[layer]);
  const files = fs.readdirSync(dir).filter(f => /\.png$/i.test(f))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const seen = new Set();
  manifest[layer] = files.map(f => {
    let id = toId(f);
    if (seen.has(id)) { let n = 2; while (seen.has(id + "_" + n)) n++; id = id + "_" + n; }
    seen.add(id);
    const b64 = fs.readFileSync(path.join(dir, f)).toString("base64");
    return { id, label: toLabel(f), src: "data:image/png;base64," + b64 };
  });
  total += manifest[layer].length;
  perLayer.push(`${byLayer[layer]} -> ${layer}: ${manifest[layer].length}`);
}

// serializa e injeta
const json = JSON.stringify(manifest);
const block =
  '<script>\n' +
  '/* TARDGERS (V2) manifest — injected by build-tardgers.js; Babel never parses it */\n' +
  '/*__TARDGERS_START__*/window.TARDGERS = ' + json + ';/*__TARDGERS_END__*/\n' +
  '</script>';

let html = fs.readFileSync(HTML, "utf8");
const reBlock = /<script>\s*\/\* TARDGERS \(V2\)[\s\S]*?\/\*__TARDGERS_END__\*\/\s*<\/script>/;

if (reBlock.test(html)) {
  html = html.replace(reBlock, block);
  console.log("↻ Bloco window.TARDGERS existente atualizado.");
} else {
  // insere logo após o </script> do window.TRAITS
  const anchor = /(window\.TRAITS\s*=[\s\S]*?<\/script>)/;
  if (!anchor.test(html)) { console.error("❌ Não achei o <script> do window.TRAITS pra ancorar."); process.exit(1); }
  html = html.replace(anchor, "$1\n\n" + block);
  console.log("＋ Bloco window.TARDGERS inserido após window.TRAITS.");
}

fs.writeFileSync(HTML, html);

console.log("\n🐸 Tardgers gerados:");
perLayer.forEach(l => console.log("   " + l));
console.log(`   TOTAL: ${total} traits`);
console.log(`\nindex.html agora: ${(fs.statSync(HTML).size / 1048576).toFixed(2)} MB`);
