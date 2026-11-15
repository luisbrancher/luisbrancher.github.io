---
title: "Quatro meses rodando: o que mudei na mão e o que uma revisão encontrou"
description: "Depois de quatro meses usando o homelab, levantei o que mudei na mão e pedi uma revisão dos três repos antes de começar a observabilidade: bancos sem backup, brechas no firewall e playbooks arriscados."
date: 2026-11-02
readingTime: 5
tags: ["HOMELAB", "REVISÃO", "BACKUP", "OBSERVABILIDADE", "TERRAFORM", "ANSIBLE"]
repo: "https://github.com/luisbrancher/homelab-network"
repos: ["https://github.com/luisbrancher/homelab-network", "https://github.com/luisbrancher/homelab-infra", "https://github.com/luisbrancher/homelab-gitops"]
translationKey: "revisando-homelab"
---
O último post da série [Reformulando meu homelab](../homelab-07-truenas-gitops/) terminou no fim de junho, com o NAS novo e o primeiro deploy real do `homelab-gitops`: Nextcloud, Immich e Jellyfin no ar, gerenciados pelo ArgoCD. A partir dali parei de construir e passei a usar.

Usar é outra coisa. Em quatro meses, o que estava no código e o que estava rodando foram se afastando um pouco, sempre por um bom motivo na hora.

##  O que mudou na mão

O problema mais chato foi a placa de rede do host Proxmox. Com bastante tráfego, ela travava e levava o servidor junto para um freeze. No começo, eu nem desconfiava dela. Subi a VM do k3s de 8 para 16 vCPUs para testar se era falta de CPU, e não era. A causa real era a placa: a correção foi desligar os offloads e passar o processamento de pacotes para a CPU. Parou de travar.

Os 16 vCPUs ficaram lá. O i5-13500T do M80q tem 20 threads, então não chega a estourar, mas também não tinha motivo nenhum além de eu ter esquecido de voltar. Até atualizei o Terraform para bater com o que fiz na mão, em vez de desfazer.

O Jellyfin ganhou um SSD dedicado. Baixar, assistir e apagar no disco do SO não fazia sentido, então a mídia foi para um disco só dela. Essa troca também teve correção manual: o playbook apontava para o disco errado, e a máquina só ficou certa porque arrumei o fstab na mão, duas vezes. A segunda foi depois de uma queda de energia.

E o M80q foi de 16GB para 32GB de RAM, porque com tudo rodando ele já estava apertado. Tenho rodado algumas VMs de teste nele também.

Nada disso é absurdo. Cada mudança resolveu um problema real. Só que o `/etc/network/interfaces` do Proxmox não está em nenhum repo, e se eu reinstalasse o host amanhã, o freeze voltaria. Fui acumulando esse tipo de coisa sem uma lista.

##  O internship mudou a prioridade

Aí comecei um internship em DevOps com foco em observabilidade. Quero praticar em casa o que estou estudando, com Prometheus, Loki, Alertmanager e Alloy em cima do homelab. A LXC de monitoramento até existe, mas está meio vazia: o Loki está no ar e nada manda log para ele.

Antes de colocar mais carga em cima, quis saber o que estava frágil. E tinha um problema: quem ia olhar era a mesma pessoa que montou tudo, com as mesmas premissas e os mesmos pontos cegos.

Então pedi ao Claude Opus para ler os três repos (`homelab-network`, `homelab-infra` e `homelab-gitops`) e me apontar os problemas. Só leitura, sem mudar nada. Também conferimos o histórico do git atrás de segredo vazado, e os `vault.yml` estão criptografados desde o primeiro commit, o que era esperado, visto que sempre dei um foco para o lado da segurança.

O resto foi menos tranquilo.

##  O que apareceu

Alguns exemplos:

