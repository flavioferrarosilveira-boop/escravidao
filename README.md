# Rotas do Tráfico Atlântico de Africanos Escravizados

Mapa interativo das rotas do tráfico transatlântico entre 1501 e 1866 — quantidades,
regiões de origem, portos de desembarque e bandeiras dos navios — desenhado sobre uma
base cartográfica de época (projeção de Mercator, toponímia dos séculos XVI a XIX,
domínios coloniais de c. 1750 e Estados africanos do período).

**No ar:** https://flavioferrarosilveira-boop.github.io/escravidao/

O resultado é um único arquivo autocontido: **`index.html`**. Basta abri-lo no navegador.

## O que o mapa mostra

| Carta | O que traz |
|---|---|
| **Rotas do tráfico** | 72 corredores região africana → porto americano, espessura proporcional ao número de pessoas embarcadas; filtro por região de origem ou por bandeira |
| **Comércio triangular** | O circuito mercantil completo de cada uma das sete potências: ida com mercadorias, travessia do meio com pessoas, retorno com gêneros coloniais |
| **Século a século** | Os corredores dominantes de cada período, com o total de embarcados |

Camadas ligáveis: domínios coloniais, Estados africanos, ventos e correntes,
portos principais, portos secundários e graticulado. Arrastar move a carta;
`Ctrl`/`Shift` + roda dá zoom; duplo clique restaura.

## Números-chave

- **12.521.500** pessoas embarcadas na África
- **10.712.200** desembarcadas vivas nas Américas
- **1.809.300** mortas durante a travessia (≈ 14,5%)
- Maior corredor isolado: **África Centro-Ocidental → Rio de Janeiro**
- Maior traficante: **Portugal/Brasil**, 5.848.300 pessoas (46,7% do total)

## Estrutura

```
dados/
  regioes_embarque.json   8 regiões africanas: totais, portos, povos, Estados
  destinos.json           14 destinos americanos: totais, portos, potência colonial
  bandeiras.json          7 bandeiras: totais, período, portos armadores
  periodos.json           totais por século + cronologia
  circuitos.json          pernas do comércio triangular por bandeira
  matriz_sementes.json    priors historiográficos da matriz origem × destino
  matriz_rotas.csv        SAÍDA — a matriz ajustada, auditável linha a linha
  geo_atlantico.json      litoral e domínios coloniais (Natural Earth 1:50m)
build/
  extrair_geo.mjs         gera geo_atlantico.json (roda uma vez, precisa de rede)
  gerar.mjs               ajusta a matriz por IPF e monta o index.html
  modelo.html estilo.css app.js
index.html                SAÍDA — a carta, autocontida
```

## Publicação

O site é servido pelo GitHub Pages a partir do branch **`gh-pages`**
(*Settings → Pages → Deploy from a branch*). O workflow
`.github/workflows/pages.yml` reconstrói `index.html` a partir de `dados/` e
republica esse branch a cada push que toque `dados/`, `build/` ou o próprio
workflow — de modo que a carta no ar nunca fique atrás dos dados.

## Como reconstruir

```bash
node build/gerar.mjs      # sem dependências
```

Para refazer a base geográfica a partir do Natural Earth:

```bash
npm i world-atlas@2 topojson-client
MODS_DIR=$PWD/node_modules node build/extrair_geo.mjs
```

## Método e limites

Os **totais** por região africana, por destino, por bandeira e por século são os do
*Trans-Atlantic Slave Trade Database* (SlaveVoyages.org — Eltis, Richardson e equipe),
construído a partir de cerca de 36 mil viagens documentadas.

A **matriz origem × destino** não é um dado publicado: ela é reconstruída aqui a partir
de priors historiográficos (`dados/matriz_sementes.json`) ajustados por **IPF/RAS** até
que as somas das linhas reproduzam os embarcados por região e as somas das colunas
reproduzam os desembarcados por destino. Cada célula é, portanto, ordem de grandeza
fundamentada — não um dado de arquivo. O resíduo do ajuste fica abaixo de 0,03% em todas
as colunas e está impresso no apêndice do próprio mapa.

A **mortalidade** aplicada às rotas é a taxa média global (14,45%), uniforme. Na
realidade variou de menos de 10% na curta travessia Luanda–Rio a mais de 20% em viagens
longas e no período clandestino. Os mortos antes do embarque — na captura, nas marchas
e nos barracões — não entram em nenhuma destas contas.

Os **domínios coloniais** nas Américas são aproximados por geometria moderna e
correspondem grosso modo a c. 1750. A África **não** aparece repartida entre potências
europeias: isso só ocorre depois de 1885, duas décadas após o fim do tráfico.

## Bibliografia

- ELTIS, David; RICHARDSON, David. *Atlas of the Transatlantic Slave Trade*. Yale, 2010.
- *Trans-Atlantic Slave Trade Database* — SlaveVoyages.org.
- ALENCASTRO, Luiz Felipe de. *O Trato dos Viventes*. Companhia das Letras, 2000.
- KLEIN, Herbert S. *The Atlantic Slave Trade*. 2ª ed. Cambridge, 2010.
- FLORENTINO, Manolo. *Em Costas Negras*. Companhia das Letras, 1997.
- THORNTON, John. *Africa and Africans in the Making of the Atlantic World*. Cambridge, 1998.

Base geográfica: Natural Earth 1:50m (domínio público), via o pacote `world-atlas`.
