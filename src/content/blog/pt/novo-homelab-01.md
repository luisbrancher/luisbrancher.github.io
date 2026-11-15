---
title: "Reformulando meu homelab #01: planejamento, hardware e Terraform"
description: "Planejamento e provisionamento da nova arquitetura do meu homelab utilizando Proxmox, k3s e Terraform para gerenciar tudo como código."
date: 2026-04-04
readingTime: 6
tags: ["HOMELAB", "TERRAFORM", "PROXMOX", "IAC", "DEVOPS"]
repo: "https://github.com/luisbrancher/homelab-infra"
translationKey: "novo-homelab-01"
---
Tô viajando faz alguns meses e enquanto isso meu homelab em casa tá rodando e me atendendo como servidor de arquivos NAS, exit node brasileiro e alguns outros serviços, como UpSnap para ligar minha workstation em casa quando necessário, mas depois de uma leve dor de cabeça com queda de energia ([descrita nesse artigo](../drp/)) já considero ele aposentado. Um Ryzen 5800X com ZimaOS, tudo em Docker Compose, sem nenhuma organização séria. Funciona, mas tá longe do que eu quero.

Quando voltar pro Brasil, vou refazer tudo do zero. E já que tenho tempo aqui na viagem, resolvi planejar direitinho antes de encostar a mão no hardware. Escrever o código, pensar na arquitetura, deixar tudo pronto pra só chegar em casa e executar.

Esse artigo é o começo dessa série. Vou falar sobre o hardware novo, a arquitetura que escolhi e como tô usando Terraform pra provisionar tudo de forma profissional.

##  O hardware novo

A principal motivação da troca foi eficiência energética. Hoje uso um 5800X que sobrou por aqui de uma atualização de workstation, é um processador excelente mas consume bastante energia pra ficar ligado 24/7 como servidor. A nova stack é bem mais enxuta:

- **i5 1345U** (Chatreey TK-13F): servidor principal, 16GB DDR4 SO-DIMM com slot pra expandir pra 32GB depois
- **N150** (4 NICs): roteador dedicado rodando OPNsense bare metal
- **Raspberry Pi 4**: serviços auxiliares de rede e câmeras

O i5 1345U é um mini PC com consumo bem menor que um desktop, mas processador de 13ª geração com 12 cores. Mais do que suficiente pra rodar Proxmox com algumas VMs.

##  A arquitetura

Ao invés de instalar tudo direto no OS como fazia antes, dessa vez vou usar Proxmox como hypervisor e dividir as responsabilidades em VMs separadas:

```
Proxmox (i5 1345U)
├── VM: k3s-node        → todos os serviços principais
├── VM: storage-server  → NFS e backups
└── LXC: lxc-monitoring → Prometheus + Grafana + Loki

N150
└── OPNsense bare metal → roteador, firewall, VLANs

Pi4
├── Omada Controller    → gerenciamento dos APs
├── MotionEye           → câmeras
└── UpSnap              → Wake-on-LAN
```

O ponto central é o **k3s** rodando na VM principal. k3s é uma distribuição leve do Kubernetes que substitui o Docker Compose com um modelo declarativo. Você descreve o estado desejado dos seus serviços via manifests YAML e ele garante continuamente que tudo tá rodando. Se um container travar, ele reinicia automaticamente. Quer atualizar uma imagem? Muda o manifest, faz git push, e o ArgoCD aplica no cluster sozinho.

A `storage-server` não roda nenhum serviço de aplicação. Ela só exporta volumes via NFS que o k3s-node monta pra persistir os dados do Jellyfin, Immich e afins. Disco dedicado de 100GB separado do OS.

O LXC de monitoramento roda fora do k3s intencionalmente. Se a VM principal reiniciar, o Prometheus e o Grafana continuam de pé e você consegue ver exatamente o que aconteceu.

O Pi4 ficou com os serviços que não fazem sentido dentro do Proxmox: Omada Controller pra gerenciar os APs TP-Link e MotionEye pra câmeras. Serviços que precisam estar disponíveis independente do estado do servidor principal.

