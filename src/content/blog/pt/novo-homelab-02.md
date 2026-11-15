---
title: "Reformulando meu homelab #02: Ansible, NFS e três dias fritando a cabeça"
description: "A camada que entra depois do Terraform: configurando as VMs do zero de forma idempotente usando Ansible, com NFS, Tailscale e Node Exporter."
date: 2026-04-08
readingTime: 6
tags: ["HOMELAB", "ANSIBLE", "NFS", "PROXMOX", "DEVOPS"]
repo: "https://github.com/luisbrancher/homelab-infra"
translationKey: "novo-homelab-02"
---
No artigo anterior ([aqui](../novo-homelab-01/)) falei sobre o planejamento, o hardware novo e o Terraform pra provisionar as VMs no Proxmox. Hoje é a vez do Ansible, a camada que entra depois que as VMs existem e configura tudo do zero.

Spoiler: foram os dias mais intensos até agora. Muita coisa nova ao mesmo tempo, bastante dúvida no caminho, e alguns momentos de "por que isso não funciona?". Mas no final fez sentido, e acho que mostrar esse processo todo é mais útil do que fingir que saí escrevendo tudo de primeira.

##  O que o Ansible faz nesse stack

Depois do `terraform apply`, você tem VMs criadas mas completamente zeradas. Debian 12 limpo, sem nada instalado. O Ansible entra via SSH em cada uma e executa uma sequência de tasks pra deixar tudo configurado: instala pacotes, formata discos, configura serviços, injeta arquivos de config via templates.

A diferença pro que eu fazia antes (um script bash ou seguir tutorial) é que o Ansible é **idempotente**. Você pode rodar o mesmo playbook dez vezes e o resultado é sempre o mesmo. Se o pacote já tiver instalado, ele não instala de novo. Se o serviço já estiver rodando, ele não reinicia. Isso muda a forma de pensar sobre configuração de servidor.

##  A estrutura

A primeira dúvida foi: um playbook gigante ou vários arquivos? Comecei com a ideia de um `proxmox.yml` com tudo, mas conforme fui escrevendo ficou óbvio que cada VM merecia o próprio arquivo. A estrutura final ficou assim:

```bash
ansible/
   ├── inventory.ini             → hosts and groups
   ├── site.yml                  → main entrypoint, imports all playbooks
   ├── group_vars/all/
   │   ├── vars.yml              → shared variables
   │   └── vault.yml             → encrypted secrets (Ansible Vault)
   └── playbooks/
        ├── proxmox.yml           → imports all Proxmox playbooks
        ├── k3s-node.yml          → k3s + Tailscale + Node Exporter
        ├── storage-server.yml    → NFS + Tailscale + Node Exporter
        ├── monitoring.yml        → Prometheus + Grafana + Loki + Tailscale
        ├── pi4.yml               → Omada + MotionEye + Tailscale + Node Exporter
        └── templates/
             ├── exports.j2            → /etc/exports (NFS)
             ├── prometheus.yml.j2     → Prometheus scrape config
             ├── grafana.ini.j2        → Grafana config
             ├── loki-config.j2        → Loki config
             ├── loki.service.j2       → Loki systemd service
             └── upsnap.service.j2     → UpSnap systemd service
```

O `site.yml` é o entrypoint de tudo. Você roda `ansible-playbook site.yml` e ele configura cada máquina na ordem certa. Mas também dá pra rodar só um playbook específico quando precisar reconfigurar só o monitoring, por exemplo.

##  O inventory e as variáveis

Uma coisa que aprendi cedo: não repetir configuração. O `inventory.ini` tem só o que é único de cada host, IP e grupo:

```
[proxmox_vms]
k3s-node       ansible_host=<IP>
storage-server ansible_host=<IP>
lxc-monitoring ansible_host=<IP>

[pi4]
pi4 ansible_host=<IP>
```

O resto (usuário SSH, chave, become) vai no `group_vars/all/vars.yml` e se aplica a tudo automaticamente. Se eu mudar a chave SSH um dia, mudo em um lugar só.

Os secrets ficam no `vault.yml` criptografado com Ansible Vault: senha do Grafana, auth key do Tailscale. O arquivo vai pro git criptografado, os valores nunca ficam expostos.

##  k3s-node: mais simples do que parecia

O playbook do k3s-node foi o mais direto. O k3s tem um script de instalação oficial que cuida de tudo:

```yaml
- name: Baixar e rodar o script de instalação do k3s
  ansible.builtin.shell:
    cmd: curl -fsSL https://get.k3s.io | sh
    creates: /usr/local/bin/k3s
```

O `creates` é o que garante idempotência aqui. Se o binário já existir, a task é pulada. Não precisa verificar versão nem nada, só checar se o binário tá lá.

Depois disso: garantir que o serviço tá rodando no boot, instalar o Node Exporter pra expor métricas pro Prometheus, e instalar o Tailscale. Esse padrão de Tailscale + Node Exporter se repete em todas as máquinas, é infraestrutura transversal.

##  storage-server: onde aprendi sobre NFS de verdade

Nunca tinha configurado NFS de forma séria antes. Sabia o que era, mas na prática sempre usei Samba ou acesso direto. Aqui não tinha saída.

