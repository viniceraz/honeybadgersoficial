# Honey Badgers — Maker + Marketplace

Dois sites estáticos linkados, sem build, sem backend, sem API key no browser.
Prontos pra jogar na Vercel (ou qualquer static host / IPFS) arrastando a pasta.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | **Badger Maker** — monta um badger a partir das 92 traits, adiciona texto em cima/embaixo, baixa em HD (1200×1200). É a home. |
| `marketplace.html` | **SETT ROAD** — vitrine estilo darknet-market dos 9999 badgers. Não vende: cada card redireciona pro Satflow + explorer. |
| `fetch-sub100k.js` | Script Node (roda 1x na máquina) que descobre quais badgers são "sub-100k" (inscription number < 100000). |
| `inscriptionlist.txt` | Lista dos 9999 inscription IDs (um por linha). |

As duas páginas se linkam entre si (nav no topo: `maker` ↔ `marketplace`).

---

## Rodar local

Só abrir `index.html` no navegador (duplo clique). Tudo é single-file, funciona em `file://`.
Ou servir a pasta: `npx serve .`

## Deploy (Vercel)

1. Arrasta a pasta inteira em https://vercel.com/new (ou `vercel` na CLI).
2. `index.html` vira a home, `marketplace.html` fica em `/marketplace.html`.
3. Pronto. Nenhuma variável de ambiente necessária.

---

## ✅ FEITO: filtro "Sub-100k" do marketplace ativado

O filtro **Sub-100k** já está funcionando: `sub100k.json` foi gerado (981 badgers
raros, inscription number < 100000) e injetado no `marketplace.html`. A contagem foi
validada contra a API oficial do Ordiscan (corte no índice 980 = #99495 sub-100k;
índice 981 = #107429 já fora).

> Gerado sem gastar cota do Ordiscan: use `node fetch-sub100k-public.js`, que lê o
> inscription number pelo endpoint público `ordinals.com/r/inscription/<id>` (sem key).
> A lista está ordenada por inscription number, então a busca binária resolve em ~16
> chamadas. Pra regenerar no futuro, rode esse script de novo.

O passo a passo original (via Ordiscan, precisa de key paga) fica abaixo caso precise:

### 1. Gerar a lista sub-100k

Precisa de Node 18+ e uma API key do Ordiscan (https://ordiscan.com → conta → API key).

```bash
ORDISCAN_KEY=sua_key_aqui  node fetch-sub100k.js
```

O script checa se `inscriptionlist.txt` está ordenado por inscription number:
- **Se estiver** (provável): acha o corte dos 100k com busca binária (~20 chamadas → cabe no free tier de 1.000/mês). Gera `sub100k.json`.
- **Se não estiver**: avisa. Pra rodar mesmo assim (9999 chamadas, precisa plano pago), use `FULL=1 ORDISCAN_KEY=xxx node fetch-sub100k.js`.

Saída: `sub100k.json` = array de inscription IDs que são sub-100k.

### 2. Injetar no marketplace.html

No `marketplace.html`, procure esta linha (perto do fim, num `<script>`):

```js
window.SUB100K = /*__SUB100K__*/[]/*__ENDSUB__*/;
```

Substitua o `[]` pelo conteúdo do `sub100k.json`. Fica algo assim:

```js
window.SUB100K = ["f1912230...i0","5f3e9d3c...i0", ...];
```

Salve. Recarregue o marketplace: o filtro "Sub-100k" passa a mostrar só os raros,
com a contagem certa na sidebar. (Não precisa mexer em mais nada — a lógica já
filtra por `SUB100K`.)

> Dica: se a key do Ordiscan já foi usada/compartilhada, gere uma nova depois.

---

## Config rápida (constantes no topo do `<script type="text/babel">` do marketplace.html)

```js
const GATEWAY  = "https://ordinals.com/content/";      // fonte das imagens dos badgers
const SATFLOW  = "https://www.satflow.com/ordinal/";   // redirect principal do card
const EXPLORER = "https://ordinals.com/inscription/";  // redirect secundário (◎)
```

- **Imagens lentas / rate-limit?** `ordinals.com` pode limitar com 10k imagens.
  Troque `GATEWAY` por outro gateway/CDN, ou pré-renderize os 9999 PNGs a partir
  das traits e sirva de um CDN seu (ver "Ideias" abaixo).

---

## Ideias de próximos passos (opcional)

- **Hospedar as imagens** você mesmo: pré-renderizar os 9999 badgers a partir das
  traits + a lista, subir num CDN, e apontar `GATEWAY` pra lá. Elimina dependência
  do gateway público e fica instantâneo.
- **Preço live** no marketplace (floor / quais estão listados): precisa de uma
  função serverless (ex. Vercel `/api/floor`) que guarda a key do Satflow no server
  e chama `GET /orders/floor`. Só isso precisa de backend; o resto continua estático.
- **Botão "copiar" / "tweet"** no Badger Maker depois do download.

---

## Notas técnicas

- Badger Maker: React (UMD + Babel standalone) num arquivo só; as 92 traits estão
  embutidas em base64 (não parseadas pelo Babel — ficam num `<script>` global).
- Marketplace: mesma abordagem. Os 9999 IDs estão guardados compactos
  (só o txid de 64 hex, `i0` é adicionado no runtime) num `window.BADGER_BLOB`.
  Grid com scroll infinito (IntersectionObserver) pra não travar com 10k imagens.
- Ordem de camadas do maker: `background → mane → body → eyes → claws → headgear → artifact`.