- Guest e IoT conseguiam abrir a interface e o SSH do OPNsense, porque o bloqueio cobria as outras VLANs, mas não o IP do próprio gateway.
- Os bancos Postgres do Immich e do Nextcloud não tinham backup nenhum. As fotos estão no NAS, mas álbuns, rostos e metadados estão no banco, em disco local da VM. Nada vital, mas facilita um restore futuro.
- Rodar o playbook do OPNsense para mudar uma reserva DHCP podia atualizar e reiniciar o roteador.
- Rodar de novo o playbook do access point apagava uma zona do firewall, a que estivesse no índice 1 naquela hora.
- O NAS tem os dois pools em stripe, sem redundância. Isso foi escolha minha e continua sendo, mas eu não tinha SMART agendado nem alerta nenhum. E a cópia de backup ficava na mesma caixa.

Teve coisa que eu sabia e tinha empurrado, teve coisa que me surpreendeu. O que mais me pegou foi o firewall: Guest e IoT chegarem na interface e no SSH do OPNsense é a falha de segurança mais grave da lista. O banco também me surpreendeu: eu tinha snapshot, replicação entre pools, e achava que isso era backup de tudo.

##  Como organizei

Junto com os achados, respondi uma lista de perguntas abertas, porque algumas respostas mudavam a prioridade. O AP Cudy ainda estava em produção? Por que 16 vCPUs? Isso trouxe à tona coisa que só eu sabia, como a história da placa de rede.

O resultado virou um documento de revisão com três níveis:

| Nível | O que é | Exemplos |
| --- | --- | --- |
| Sério | Pode causar perda de dados ou exposição | Firewall, banco sem backup, disco de mídia |
| Importante | Vai cobrar a conta, mas não hoje | Versões flutuantes, segredos só no cluster, IPs fora do código |
| Melhoria | Faria diferente, sem urgência | Redis no Nextcloud, roles no Ansible, QSV no Jellyfin |

A gravidade diz o que é pior, mas não diz em que ordem atacar. Para isso dividi em fases, tomando o internship como referência:

- **Fase 1:** fechar os críticos antes da observabilidade, mais o que evita retrabalho depois.
- **Fase 2:** observabilidade, já com os alertas de backup incluídos.
- **Fase 3:** o resto, como fixar versões, cuidar de segredos e levar o que falta para o GitOps.

A ordem dentro da fase também importa. Um exemplo: separar o upgrade do OPNsense precisava vir antes de mexer no firewall por código, porque aplicar o playbook ainda podia reiniciar o roteador.

Também marquei cada ação como `[código]`, `[console]` ou `[ambos]`. O que for feito na interface tem o valor exato anotado na hora. É a regra para não repetir o que aconteceu com a placa de rede.

##  O que eu já queria fazer

Nem tudo saiu da revisão. Eu já tinha uma lista de coisas que queria fazer, e entrou junto:

- Trocar `homelab.luisbrancher.dev` por um domínio próprio, o `lflab.cc`, antes da observabilidade, para probes e dashboards já nascerem com os nomes finais.
- Uma página simples, `all.lflab.cc`, com o link de tudo. Hoje eu vivo procurando IP e porta.
- Trocar as placas de rede do Proxmox e do TrueNAS por M.2 2.5G. Aproveito e migro do AP Cudy para o Omada, que já está esperando.
- Um HD externo de 8TB para mais uma cópia dos dados.
- Um nobreak, que já comprei. As quedas de energia foram parte de vários problemas aqui.

Colocar tudo no mesmo documento ajudou a ver que algumas coisas dependiam umas das outras. A troca de placa, por exemplo, muda os MACs, e os IPs dependem de reservas DHCP que nem estão no código.

##  O que ficou disso

Antes de mudar uma linha, já tinha tirado duas coisas dessa revisão. A primeira é que "está funcionando" dizia bem pouco sobre o meu homelab. Os bancos passaram quatro meses sem backup, e nada reclamou em nenhum momento.

A segunda é que uma revisão dessas só enxerga o que está escrito. O README ainda dizia que o host era um i5-1345U, o processador de um mini PC que queimou antes de eu comprar o M80q, e o Claude apontou os 16 vCPUs como mais do que o total de threads. O i5-13500T tem 20. Só fui pegar isso bem depois, relendo o texto. O olhar de fora ajudou bastante, mas conferir continua sendo comigo.

O próximo passo é percorrer a fase 1 item por item, com diff e `--check` antes de aplicar, e anotando o que for feito na interface. A observabilidade começa depois disso.