O fluxo é: formatar o disco extra, montar, criar os diretórios de cada serviço, e exportar via NFS. O Ansible tem módulos específicos pra cada passo:

```yaml
- name: Formatar disco com ext4
  community.general.filesystem:
    fstype: ext4
    dev: "{{ storage_device }}"

- name: Montar disco e adicionar no fstab
  ansible.builtin.mount:
    path: "{{ storage_mount }}"
    src: "{{ storage_device }}"
    fstype: ext4
    opts: defaults
    state: mounted
```

O `mount` com `state: mounted` faz duas coisas ao mesmo tempo: monta o disco agora e adiciona no `/etc/fstab` pra persistir após reboot. Um módulo, dois problemas resolvidos.

Os diretórios de dados usam um `loop` em cima da mesma lista que define os exports NFS, única fonte de verdade:

```yaml
- name: Criar diretórios de dados
  ansible.builtin.file:
    path: "{{ item.path }}"
    state: directory
    mode: '0755'
  loop: "{{ nfs_exports }}"
```

Quando adicionar um serviço novo, só adiciono uma entrada no `vars.yml` e automaticamente cria o diretório e exporta via NFS. Sem risco de criar o diretório e esquecer de exportar.

O `/etc/exports` é gerado por um template Jinja2:

```
{% for export in nfs_exports %}
{{ export.path }}   {{ export.clients }}({{ export.options }})
{% endfor %}
```

E o IP do cliente (quem pode montar o NFS) não é hardcoded. Vem direto do inventory:

```
k3s_node_ip: "{{ hostvars['k3s-node']['ansible_host'] }}"
```

Se o IP mudar no inventory, o exports é atualizado automaticamente na próxima vez que o playbook rodar.

##  monitoring: o mais trabalhoso

Prometheus e Grafana foram tranquilos, ambos têm pacote oficial, é só adicionar repositório e instalar. O Loki foi outra história.

Loki não tem pacote `.deb` oficial. Só tem binário no GitHub. Então tive que fazer manualmente tudo que o `apt` faria automaticamente num pacote normal: criar usuário de sistema, baixar e descompactar o binário, criar diretórios de config, gerar o arquivo de configuração via template, e criar um arquivo `.service` pro systemd.

Esse último ponto foi uma das partes mais interessantes. Pra qualquer processo virar um serviço gerenciado pelo sistema (iniciar no boot, reiniciar se cair) ele precisa de um arquivo `.service` em `/etc/systemd/system/`. É basicamente o equivalente do `restart: unless-stopped` do Docker Compose, só que no nível do OS:

```
[Service]
User=loki
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/config.yml
Restart=always
```

O Ansible gera esse arquivo via template e usa um handler pra fazer o `daemon-reload` e iniciar o serviço. Só roda quando o arquivo foi criado ou modificado, não toda vez que o playbook executa.

Uma dúvida que tive aqui: por que não rodar o Loki em Docker dentro do LXC? A resposta é que seria overhead desnecessário. O LXC já é isolamento suficiente, adicionar Docker em cima seria uma camada a mais sem benefício real.

##  Pi4: ARM tem suas particularidades

O Pi4 roda Debian ARM, e isso trouxe uma pegadinha que quase passou despercebida. O Omada Controller da TP-Link disponibiliza instaladores separados por arquitetura. O padrão que você acha na maioria dos tutoriais é `linux_x64`, mas no Pi4 é `linux_aarch64`. Instalar a versão errada num ARM falha silenciosamente na melhor das hipóteses.

O MotionEye não tem pacote no apt do Debian 12, instala via pip. E tanto Omada quanto MotionEye têm configuração feita pela interface web depois de instalados, então o Ansible só precisa instalar e garantir que estão rodando. Sem templates de config aqui.

Para o UpSnap precisei baixar o binário no GitHub. E assim como no Loki tive que fazer manualmente tudo que o `apt` faria. Usei um template Jinja2 para o `.service` do systemd. Um ponto diferente do Loki, que armazena dados localmente no LXC, no UpSnap persiste a config via NFS montado do storage-server, então também precisei instalar aqui o NFS client via `apt`.

##  Síndrome do impostor ou só pouca prática?

Durante o dia fiquei com uma sensação estranha. Sabia o que cada coisa estava fazendo, conseguia explicar a lógica, mas sem referência não teria chegado na sintaxe certa de primeira. Isso é síndrome do impostor ou é só como aprendizado funciona?

Acho que é a segunda opção. Ninguém decora a sintaxe do `ansible.builtin.mount` na primeira vez. A diferença entre seguir tutorial cegamente e aprender de verdade é conseguir explicar o que cada linha faz e por quê, e isso eu consigo. O resto é repetição.

##  Próximos passos

Com Terraform e Ansible prontos, a infraestrutura tá definida do zero ao OS configurado. O próximo passo é o k3s em si: manifests YAML pra cada serviço, Traefik como ingress, cert-manager pra TLS automático, e ArgoCD pra fechar o loop de GitOps.

Tudo isso ainda em viagem, antes de voltar pro Brasil e finalmente executar tudo isso num hardware de verdade.

O código tá no GitHub em [luisbrancher/homelab-infra](https://github.com/luisbrancher/homelab-infra) se quiser acompanhar.
