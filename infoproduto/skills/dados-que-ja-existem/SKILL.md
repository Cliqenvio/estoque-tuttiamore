---
name: dados-que-ja-existem
description: "Traz para dentro do app os dados que já existem em planilhas, CSV, ERP ou e-commerce, com normalização, validação, deduplicação e relatório de importação — sem perder linha e sem inventar dado. Use quando surgir 'tenho tudo numa planilha', 'preciso puxar do ERP/Bling/Tiny/Loja Integrada', 'a planilha tem 4 mil linhas', 'tem produto duplicado', ou quando uma importação silenciosamente comeu registros."
---

# Dados que já existem

## Por que esta skill existe

Nenhum app interno nasce em terreno limpo. O dado já existe — numa planilha que passou por
seis pessoas, num ERP com campo usado para outra coisa, num CSV exportado com acento
quebrado. E ele é sujo de um jeito específico e teimoso:

- A mesma unidade escrita como `UN`, `Un`, `un`, `unid`, `unidade`
- Preço como `1.234,56`, `1234.56`, `R$ 1.234,56` e `1234,56 ` (com espaço no fim)
- Código de barras que virou `7,89123E+12` porque alguém abriu no Excel
- Linhas em branco no meio, cabeçalho repetido na linha 500, um total no rodapé
- Duas linhas do "mesmo" produto: `Caixa 20L` e `CAIXA 20 L`

A pior importação não é a que falha — é a que "funciona" e cria 4.000 registros errados.

## A regra: importar é um processo com relatório, não um botão

Toda importação passa por cinco fases, sempre nessa ordem, e a fase 4 nunca é pulada.

### 1. Radiografia (antes de escrever qualquer código)

Nunca importe um arquivo que você não olhou. Comece por:

```bash
head -5 planilha.csv            # como é o cabeçalho de verdade
wc -l planilha.csv              # quantas linhas
file planilha.csv               # codificação (UTF-8? latin-1?)
```

Peça ao assistente uma radiografia antes da importação:

> Leia `planilha.xlsx` e me diga, sem alterar nada: quantas linhas; quais colunas; para cada
> coluna, o tipo predominante, quantos vazios e 3 exemplos reais; quais colunas têm valor
> duplicado; e quais linhas parecem lixo (em branco, cabeçalho repetido, total).

Essa saída sozinha já costuma revelar duas ou três surpresas.

### 2. Mapa de-para

Escreva um mapa explícito de coluna da planilha → campo do `MODELO.md`. O que não estiver
no mapa **não entra**. Guarde em `IMPORTACAO.md`:

```markdown
| Coluna na planilha | Campo no modelo | Transformação |
|---|---|---|
| `Cód.` | `sku` | trim, maiúsculas |
| `Descrição do Produto` | `nome` | trim, colapsar espaços |
| `EAN` | `ean` | texto; recompor zeros à esquerda até 13 dígitos; descartar notação científica |
| `Preço Venda` | `preco_centavos` | remover `R$`, trocar `.`→``, `,`→`.`, ×100, inteiro |
| `Un` | `unidade` | normalizar: un/unid/unidade → `UN` |
| `Estoque` | — | **ignorado**: saldo vem dos movimentos |
```

### 3. Normalização

As transformações que resolvem 90% dos casos brasileiros:

```js
const texto  = v => String(v ?? "").trim().replace(/\s+/g, " ");
const reais  = v => {
  let s = String(v ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;                              // vazio → quarentena, nunca zero
  const pv = s.lastIndexOf(","), pp = s.lastIndexOf(".");
  if (pv > pp) s = s.replace(/\./g, "").replace(",", ".");   // 1.234,56 → 1234.56
  else {
    s = s.replace(/,/g, "");                                  // 1,234.56 → 1234.56
    if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");  // 1.234 é milhar
  }
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) ? n : null;             // ilegível → quarentena
};
const ean    = v => {
  if (typeof v === "number" && !Number.isInteger(v)) return null;  // planilha corrompeu
  let s = String(v ?? "").trim();
  if (/e\+/i.test(s)) return null;               // notação científica: dado perdido, não chute
  s = s.replace(/\D/g, "");
  if (!s) return null;
  s = s.padStart(13, "0");
  // o EAN-13 carrega o próprio detector de erro: o 13º dígito é conferido pelos outros 12
  const soma = [...s].slice(0, 12).reduce((t, d, i) => t + d * (i % 2 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === +s[12] ? s : null;            // não bate → quarentena
};
const chave  = v => texto(v).toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");   // para comparar duplicata
```

