# luisbrancher.dev

Site estático em [Astro](https://astro.build): uma página para recrutador e SRE com projetos, incidentes reais, stack com evidência, blog e CV em PDF. Português na raiz e inglês em `/en/`.

O conteúdo vem de `src/data/home.ts` (textos, projetos, incidentes, stack, trajetória), `src/data/profile.ts` (contato, certificações, VLANs e serviços do homelab) e dos posts em `src/content/blog/`.

## Rodar

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # gera dist/
```

## CV em PDF

Com `npm run dev` no ar, `npm run cv:pdf` gera `public/assets/luis-brancher-cv-{pt,en}.pdf` a partir de `/cv/` e `/en/cv/` (usa o Edge em modo headless). O CV precisa caber em uma página: confira o PDF depois de mexer em projetos, experiência ou certificações. Idiomas, cidadania e modalidade de trabalho ficam em `hiring`, em `src/data/home.ts`; o que estiver `null` não aparece.

## Escrever um post

Crie `src/content/blog/pt/<slug>.md` e `src/content/blog/en/<slug>.md`:

```md
---
title: "Título do post"
description: "Resumo de uma linha"
date: 2026-10-28
tags: ["Homelab", "Terraform"]
repo: "https://github.com/luisbrancher/algum-repo"   # opcional
translationKey: "slug-comum-pt-en"                   # liga o post PT ao EN
readingTime: 8                                        # opcional
draft: false                                          # opcional
---
```

Imagens em `public/assets/images-<slug>/` → `![alt](/assets/images-<slug>/img.png)`. Links entre posts: `../outro-slug/`.

Os filtros da página do blog agrupam as tags em assuntos; a lista fica no topo de `src/themes/runbook/pages/Blog.astro`. Assunto com um post só não vira botão.

## Estrutura

```
src/
  content/blog/{pt,en}/*.md        posts
  data/home.ts, profile.ts         conteúdo
  lib/routes.ts                    URLs, idiomas, helpers do blog
  themes/runbook/                  layout, CSS, páginas e NetworkDiagram
  pages/[...lang]/…                rotas (pt na raiz, en em /en)
public/assets/                     CV em PDF, imagens dos posts, diagrama D2
scripts/cv-pdf.mjs                 gera os PDFs do CV
```

## Deploy

GitHub Pages, pelo workflow `.github/workflows/deploy.yml`: cada push na `main` roda `npm ci && npm run build` e publica `dist/`. Em Settings > Pages, a origem fica em "GitHub Actions". O domínio vem de `public/CNAME`.

O site antigo, em HTML estático, está marcado com a tag `v1-static`. Os endereços dele (`/cv.html`, `/posts-blog/post-x.html` e outros) continuam funcionando: cada um é uma página em `public/` que redireciona para o endereço novo.
