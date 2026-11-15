---
title: "Reformulando meu homelab #04: configurando a rede antes de qualquer servidor"
description: "Configurando OPNsense na borda, VLANs com switch gerenciável e AP com OpenWrt, além da automação usando Ansible."
date: 2026-05-09
readingTime: 6
tags: ["HOMELAB", "NETWORKING", "OPNSENSE", "VLAN", "ANSIBLE"]
repo: "https://github.com/luisbrancher/homelab-network"
translationKey: "novo-homelab-03"
---
Enquanto estava viajando, comecei a escrever todo meu homelab em IaC para uma reformulação e automação das configurações para nova versão em estado declarativo, tudo documentado por aqui. Mas chegando em casa, percebi que o primeiro passo seria reconfigurar minha rede, pois trouxe um appliance n150 pra rodar como meu novo OPNsense na borda, um novo switch 2.5Gbe e um Travel Router Cudy TR3000 que comprei na viagem e enquanto está em casa vai virar um AP.

E pra configurar, antes de ligar tudo no rack definitivo, resolvi montar uma bancada de testes. A ideia era simples: configurar o roteador, o switch e o AP do zero, validar que as VLANs funcionam end-to-end, e só depois migrar os dispositivos reais. Melhor errar na bancada do que derrubar a rede de casa.

O hardware da vez: N150 com 4 NICs rodando OPNsense bare metal, switch gerenciável SKS3200-8E2X, e um Cudy TR3000 com OpenWrt fazendo papel de AP temporário até o Omada EAP650 entrar em operação.

No fim tudo funcionou, mas não sem alguns resets no caminho.

##  BIOS antes de tudo

Antes de bootar o instalador do OPNsense, algumas configurações de BIOS que fazem diferença num mini PC rodando como roteador:

- **Secure Boot e Fast Boot**: desabilitados. Secure Boot impede o boot do OPNsense, Fast Boot pode causar problema na detecção das NICs.
- **Power on after AC loss**: habilitado como "Power ON". Essencial. Se cair a luz, o roteador sobe sozinho sem ninguém precisar apertar botão.
- **C-States / CPU Power Management**: desabilitado. Em roteador, latência importa mais que economia de energia. Estado de sleep profundo do CPU adiciona latência no processamento de pacotes.
- **VT-x / Intel Virtualization**: desabilitado. Não vai rodar VM dentro do OPNsense, não precisa.
- **Wake on LAN**: habilitado, mas só pra ter a opção depois.

##  Instalando o OPNsense

Para o disco, escolhi **UFS** em vez de ZFS. O N150 tem 8GB de RAM e vai rodar só como roteador. ZFS come memória e faz sentido quando você tem storage pesado e precisa de snapshots. Aqui não tem nenhum dos dois, UFS no NVMe de 128GB é suficiente pra vida útil do equipamento.

Depois do boot inicial, o OPNsense não identificou as portas automaticamente. Tive que usar o auto-detect manual no console: desconecta e reconecta o cabo em cada porta enquanto ele escuta qual interface acendeu o link. Com 4 NICs é fácil errar qual é qual sem fazer isso.

A configuração final das portas ficou:

- `igc0` → WAN (cabo vindo do roteador do ISP)
- `igc3` → LAN trunk (cabo pro switch)
- `igc1` e `igc2` → livres por enquanto

Um detalhe importante na hora de configurar os IPs via console: quando ele pergunta **"Restore web GUI access defaults?"**, a resposta é sempre **N**. Essa opção existe pra recuperar acesso perdido, não pra configuração inicial. Na primeira vez respondi Y sem pensar e ele resetou a LAN pra 192.168.1.x, que conflitava com o roteador do ISP. Tive que reconfigurar.

A LAN ficou em `10.10.10.1/24` com DHCP entre `.100` e `.200`. Escolhi o range `10.10.x.x` justamente pra não colidir com o `192.168.1.x` do ISP no cenário de double NAT.

##  VLANs no OPNsense

Com o básico funcionando, hora de criar a segmentação de rede. O plano foi quatro VLANs:

| VLAN | ID | Subnet |
| --- | --- | --- |
| trusted | 10 | 10.10.10.0/24 |
| iot | 20 | 10.10.20.0/24 |
| guest | 30 | 10.10.30.0/24 |
| lab | 40 | 10.10.40.0/24 |

A `trusted` já é a LAN existente. As outras três criei em **Interfaces → Devices → VLAN**, todas com parent `igc3` (a porta que vai pro switch).

Depois do assign e habilitação de cada interface, configurei o DHCP range em **Services → Dnsmasq → DHCP ranges**: `.100` a `.200` em cada uma, deixando o início livre pra IPs estáticos dos servidores quando o homelab principal subir.

##  Regras de firewall

O OPNsense processa regras de cima pra baixo. Primeira que bater, executa. Então bloqueio sempre antes da liberação.

