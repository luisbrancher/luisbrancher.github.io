---
title: "De um Raspberry Pi com HD velho a um servidor completo em casa"
description: "Como uma tentativa de ter armazenamento em nuvem gratuito evoluiu para um laboratório completo de redes e segurança, motivando minha transição para DevOps."
date: 2026-02-10
readingTime: 5
tags: ["Homelab", "Linux", "Career Journey"]
translationKey: "jornada"
---
Tudo começou com uma mistura de curiosidade e avareza. Eu queria mais espaço em nuvem, mas não queria pagar por isso.

Eu tinha alguns HDs antigos parados e comecei a pesquisar como poderia acessá-los pela internet direto de casa. Já tinha uma noção básica de rede — lá por 2000 eu abria portas no roteador pra jogar CS com amigos — então esse foi meu primeiro instinto.

Só que pesquisando melhor, descobri que esse modelo de simplesmente expor portas já não era a melhor prática. Foi aí que entrei no mundo de VPNs, e a partir disso acabei caindo num buraco bem mais fundo: homelab.

##  O começo: Raspberry Pi e primeiras tentativas

Eu já tinha um certo conhecimento de hardware por causa do meu trabalho como editor de vídeo. Sofri bastante com máquinas ruins ao longo dos anos, então fui obrigado a aprender na prática sobre CPU, GPU, RAM e como cada peça impacta performance.

Também tinha um Raspberry Pi 4 parado na gaveta (que comprei no passado pra emulação), então resolvi usar ele como ponto de partida.

- conectei os HDs nele
- comecei com Raspberry OS
- acesso apenas via LAN

Depois tentei subir um Ubuntu Server, mas travei na CLI. Ainda não tinha base suficiente.

Acabei indo para o OMV (OpenMediaVault), que foi o primeiro setup que realmente funcionou como NAS.

Cheguei até a configurar Tailscale nele, mas na prática eu não usava como “nuvem” ainda — era mais um storage local com backup na rede. Também comecei a brincar com coisas como Pi-hole.

##  O ponto de virada: interesse real em infra

Esse foi o ponto de entrada. A partir daí comecei a estudar mais por conta própria:

- redes
- comunicação entre máquinas
- segurança e privacidade
- ferramentas open source

Foi justamente quando comecei a mergulhar no mundo open source que passei a pegar gosto de verdade por Linux e linha de comando. No começo eu travava fácil, hoje já me sinto muito mais confortável navegando, debugando e entendendo o que está acontecendo no sistema.

Uma coisa foi puxando a outra. Comecei a fazer cursos, estudar cibersegurança e entender melhor o que estava fazendo — não só copiar tutorial.

Com isso vieram novos experimentos:

- Wazuh (SIEM)
- Suricata (IDS/IPS)
- hardening de dispositivos
- testes com VMs (VirtualBox / VMware)
- labs de pentest e SOC

Nesse ponto, o Raspberry já não dava mais conta.

##  Upgrade: servidor dedicado com hardware reaproveitado

Em um upgrade da minha workstation de trabalho, aproveitei as peças antigas e montei meu servidor atual. Hoje ele roda com:

- Ryzen 7 5800X
- 16GB RAM
- GT 1030

Inicialmente voltei para Ubuntu Server e subi tudo manualmente (Wazuh + outros serviços), mas depois de algumas quebras e perder dias em troubleshooting, percebi que estava gastando mais tempo mantendo do que aprendendo.

Foi aí que decidi simplificar e migrar para o ZimaOS.

##  Setup atual

Hoje o servidor roda:

- **ZimaOS** como base
- **Immich** → nuvem pessoal de fotos
- **Jellyfin** → media server
- **Zima (NAS)** → arquivos
- **Tailscale** → acesso remoto via VPN
- **UpSnap** → Wake-on-LAN remoto
- **MotionEye** → monitoramento da câmera IP

Além disso:

- uso como subnet router no Tailscale
- uso como exit node para acessar minha rede do Brasil

E continuo usando VMs pra testar coisas novas antes de levar pro servidor.

##  O que mudou na prática

O projeto começou só como “quero mais armazenamento sem pagar”. Virou:

- ambiente de aprendizado real
- laboratório de redes e segurança
- base pra estudar infraestrutura
- e hoje influencia diretamente minha transição de carreira

###  Conclusão

Não foi um caminho linear. Teve:

- tentativa que não funcionou
- quebra de sistema
- tempo perdido debugando coisa errada

Mas foi justamente isso que fez eu entender o que estava fazendo. Hoje o servidor resolve problemas reais pra mim (backup, acesso remoto, mídia, etc.) e ao mesmo tempo virou meu principal laboratório.

E foi esse processo que me fez migrar o interesse de edição de vídeo para infraestrutura e DevOps.
