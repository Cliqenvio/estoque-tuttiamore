#!/usr/bin/env python3
"""Monta o PDF do infoproduto em duas passadas:
   1) renderiza para descobrir em que pagina cada capitulo caiu
   2) escreve esses numeros no sumario e renderiza de novo
   3) junta capa + ficha + miolo + contracapa"""
import re, subprocess, sys, unicodedata
from pathlib import Path
from pypdf import PdfReader, PdfWriter

AQUI = Path(__file__).resolve().parent
DIST = AQUI.parent / "dist"
SAIDA = DIST / "do-zero-ao-app-10-skills.pdf"

# alvo do sumario -> trecho unico que so aparece na pagina de abertura daquela secao
ALVOS = [
    ("tese",  "Por que agora"),
    ("regras","Como falar com o assistente"),
    ("mapa",  "O mapa das 10 skills"),
    ("cap1",  "skill: escopo-de-uma-pagina"),
    ("cap2",  "skill: ambiente-zero"),
    ("cap3",  "skill: stack-minima"),
    ("cap4",  "skill: modelo-de-dados"),
    ("cap5",  "skill: primeira-tela-viva"),
    ("cap6",  "skill: fluxo-completo"),
    ("cap7",  "skill: quem-entra-e-quem-ve"),
    ("cap8",  "skill: dados-que-ja-existem"),
    ("cap9",  "skill: nao-quebra"),
    ("cap10", "skill: no-ar-e-vivo"),
    ("caso",  "Estudo de caso"),
    ("apA",   "Instalar as 10 skills"),
    ("apB",   "Skills publicas que combinam"),
    ("apC",   "Os 30 dias"),
    ("apD",   "Glossario sem jargao"),
]

def normalizar(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower()

def renderizar():
    r = subprocess.run(["node", str(AQUI / "gerar.js")], cwd=AQUI,
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"falha ao renderizar:\n{r.stdout}\n{r.stderr}")

def mapear_paginas(pdf):
    paginas = [normalizar(p.extract_text() or "") for p in PdfReader(pdf).pages]
    mapa = {}
    for alvo, trecho in ALVOS:
        agulha = normalizar(trecho)
        # pula as 2 folgas e o sumario, onde os mesmos titulos aparecem
        achou = next((i for i, txt in enumerate(paginas) if i > 2 and agulha in txt), None)
        if achou is None:
            print(f"  ! nao localizei '{trecho}'")
        else:
            mapa[alvo] = achou + 1   # numeracao do miolo comeca em 1
    return mapa, len(paginas)

def escrever_sumario(mapa):
    html = AQUI / "livro.html"
    t = html.read_text(encoding="utf-8")
    def troca(m):
        alvo = m.group(1)
        return f'<span class="p" data-alvo="{alvo}">{mapa.get(alvo, "—")}</span>'
    t = re.sub(r'<span class="p" data-alvo="([a-zA-Z0-9]+)">[^<]*</span>', troca, t)
    html.write_text(t, encoding="utf-8")

def juntar():
    bordas = PdfReader(AQUI / "out-bordas.pdf")
    miolo  = PdfReader(AQUI / "out-miolo.pdf")
    w = PdfWriter()
    w.add_page(bordas.pages[0])          # capa
    w.add_page(bordas.pages[1])          # ficha
    for p in miolo.pages[2:]: w.add_page(p)  # miolo (descarta as 2 folgas)
    w.add_page(bordas.pages[2])          # contracapa
    w.add_metadata({
        "/Title": "Do zero ao app — 10 skills para criar o aplicativo interno da sua empresa",
        "/Subject": "Guia pratico + 10 skills instalaveis para construir apps de uso interno com IA",
        "/Keywords": "app interno, IA, Claude Code, Codex, skills, PWA, no-code, automacao",
        "/Creator": "Do zero ao app",
    })
    DIST.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "wb") as f: w.write(f)
    return len(w.pages)

print("passada 1: descobrindo as paginas...")
renderizar()
mapa, total = mapear_paginas(AQUI / "out-miolo.pdf")
print(f"  miolo com {total} paginas; {len(mapa)}/{len(ALVOS)} secoes localizadas")

print("passada 2: escrevendo o sumario e renderizando de novo...")
escrever_sumario(mapa)
renderizar()
mapa2, total2 = mapear_paginas(AQUI / "out-miolo.pdf")
if mapa2 != mapa:
    print("  paginacao mudou; reescrevendo e renderizando mais uma vez")
    escrever_sumario(mapa2)
    renderizar()
    mapa2, total2 = mapear_paginas(AQUI / "out-miolo.pdf")

print("juntando capa + ficha + miolo + contracapa...")
n = juntar()
print(f"\nPRONTO: {SAIDA}  ({n} paginas)")
print("Sumario:", ", ".join(f"{k}={v}" for k, v in mapa2.items()))
