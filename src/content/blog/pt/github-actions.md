---
title: "Do deploy manual ao automático: meu primeiro pipeline com GitHub Actions"
description: "Como automatizei o deploy do meu site usando GitHub Actions, rsync e Tailscale, incluindo os problemas resolvidos no caminho."
date: 2026-04-02
readingTime: 5
tags: ["GITHUB ACTIONS", "CI/CD", "TAILSCALE", "RSYNC", "DEVOPS"]
translationKey: "github-actions"
---
Toda vez que eu escrevia um artigo novo no blog, o fluxo era o mesmo: terminar o HTML, abrir o terminal, rodar o Ansible manualmente pra copiar os arquivos pro servidor. Funcionava. Mas era manual, chato, e já entendi que não é assim que funciona no mercado.

Decidi automatizar. O objetivo era simples: qualquer push na `main` do repositório do site deveria disparar o deploy automaticamente, sem eu precisar fazer nada. Este artigo documenta como cheguei lá, incluindo todos os erros no caminho.

##  O que eu tinha antes

O servidor já estava configurado via Ansible: nginx rodando, Tailscale instalado, arquivos em `/var/www/luisbrancher.dev/`. O deploy manual era basicamente um `git clone` + `chown` que o próprio playbook resolvia.

O que eu queria era eliminar essa etapa manual. Push no repo → site atualizado. Sem abrir terminal, sem rodar Ansible.

##  A escolha: GitHub Actions + rsync

O GitHub Actions é a ferramenta de CI/CD nativa do GitHub. Cada workflow é um arquivo YAML dentro de `.github/workflows/` no próprio repositório. Quando o evento configurado acontece, no meu caso um push na `main`, o GitHub sobe um runner (uma VM Ubuntu), executa os steps definidos e destrói tudo no final.

Para o deploy em si, escolhi rsync via SSH. O Ansible já usava essa abordagem por baixo: rsync é a ferramenta certa pra sincronizar arquivos entre máquinas, transferindo só o que mudou.

O servidor fica acessível via Tailscale, então o runner também precisaria entrar na minha Tailnet antes de conseguir alcançar o servidor.

##  Estrutura do workflow

Criei o arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy Site

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Connect on Tailscale
        uses: tailscale/github-action@v2
        with:
          authkey: ${{ secrets.TS_AUTHKEY }}
          args: --accept-routes

      - name: Fix ownership before deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: sudo chown -R admin:admin /var/www/luisbrancher.dev/

      - name: Deploy with rsync
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete --exclude='.git/'
          path: ./
          remote_path: /var/www/luisbrancher.dev/
          remote_host: ${{ secrets.SERVER_HOST }}
          remote_user: ${{ secrets.SERVER_USER }}
          remote_key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Fix ownership after deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: sudo chown -R www-data:www-data /var/www/luisbrancher.dev/
```

O fluxo em palavras:

1. Runner sobe uma VM Ubuntu
2. Faz checkout do repositório
3. Entra na minha Tailnet com uma auth key efêmera
4. Passa o dono dos arquivos no servidor pro `admin` (pra permitir a escrita)
5. rsync copia os arquivos, excluindo a pasta `.git/`
6. Devolve o dono pro `www-data` (pra o nginx conseguir ler)
7. Job termina → runner é destruído → sai automaticamente da Tailnet

Os secrets `TS_AUTHKEY`, `SERVER_HOST`, `SERVER_USER` e `SSH_PRIVATE_KEY` ficam em **Settings → Secrets and variables → Actions** no GitHub. Nada de credencial no código.

##  Os erros que apareceram

Não funcionou na primeira tentativa. Nem na segunda. Cada erro ensinou alguma coisa.

### Erro 1 — Permission denied (publickey)

```
Warning: Permanently added '***' (ED25519) to the list of known hosts.
***@***: Permission denied (publickey).
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
```

O Tailscale estava funcionando, o runner chegou no servidor e registrou o host. Mas o SSH rejeitou a conexão.

O problema estava na chave privada cadastrada no secret do GitHub. Chave ED25519 precisa da newline no final e se copiar sem ela, chega corrompida pro runner e o SSH rejeita silenciosamente. Recriei o secret copiando com cuidado do terminal.

Mesmo assim o erro persistiu. Porque a chave que eu estava usando possuía uma passphrase.

A solução definitiva foi criar um par dedicado pro CI/CD, sem passphrase (o runner não consegue digitar senha interativamente):

```
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/id_ed25519_deploy
```

Adicionei a pública no servidor:

```bash
ssh -i ~/.ssh/id_ed25519 admin@<IP-tailscale> \
  "echo '$(cat ~/.ssh/id_ed25519_deploy.pub)' >> ~/.ssh/authorized_keys"
```

E cadastrei a privada no secret. Chave pessoal e chave de automação separadas, é a prática certa de qualquer forma.

### Erro 2 — rsync: command not found

```
Identity added: (stdin) (github-actions-deploy)
Warning: Permanently added '***' (ED25519) to the list of known hosts.
bash: line 1: rsync: command not found
```

A chave estava funcionando agora. Mas o rsync não estava instalado no servidor. O Ansible nunca tinha precisado instalar porque usava o módulo `ansible.builtin.git` pra clonar o repositório, não rsync direto.

```bash
sudo apt install rsync -y
```

### Erro 3 — Permission denied no rsync

```
rsync: [receiver] mkstemp "/var/www/luisbrancher.dev/.index.html..." failed: Permission denied (13)
```

O rsync conectou, mas não conseguiu escrever os arquivos. O diretório `/var/www/luisbrancher.dev/` pertencia ao `www-data` — o usuário do nginx. O `admin` não tinha permissão de escrita.

A solução foi adicionar dois steps de `chown` em volta do rsync: um antes pra passar o dono pro `admin`, um depois pra devolver pro `www-data`. O nginx continua lendo normalmente, e o rsync consegue escrever durante o deploy.

### Erro 4 — .git/ sendo copiado pro servidor

No mesmo log do erro 3, dava pra ver a pasta `.git/` sendo enviada pro servidor junto com os arquivos do site. Não faz sentido ter isso em `/var/www/`. O fix foi adicionar `--exclude='.git/'` nos switches do rsync.

##  O que ficou

O workflow final resolve exatamente o que eu precisava. Push na `main` → site atualizado em segundos, sem intervenção manual.

O próximo passo natural é fechar a porta 22 publicamente no Security Group via Terraform, hoje ela ainda está aberta, uma dívida técnica documentada desde o projeto de IaC. Com o deploy passando pela Tailscale, não tem mais motivo pra manter SSH exposto.

E quando o homelab novo subir com ArgoCD, o ciclo fecha: GitHub Actions como CI no repositório do site, ArgoCD como CD no cluster. Mas isso é assunto pra outro post.

### 💡 O que aprendi

A maior lição não foi técnica, foi sobre troubleshooting. Cada erro no Actions aparece no log com detalhes suficientes pra entender o que aconteceu. O processo é: ler o erro, identificar a causa, corrigir, commitar, push, ver o próximo erro.

É assim que funciona na prática. É muito legal quando funciona de primeira, mas nem sempre é a realidade. O que importa é saber ler o log e não desistir no segundo erro.
