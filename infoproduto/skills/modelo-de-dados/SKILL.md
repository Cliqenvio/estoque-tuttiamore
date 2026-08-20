---
name: modelo-de-dados
description: "Transforma o processo descrito no escopo em um modelo de dados enxuto: entidades, campos, tipos, relações, regras que nunca podem ser violadas e dados de exemplo. Use antes de criar telas, ou quando aparecerem sintomas de modelo errado — campo 'observações' que virou depósito de tudo, produto duplicado, número que não fecha, planilha com colunas repetidas, 'não sei onde guardar isso'. Produz MODELO.md e um arquivo de dados de exemplo."
---

# Modelo de dados

## Por que esta skill existe

Tela errada se conserta em uma tarde. Modelo de dados errado se conserta migrando tudo,
com o app no ar, com gente usando. É a única decisão deste material que é cara de desfazer.

Quase todo app interno quebrado tem o mesmo defeito de origem: modelaram a **tela** em vez
de modelar o **fato**. Guardaram "linha da planilha" em vez de guardar "o que aconteceu".

## O princípio: guarde eventos, calcule saldos

Errado (e comum):

```
produto: { sku, nome, quantidade_em_estoque }
```

O campo `quantidade_em_estoque` responde *quanto tem agora* e **destrói todo o resto**.
Quando o número estiver errado — e vai estar — ninguém consegue descobrir por quê.
Não dá para responder "quem tirou", "quando", "de qual nota", "quanto entrou ontem".

Certo:

```
produto:     { sku, nome, ean, ativo }
movimento:   { id, sku, tipo: entrada|saida|ajuste, quantidade, quando, quem, origem, observacao }
```

O saldo passa a ser uma conta: `soma(entradas) - soma(saidas) ± ajustes`. Você ganha
histórico, auditoria e conserto de erro sem perder nada. Se a conta ficar lenta um dia
(acima de ~100 mil movimentos), você adiciona uma tabela de saldo *calculada a partir dos
eventos* — mas nunca substitui os eventos por ela.

Esse mesmo raciocínio vale fora do estoque: não guarde "status do pedido", guarde as
mudanças de status. Não guarde "horas do funcionário no mês", guarde as batidas.

## Como conduzir

### 1. Extraia os substantivos
Leia o caminho feliz do `ESCOPO.md` e sublinhe os substantivos. "O conferente **bipa** o
**código de barras** de cada **item** da **nota fiscal** e o app soma a **contagem**."
→ candidatos: item/produto, nota fiscal, contagem/movimento.

### 2. Separe coisa de acontecimento
Para cada candidato pergunte: **isso existe por si só, ou é algo que aconteceu com alguma coisa?**
- Existe por si só → **entidade** (produto, pessoa, fornecedor, local)
- Aconteceu → **evento** (movimento, conferência, ajuste, acesso)

### 3. Encontre a chave natural
Para cada entidade: **o que a identifica no mundo real?** SKU, EAN, CPF, número da nota.
Se não existir chave natural, gere um id — mas procure antes: chave natural evita
duplicata na origem.

Cuidado com chaves que parecem estáveis e não são: nome de pessoa muda, e-mail muda,
"código interno" tem espaço e acento em metade das linhas.

### 4. Defina os tipos com precisão
- Dinheiro: **inteiro em centavos**, nunca decimal com ponto flutuante
- Data: **ISO 8601 com fuso** (`2026-08-20T14:32:00-03:00`), nunca `20/08/2026`
- Código de barras: **texto**, nunca número — zeros à esquerda somem e EAN-13 estoura
  a precisão de inteiro em JavaScript
- Quantidade: inteiro se não existe meia unidade; decimal se vende a granel
- Booleano: `ativo: true/false`, não `status: "S"/"N"`

### 5. Escreva as invariantes
As regras que **nunca** podem ser violadas, em uma frase cada:

- "Não existem dois produtos com o mesmo SKU."
- "Movimento sempre aponta para um produto que existe."
- "Quantidade de movimento nunca é zero."
- "Saída não pode deixar o saldo negativo — a não ser que seja um ajuste explícito."

Cada invariante vira, mais tarde, uma checagem no código e um teste na skill `nao-quebra`.
Escrevê-las agora é o que impede que virem bug depois.

### 6. Gere dados de exemplo de verdade
Crie de 10 a 20 registros que **pareçam os reais**, com a sujeira real: nome com acento,
descrição de 90 caracteres, SKU com hífen, um produto inativo, uma quantidade zerada, um
campo opcional vazio. Dados de exemplo limpos demais escondem exatamente os bugs que vão
aparecer na segunda-feira.

## O que produzir

`MODELO.md`:

```markdown
# Modelo de dados

## Entidades

### produto
| campo | tipo | obrigatório | exemplo | observação |
|---|---|---|---|---|
| sku | texto | sim | `TUT-CX-001` | chave natural |
| nome | texto | sim | `Caixa organizadora 20L` | |
| ean | texto | não | `7891234567895` | texto, preserva zero à esquerda |
| ativo | booleano | sim | `true` | inativo não aparece na busca |

### movimento
| campo | tipo | obrigatório | exemplo | observação |
|---|---|---|---|---|
| id | texto | sim | `mov_01H...` | gerado |
| sku | texto | sim | `TUT-CX-001` | referencia produto.sku |
| tipo | enum | sim | `entrada` | entrada, saida, ajuste |
| quantidade | inteiro | sim | `12` | nunca zero |
| quando | data ISO | sim | `2026-08-20T14:32:00-03:00` | |
| quem | texto | sim | `expedicao@empresa.com` | |

## Relações
- um produto tem muitos movimentos
- um movimento pertence a exatamente um produto

## Invariantes
1. <regra>
2. <regra>

## Cálculos derivados
- **saldo(sku)** = soma(entradas) − soma(saídas) + soma(ajustes)

## O que NÃO está no modelo (e por quê)
- <campo que alguém pediu e não entra agora>
```

E `dados-exemplo.json` (ou `.csv`) com os 10–20 registros sujos.

## Armadilhas

- **Campo "observações" como lixeira.** Se três informações diferentes vão parar nele,
  são três campos.
- **Guardar o que dá para calcular.** Idade (calcule da data de nascimento), total do
  pedido (some os itens), saldo (some os movimentos).
- **Apagar de verdade.** Em app de empresa, `ativo: false` quase sempre é melhor que
  `DELETE`. Dado apagado por engano numa sexta-feira não volta.
- **Traduzir metade.** Escolha um idioma para os nomes de campo e mantenha. `product.nome`
  e `movimento.date` no mesmo projeto custa uma hora de confusão por semana.
- **Modelar para o relatório que ainda não existe.** Modele o fato. Relatório é consulta.

## Ao terminar

Pegue três situações reais que já aconteceram na empresa — inclusive uma que deu errado —
e escreva como cada uma ficaria registrada no modelo. Se alguma não couber, o modelo está
incompleto. Corrija agora, enquanto ainda é um arquivo de texto.