E o Tailscale vai em todas as máquinas via Ansible, acesso remoto seguro a tudo sem expor nada pra internet.

##  O stack completo de IaC

O que mudou em relação ao meu setup anterior é que dessa vez quero tratar o homelab como infraestrutura de verdade. Cada peça tem uma ferramenta responsável:

```
Terraform   → cria as VMs no Proxmox
     ↓
Ansible     → configura o OS de cada VM
     ↓
k3s         → orquestra os containers
     ↓
ArgoCD      → GitOps, deploy via git push
```

Nada de SSH manual, nada de "deixa eu lembrar o que instalei nessa máquina". Se o hardware morrer amanhã, instalo o Proxmox no substituto e rodo três comandos.

##  O Terraform

Comecei pelo Terraform porque é a primeira camada. Sem as VMs criadas, o Ansible não tem onde rodar.

O provider que usei foi o `telmate/proxmox`, que é o mais maduro pra essa finalidade. A estrutura do projeto ficou assim:

```
homelab-infra/
├── terraform/
│   ├── main.tf                   → terraform block + provider proxmox
│   ├── variables.tf              → todas as variáveis centralizadas
│   ├── outputs.tf                → IPs das VMs após o apply 
│   ├── vm_k3s-node.tf
│   ├── vm_storage-server.tf
│   └── lxc_monitoring.tf
```

Um arquivo por VM. Quando precisar ajustar só a RAM do k3s-node, vou direto no `vm_k3s-node.tf` sem navegar um `main.tf` gigante.

A VM principal do k3s ficou assim:

```hcl
resource "proxmox_vm_qemu" "k3s_node" {
  name        = var.k3s_server
  target_node = var.proxmox_node
  vmid        = 9000

  clone  = var.vm_template

  cores  = 4
  memory = 8192

  network {
    bridge = var.network_bridge
    model  = "virtio"
  }

  ipconfig0 = "ip=dhcp"
  sshkeys   = var.ssh_public_key_homelab
}
```

A lógica é a mesma que usei para criar uma EC2 na AWS ([aqui](../iac-terraform/)). Você declara o estado desejado e o Terraform garante que ele existe. A diferença é que ao invés de chamar a API da AWS, ele chama a API do Proxmox.

O `storage-server` tem um disco adicional de 100GB declarado separado do disco do OS. Esse é o volume que vai ser exportado via NFS depois:

```
disk {
  type    = "scsi"
  slot    = 1
  size    = "100G"
  storage = var.data_storage_pool
}
```

E o LXC de monitoramento usa um resource diferente das VMs. `proxmox_lxc` ao invés de `proxmox_vm_qemu`, porque LXC não emula hardware completo, compartilha o kernel do Proxmox e é bem mais leve pra serviços que não precisam de isolamento total:

```hcl
resource "proxmox_lxc" "monitoring" {
  hostname    = var.monitoring_server
  target_node = var.proxmox_node
  vmid        = 9020

  ostemplate = var.lxc_template

  cores  = 2
  memory = 1024

  network {
    name   = "eth0"
    bridge = var.network_bridge
    ip     = "dhcp"
  }

  rootfs {
    size    = "20G"
    storage = var.storage_pool
  }

  ssh_public_keys = var.ssh_public_key_homelab
}
```

As variáveis sensíveis (senha do Proxmox e chave SSH) ficam no HCP Terraform e nunca entram no repositório. Mesmo padrão que uso na infra do `luisbrancher.dev`.

##  Próximos passos

Esse foi o planejamento e a primeira camada de IaC. Nos próximos artigos vou cobrir:

- **Ansible**: configuração do OS das VMs, instalação do k3s, setup do NFS e Tailscale em tudo
- **k3s**: primeiros serviços rodando, Traefik como ingress, cert-manager pra TLS automático
- **ArgoCD**: GitOps de verdade, deploy via git push

O código tá no GitHub em [luisbrancher/homelab-infra](https://github.com/luisbrancher/homelab-infra) se quiser acompanhar.