A lógica por VLAN:

**IoT e Guest**: só internet, totalmente isoladas. Primeiro bloqueia acesso às outras redes privadas, depois libera qualquer destino.

```
[block] iot_net → lan_net
[block] iot_net → guest_net
[block] iot_net → lab_net
[pass]  iot_net → any
```

Mesma estrutura pra guest, substituindo os destinos.

**Lab**: pode falar com trusted, não pode falar com iot nem guest.

```
[block] lab_net → guest_net
[block] lab_net → iot_net
[pass]  lab_net → any
```

Uma coisa que aprendi testando: não dá pra bloquear `10.0.0.0/8` de uma vez pra simplificar. Isso inclui o gateway `10.10.10.1` que é o próprio OPNsense. DHCP e DNS param de funcionar. As regras precisam ser específicas por subnet de destino, usando os aliases de rede (`lan_net`, `iot_net`, etc.) que o OPNsense resolve corretamente.

##  Configurando o switch

O SKS3200-8E2X é um switch gerenciável de 8 portas com 2 SFP+. A configuração de VLAN fica em **Tagged VLAN**.

Antes de criar qualquer coisa: **nunca mexer na VLAN 1**. É a VLAN de management padrão. Tirei portas dela uma vez, caiu o acesso ao switch e tive que fazer reset físico pra recuperar. Aprendi na força.

A estrutura de portas ficou assim:

| Porta | Função |
| --- | --- |
| 1 | Trunk → OPNsense (tagged em todas as VLANs) |
| 2 a 6 | Access → trusted (untagged VLAN 10) |
| 7 | Trunk → AP Cudy (tagged em todas as VLANs) |
| 8 | Trunk → AP Omada EAP650 (tagged em todas as VLANs) |

As portas de trunk recebem frames com tag de VLAN. As portas de access entregam tráfego sem tag pro dispositivo final, que nem sabe que VLAN existe. O switch faz toda a separação transparente.

##  OpenWrt no Cudy como AP

Aqui foi onde passei mais tempo. Primeiro precisei trocar o OS de fábrica da Cudy pelo OpenWrt puro, usando a própria ferramenta da Cudy de transição que funciona como ponte para instalar o novo OS.

Com o OpenWrt instalado, o objetivo era transformá-lo em dumb AP: desabilitar DHCP, desabilitar o roteamento, e passar VLANs tagged pro switch.

Os primeiros passos foram diretos:

- IP estático `10.10.10.5` na LAN
- DHCP desabilitado (quem distribui IP é o OPNsense)
- Interfaces WAN deletadas
- Porta física eth0 (2.5GbE) adicionada à bridge LAN

Pra SSID trusted tudo funcionou de primeira. O tráfego sem tag sai do AP, chega na porta 7 do switch que trata como VLAN 10, e o OPNsense entrega IP `10.10.10.x`. Celular conectado, internet funcionando.

O problema começou quando tentei adicionar o SSID iot na VLAN 20.

A abordagem errada foi criar a interface `eth0.20` direto e associar ao SSID. O dispositivo aparecia no sistema, mas o tráfego nunca chegava no OPNsense. Nenhum log de DHCP, nenhuma tentativa de conexão. O frame ia pro limbo em algum ponto antes.

O motivo: o `eth0` já faz parte do `br-lan`. Criar `eth0.20` em cima dele não funciona como esperado porque o bridge intercepta o tráfego antes que o VLAN tagging aconteça.

A solução correta é o **Bridge VLAN filtering** no `br-lan`. Em **Network → Interfaces → Devices → br-lan → Bridge VLAN filtering**, você habilita e configura quais VLANs passam por quais portas.

Tentativa 1: habilitei o filtering e adicionei só a VLAN 20 como tagged. Apliquei. AP ficou inacessível, rollback automático do OpenWrt. Reset físico.

Tentativa 2: habilitei o filtering, adicionei VLAN 20 tagged e VLAN 1 untagged. A VLAN 1 garante que o tráfego de management continue fluindo depois do apply. Apliquei com "unchecked configuration apply" pra não esperar confirmação de conectividade. Funcionou.

Depois do apply, o OpenWrt criou automaticamente os devices `br-lan.1` e `br-lan.20`. Editei a interface `lan` para usar `br-lan.1` como device (ajuste necessário via SSH no `/etc/config/network`), criei a interface `iot` apontando pra `br-lan.20`, e associei o SSID iot a essa interface.

Celular conectado no `lfck-iot_2g`, IP `10.10.20.x` via DHCP do OPNsense. End-to-end funcionando.

##  Ansible: do rascunho à execução real

Com tudo validado manualmente, a próxima etapa era transformar o processo em código e rodar de verdade. Esse foi o passo que mais me ensinou sobre a diferença entre escrever Ansible e executar Ansible.

