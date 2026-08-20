---
name: primeira-tela-viva
description: "Coloca no ar, em uma única sessão, a menor versão do app que já faz algo real com dado real — uma tela, um dado, funcionando no navegador do usuário. Use logo depois do modelo de dados, quando a pessoa disser 'quero ver funcionando', ou quando um projeto estiver há dias em preparação sem nada rodando. Também use quando o assistente estiver gerando muitas telas de uma vez sem nenhuma delas funcionar de ponta a ponta."
---

# Primeira tela viva

## Por que esta skill existe

Existem dois jeitos de construir. O primeiro monta as 12 telas, depois liga tudo, e no dia
da ligação descobre que o modelo não fecha — três dias de trabalho para jogar fora. O
segundo faz **uma** coisa funcionar de ponta a ponta, e só então cresce.

O segundo é mais rápido e é o único que dá para fazer sozinho.

Além disso, existe um efeito humano: a pessoa que vê o próprio dado na própria tela em uma
hora continua o projeto. A que passa três dias em preparação, não.

## A definição de "viva"

Uma tela viva atende às cinco condições, sem exceção:

1. Abre no navegador (ou no celular) do usuário real, não só na sua máquina
2. Mostra **dado de verdade** da empresa, não `Lorem ipsum` e não `Produto 1, Produto 2`
3. Aceita **uma** ação do usuário e a ação tem efeito visível
4. O efeito **sobrevive** ao fechar e reabrir a página
5. Está commitada e publicada

Se faltar qualquer uma, não está viva — está bonita.

## Escolhendo o corte certo

Volte ao caminho feliz do `ESCOPO.md` e implemente **o passo onde a dor mora**, não o
primeiro passo.

- App de estoque → não comece pelo cadastro de produtos. Comece por **bipar um código e
  ver o nome do produto aparecer**. É esse instante que prova a ideia inteira.
- App de ordem de serviço → comece por **abrir um chamado e ele aparecer na lista**.
  O cadastro de clientes pode ser um `select` chumbado por enquanto.
- App de conferência de caixa → comece por **lançar um valor e ver o total mudar**.

O cadastro é sempre a parte mais chata e menos reveladora. Faça depois.

## O roteiro da sessão

### 1. Peça o corte, não o app
Um pedido bom para o assistente é específico sobre entrada, saída e persistência:

> Crie uma página única `index.html` com um campo de texto que recebe um código de barras.
> Ao digitar/bipar, procure o código no arquivo `dados-exemplo.json` e mostre em letra
> grande o nome do produto e o saldo atual. Se não achar, mostre "não encontrado" em
> vermelho. Registre cada leitura em `localStorage` e mostre as últimas 5 leituras embaixo.
> Sem framework, sem passo de build. Português no que aparece na tela.

### 2. Rode e olhe com os próprios olhos
```bash
npx http-server . -p 8080
```
Abra `http://localhost:8080`. **Não aceite "deve funcionar".** Se você não viu, não funciona.

### 3. Teste com o dado que quebra
Bipe um código que não existe. Bipe um com zero à esquerda. Digite letra onde espera
número. Deixe vazio e aperte Enter. Cada um desses é um bug que ia aparecer na
segunda-feira com um funcionário na sua frente.

### 4. Commit
```bash
git add . && git commit -m "Primeira tela: busca por codigo de barras com saldo"
git push
```

### 5. Publique
Ative o GitHub Pages (Settings → Pages → Deploy from branch → `main`). Em dois minutos
existe uma URL. Abra **no celular**, não no computador.

### 6. Mostre para quem vai usar — hoje
Este é o passo que quase todo mundo pula, e é o mais valioso do material inteiro.
Leve a URL para o conferente, o vendedor, a pessoa do financeiro. Fique calado e olhe.

Você vai descobrir em cinco minutos coisas que não descobriria em duas semanas: que a
letra é pequena demais para ler em pé, que o campo perde o foco depois de cada leitura,
que ele precisa do preço e não do saldo, que o leitor manda um Enter que você não previu.

## O que ainda NÃO fazer

Nesta etapa, deliberadamente fora:

- Login (a tela viva pode ser pública com dado de exemplo)
- Cadastro, edição e exclusão completos
- Menu, navegação, várias páginas
- Design bonito além de "legível e com botões grandes"
- Tratamento de todos os erros possíveis

## Armadilhas

- **Aceitar a tela de demonstração.** Se o assistente gerar dados falsos na própria página,
  peça de novo lendo do arquivo real. Dado falso esconde erro de modelo.
- **Deixar para publicar depois.** "Funciona na minha máquina" não é entregável. Publicar
  na primeira sessão transforma o deploy em rotina em vez de evento.
- **Crescer antes de validar.** Se você já está na terceira tela e ninguém usou a primeira,
  pare e mostre.
- **Otimizar o que ainda não existe.** Nada de cache, paginação ou performance aqui.

## Checklist de saída

- [ ] Existe uma URL pública (ou de rede interna) que abre no celular
- [ ] A tela mostra dado real da empresa
- [ ] Uma ação funciona e o efeito sobrevive ao recarregar
- [ ] Pelo menos uma pessoa que não é você usou e comentou
- [ ] Está commitado e publicado
