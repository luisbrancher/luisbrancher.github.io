---
title: "Do servidor provisionado ao site no ar: configurando a EC2 com Ansible"
description: "Como configurei o servidor provisionado via Terraform, instalando Nginx e Tailscale de forma automatizada e idempotente usando Ansible."
date: 2026-03-31
readingTime: 7
tags: ["ANSIBLE", "AWS", "NGINX", "TAILSCALE", "DEVOPS"]
repo: "https://github.com/luisbrancher/personal-site-infra"
translationKey: "ansible"
---
No post anterior, terminei com uma EC2 rodando Debian na AWS: VPC própria, IAM com privilégio mínimo, hardening no boot. O servidor existia, mas era uma máquina vazia. Faltava o que realmente importa: configurar tudo que vai rodar dentro dela. É aí que entra o Ansible.

##  O que é Ansible e por que ele existe aqui

Terraform fala com APIs — cria recursos na AWS, no Cloudflare, onde for. Ansible fala com sistemas operacionais via SSH. Quando o `terraform apply` termina, você tem uma máquina. O Ansible é o que transforma essa máquina em servidor. O Ansible não precisa de agente instalado no servidor. Ele conecta via SSH, executa o que precisa, e sai. Tudo roda a partir da máquina local.

##  Ajustes no Terraform antes de começar

Antes de escrever uma linha de Ansible, percebi que o Terraform precisava de alguns ajustes, pois comprei meu domínio no Cloudflare e resolvi fazer o DNS por lá.

O primeiro: a porta 80. Eu tinha configurado o security group só com 443, pensando em HTTPS. Mas com o Cloudflare como proxy, o fluxo é diferente: o Cloudflare termina o HTTPS e repassa a requisição para a origem em HTTP. O visitante sempre vê HTTPS, mas a comunicação Cloudflare → EC2 é na porta 80. Sem ela aberta, o site simplesmente não carrega.

O segundo: o DNS. Eu comprei o domínio `luisbrancher.dev` e precisava que o Cloudflare apontasse pro IP da EC2. Em vez de fazer isso manualmente no dashboard, adicionei o provider do Cloudflare diretamente no Terraform. O resultado ficou assim:

```hcl
resource "cloudflare_record" "site" {
  zone_id = "..."
  name    = "@"
  content = aws_instance.server_debian.public_ip
  type    = "A"
  proxied = true
  ttl     = 1
}
```

O `content` referencia diretamente o IP da EC2 como atributo do recurso. O Terraform já sabe a ordem: cria a EC2, pega o IP, cria o registro DNS. Sem workaround, sem buscar o IP manualmente.

O token da Cloudflare ficou como variável de ambiente no HCP Terraform — mesmo padrão das credenciais da AWS. Zero segredo no código.

##  A estrutura do Ansible

```bash
ansible/
├── inventory.ini
├── group_vars/
│   ├── all.yml
│   └── vault.yml
├── templates/
│   └── nginx.conf.j2
└── site.yml
```

O `inventory.ini` é o mapa das máquinas — define onde o Ansible vai conectar e com qual chave SSH. O `group_vars/all.yml` centraliza as variáveis: domínio, caminhos, referências aos secrets. O `vault.yml` guarda a Tailscale auth key criptografada.

Sobre o Ansible Vault: em vez de exportar variáveis de ambiente ou deixar tokens expostos, o Vault criptografa o arquivo com uma senha master. Você commita o arquivo criptografado sem problema. Na hora de rodar, passa a senha:

```bash
ansible-playbook site.yml -i inventory.ini --ask-vault-pass
```

##  O playbook

O playbook tem três blocos principais.

**nginx** — instala, cria o diretório do site, aplica a configuração via template Jinja2 e garante que o serviço está rodando. A configuração do nginx usa um arquivo `.j2` onde as variáveis como domínio e caminho são substituídas na hora de copiar pro servidor. Assim o mesmo template funciona pra qualquer domínio.

Uma coisa que aprendi aqui: _handlers_. Em vez de reiniciar o nginx toda vez que uma task termina, o `notify` acumula as notificações e dispara o restart uma única vez no final.

**git** — em vez de copiar arquivos manualmente, o Ansible clona direto o repositório `luisbrancher.github.io` na pasta servida pelo nginx. Quando o conteúdo do site mudar, é só rodar o playbook de novo — ou futuramente automatizar via GitHub Actions.

```yaml
- name: Clonar o repositório do site
  ansible.builtin.git:
    repo: "https://github.com/luisbrancher/luisbrancher.github.io.git"
    dest: "{{ site_root }}"
    version: main
    force: true
```

**Tailscale** — instala via script oficial e conecta a instância à minha tailnet com a auth key. Depois disso, a EC2 passa a ter um hostname privado dentro da minha rede Tailscale — `algo.tail1234.ts.net`. A ideia é que numa próxima etapa, a porta 22 seja fechada no security group e todo o acesso SSH passe a acontecer só por dentro da tailnet.

##  Idempotência — um conceito importante

Dá pra rodar esse playbook dez vezes seguidas. Na primeira, instala tudo. Da segunda em diante, verifica o estado atual e não faz nada se já estiver correto.

Isso é idempotência. É diferente de um script bash onde `apt-get install nginx` simplesmente roda de novo toda vez. O módulo `apt` com `state: present` verifica primeiro: já está instalado? Então pula.

É essa diferença que torna Ansible adequado pra automação de verdade — e que vai permitir usar esse mesmo playbook como plano de recuperação se um dia precisar recriar tudo do zero.

##  O estado atual da infraestrutura

Com o Terraform e o Ansible trabalhando juntos, o fluxo ficou assim:

```bash
terraform apply
  → EC2 criada, DNS apontado, IP disponível no output

ansible-playbook
  → nginx instalado e configurado
  → site clonado do GitHub
  → Tailscale conectado

próximos passos:
  → confirmar acesso via Tailscale
  → fechar porta 22
  → GitHub Actions para deploy automático no push
```

O repositório com todo o código está em [github.com/luisbrancher/personal-site-infra](https://github.com/luisbrancher/personal-site-infra).

### 💡 Lições

- Ansible e Terraform não competem — cada um tem seu domínio claro. Aprender onde termina um e começa o outro foi metade do aprendizado.
- DNS pertence ao Terraform, não ao Ansible. O IP da EC2 já é um atributo nativo do recurso — referenciar diretamente é mais limpo do que qualquer workaround.
- Secrets têm ferramentas diferentes dependendo de quem os consome. HCP Terraform pro que o Terraform usa. Ansible Vault pro que o Ansible usa.
- Idempotência não é um detalhe de implementação — é o princípio que torna automação confiável.