Sobre o EAN em notação científica: **não tente reconstruir**. `7,89123E+12` perdeu dígitos
de verdade. Marque como pendente e peça a exportação de novo com a coluna em formato texto.
Inventar um dígito verificador é criar um erro que ninguém vai achar depois.

A dupla armadilha do preço: `1.234,56` e `1234.56` são o mesmo valor em formatos
diferentes, e a conversão ingênua (apagar todos os pontos) transforma `1234.56` em
123.456 reais — um erro de cem vezes que entra calado. Por isso a função acima detecta o
formato antes de converter e devolve `null` (quarentena) para o que não entende.

### 4. Validação e quarentena — a fase que ninguém pula

Nada entra direto. Toda linha vai para um de três destinos:

- **aceita** — passou em todas as regras
- **quarentena** — problema que precisa de decisão humana (duplicata, campo obrigatório vazio)
- **rejeitada** — impossível de aproveitar

Gere sempre `relatorio-importacao.csv` com uma linha por registro problemático, contendo
**o número da linha original**, o valor cru e o motivo. Sem isso, corrigir é impossível.

```
linha,sku,motivo,valor_original
147,TUT-CX-001,sku duplicado (ver linha 88),TUT-CX-001
203,,sku vazio,
418,TUT-PL-77,ean em notacao cientifica,7891234E+12
```

### 5. Carga com resumo e reversão

Antes de gravar, imprima o resumo e **peça confirmação**:

```
4.182 linhas lidas
3.940 aceitas
  198 em quarentena (147 duplicatas, 51 sem EAN)
   44 rejeitadas
Confirma a carga das 3.940? [s/N]
```

E grave de forma reversível: marque todos os registros com um `lote_id`. Se der errado,
apagar o lote é um comando, não uma noite.

## Duplicatas: decida a regra antes

Duplicata é decisão de negócio, não técnica. Escolha e escreva no `IMPORTACAO.md`:

- **Mesma chave natural (SKU/EAN)** → mantém a primeira, joga as outras na quarentena
- **Nome parecido** → nunca funda automaticamente; leve para quarentena com as duas linhas
  lado a lado

Ninguém fica bravo com duplicata na quarentena. Todo mundo fica bravo quando dois produtos
diferentes viraram um só.

## Quando o dado vem de API (ERP, e-commerce)

- **Pagine** — quase toda API devolve no máximo 50–100 por página; importar sem paginar
  traz a primeira página e parece completo
- **Respeite o limite de chamadas** — meio segundo entre requisições evita bloqueio
- **Salve a resposta crua** antes de transformar; quando algo estranho aparecer, você
  compara com a origem sem precisar chamar de novo
- **Prefira sincronização incremental** — filtre por data de modificação
  (`data_modificacao__gt`) em vez de baixar o catálogo inteiro toda vez
- **Nunca chame a API do ERP direto do navegador** — veja `quem-entra-e-quem-ve`

## Combine com

Para ler, limpar e reexportar planilhas, use a skill pública **`xlsx`** — ela cuida de
`.xlsx`, `.csv` e `.tsv`, inclusive dos arquivos com cabeçalho fora do lugar.

## Armadilhas

- **Importar direto no banco de produção na primeira tentativa.** Rode primeiro com
  `--dry-run`, olhe o relatório, depois carregue.
- **Confiar no total.** "Importou 4.000 de 4.182" quase sempre significa 182 sumindo
  calado. Some aceitas + quarentena + rejeitadas e exija bater com o total lido.
- **Corrigir a planilha na mão e reimportar.** Corrija a **regra** de importação. A
  planilha vai ser exportada de novo mês que vem com os mesmos defeitos.
- **Perder o arquivo original.** Guarde uma cópia intocada de tudo que importou.

## Checklist de saída

- [ ] `IMPORTACAO.md` com o mapa de-para e a regra de duplicata
- [ ] Aceitas + quarentena + rejeitadas = total de linhas lidas
- [ ] `relatorio-importacao.csv` gerado e revisado por quem conhece o dado
- [ ] Uma amostra de 10 registros foi conferida um a um contra a origem
- [ ] Dá para desfazer o lote com um comando