Três arquivos no repositório: `hosts.ini` com o inventário, `setup_opnsense.yml` pra provisionar o OPNsense via SSH e API REST, e `setup_cudy_ap.yml` pra configurar o OpenWrt via SSH.

O teste de conectividade inicial:

```bash
ansible -i ansible/hosts.ini opnsense -m ping --ask-vault-pass
ansible -i ansible/hosts.ini cudy_ap -m raw -a "/bin/true" --ask-vault-pass
```

Dois problemas logo de cara.

**Problema 1**: o `ansible_user` criado no OPNsense estava sem acesso ao shell. O ping falhava com erro de autenticação. Liberei o acesso shell no dashboard do OPNsense e resolveu.

**Problema 2**: o nome do host no inventário estava duplicando com o nome do grupo. Renomeei o host de `opnsense` pra `n150` no `hosts.ini` pra evitar conflito.

Após o ping funcionar nos dois:

```
n150 | SUCCESS => { "ping": "pong" }
cudy_ap | CHANGED | rc=0
```

Rodei o `setup_opnsense.yml` e começaram os erros reais.

**Collection**: o módulo `oxlorg.opnsense.firewall_rule` não existia. O nome correto na collection é `oxlorg.opnsense.rule`. Uma linha de diff, meia hora de debug lendo documentação.

**become**: adicionei `become: true` pra rodar comandos como sudo no OPNsense. Não funcionou, o FreeBSD tem um comportamento diferente do Linux nesse ponto. Solução pragmática: mudei pra `ansible_user=root` direto.

**Firmware update**: o `poll: 0` fazia o Ansible disparar o update e ir embora sem esperar terminar, causando falhas nas tasks seguintes. Removi o `poll: 0` pra ele esperar o update completar antes de continuar. Adicionei também um `wait_for` na porta 443 pra aguardar o OPNsense voltar depois do reboot.

**changed\_when**: tasks como a otimização de kernel e o PowerD reportavam `changed` toda vez que rodavam, mesmo sem mudar nada. Adicionei `changed_when: false` nas tasks que são naturalmente idempotentes pra não poluir o output.

O problema mais interessante foi o DHCP. Ao rodar o playbook, percebi que os recursos estavam sendo criados no **Kea DHCP** em vez do Dnsmasq. O OPNsense 26.x migrou o Kea como serviço DHCP padrão. Decidi manter e adaptar: configurei tudo no Kea e adicionei uma task no final pra desativar o Dnsmasq completamente, deixando só um serviço ativo.

Outra adaptação: as VLANs no OPNsense são referenciadas internamente por identificadores (`opt1`, `opt2`, `opt3`), não pelos nomes que você define na interface. As regras de firewall e a configuração de DHCP precisam usar esses identificadores. Tive que mapear manualmente no loop:

```
- { friendly_name: 'iot', internal_iface: 'opt1', source_net: '10.10.20.0/24', ... }
```

No `setup_cudy_ap.yml` o problema foi diferente: o OpenWrt não tem Python instalado por padrão. O módulo `shell` do Ansible depende de Python no host remoto. Troquei todas as tasks de `shell` pra `raw`, que executa comandos diretamente via SSH sem precisar de interpreter.

O último bug foi nos SSIDs. A versão inicial usava `uci add wireless wifi-iface` — que cria entradas anônimas sem nome. Quando o Ansible tentava verificar se o SSID já existia na segunda execução, não encontrava pelo nome e criava duplicata. A solução foi usar `uci set wireless.wifinet_trusted=wifi-iface` com nome explícito, tornando a operação idempotente por padrão.

Após todos esses ajustes:

```bash
ansible-playbook -i ansible/hosts.ini ansible/playbooks/setup_opnsense.yml --ask-vault-pass
ansible-playbook -i ansible/hosts.ini ansible/playbooks/setup_ap.yml --ask-vault-pass
```

Tudo verde.

##  O que ficou pronto

Bancada funcionando com IaC validado end-to-end:

- OPNsense roteando e aplicando firewall stateful entre VLANs
- Switch distribuindo as VLANs via trunk nas portas corretas
- AP transmitindo trusted e iot em SSIDs separados, cada um entregando IP da subnet certa
- DHCP respondendo corretamente em cada VLAN via Kea
- IPs estáticos reservados pra switch, AP e workstation
- Internet funcionando via double NAT do ISP
- Playbooks idempotentes — podem rodar múltiplas vezes sem efeitos colaterais

O próximo passo é plugar o Omada EAP650 na porta 8 do switch, adicionar os SSIDs de guest e lab, e migrar os dispositivos da rede atual. Depois disso, Unbound DNS pra resolução interna dos subdomínios do homelab e Tailscale no OPNsense.

O código está no [homelab-network](https://github.com/luisbrancher/homelab-network).
