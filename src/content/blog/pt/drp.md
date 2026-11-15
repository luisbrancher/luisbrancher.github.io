---
title: "Recuperação de Desastre e Resiliência de Rede a 10.000km"
description: "Como restabeleci o acesso ao meu servidor principal que havia desaparecido do Tailscale após uma queda de energia usando IPv6 e estratégias de resiliência."
date: 2026-03-24
readingTime: 6
tags: ["Disaster Recovery", "Networking", "Troubleshooting"]
translationKey: "drp"
---
Estou viajando por 3 meses por diferentes países. Antes de sair, configurei meu servidor em casa como uma espécie de embaixada digital: acesso remoto aos meus serviços, exit node no Brasil via Tailscale para quando precisar de um IP brasileiro, e RustDesk na workstation como ponto de entrada alternativo na LAN. A ideia era ter autonomia total mesmo a 10.000km de distância.

Até que uma tempestade em Blumenau derrubou a energia no meu apartamento e meu servidor (ZimaOS / Ryzen 7 5800X) simplesmente desapareceu do Tailscale.

Mesmo com a configuração de religar automaticamente, imaginei que ele poderia não ter subido corretamente, seja por falha de hardware, problema no boot ou até algum serviço não iniciando direito (Docker / Tailscale).

Pedi para alguém ir até o local verificar. O servidor estava ligado, mas mesmo após reiniciar, o problema continuava: ele conectava rapidamente ao Tailscale e logo ficava offline de novo.

Como quem estava lá não tinha conhecimento técnico (minha mãe), pedi também para ligarem meu computador principal que está na mesma LAN. Eu estou viajando, então a ideia era usar ele como ponto de entrada. Com o PC ligado, consegui acessar via RustDesk (já deixo configurado justamente pra isso) e investigar o problema de dentro da rede.

A primeira tentativa foi acessar o servidor via IPv4 direto: sem sucesso. Porém consegui acessar via hostname (`zimaos.local`), o que já mostrava que o sistema estava rodando. Mesmo assim, não conseguia acessar o terminal via interface web nem via SSH usando IPv4. Tentei reiniciar o sistema pelo dashboard, mas não resolveu.

Resolvi então testar o ping usando o hostname:

```
C:\Users\luisf>ping zimaos.local

Pinging zimaos [fe80::739e:13e:d85e:d7ad%4] with 32 bytes of data:
Reply from fe80::739e:13e:d85e:d7ad%4: time<1ms
```

Ele respondeu com um endereço IPv6 link-local. Foi isso que permitiu seguir.

Usando esse IPv6, consegui acessar via SSH. Já dentro do servidor, rodei:

```
lfck@ZimaOS:~ ➜ $ ip addr
```

E vi que a interface estava assim:

- IPv4 fixo: 192.168.1.250
- IPv6 funcionando normalmente

Esse .250 era um IP que eu tinha configurado manualmente antes.

Pra garantir que não era algo mais superficial, testei filesystem (touch), parei serviços como Docker, mas nada mudou.

Decidi então voltar a interface para DHCP:

```
lfck@ZimaOS:~ ➜ $ sudo dhclient -v eth1
...
DHCPOFFER of 192.168.1.7 from 192.168.1.1
...
bound to 192.168.1.7
```

Ele pegou o IP 192.168.1.7, mas mesmo assim:

- não conseguia acessar via esse IP
- não tinha resposta de ping externo
- parecia que não havia roteamento de saída

Tentei forçar o gateway:

```
lfck@ZimaOS:~ ➜ $ sudo ip route replace default via 192.168.1.1 dev eth1
lfck@ZimaOS:~ ➜ $ ping -c 4 8.8.8.8
```

Sem resposta.

Foi aí que rodei:

```
lfck@ZimaOS:~ ➜ $ ip route show
```

E vi algo estranho:

```
192.168.1.0/24 dev eth1 ... src 192.168.1.7
192.168.1.0/24 dev eth1 ... src 192.168.1.250 metric 100
```

Ou seja, duas rotas para a mesma rede, com dois IPs diferentes na mesma interface.

Removi o IP antigo manualmente e reiniciei serviços principais:

```bash
sudo ip addr del 192.168.1.250/24 dev eth1
sudo systemctl restart zimaos-gateway.service
sudo systemctl restart zimaos.service
sudo iptables -F
sudo iptables -t nat -F
```

Mesmo assim, ainda não tinha conectividade externa.

Nesse ponto comecei a suspeitar que o problema não era só no servidor. Rodei um scan da rede:

```
luisf@LFckdsk:~$ sudo nmap -sn 192.168.1.0/24

Nmap scan report for 192.168.1.200
Host is up (0.00040s latency).
Nmap done: 256 IP addresses (1 host up)
```

Só minha própria máquina apareceu.

Outros dispositivos da rede (como câmera IP) estavam funcionando normalmente, mas não eram detectados no scan. Nem o próprio roteador aparecia.

Isso indicava que a rede IPv4 local estava inconsistente — provavelmente algo no roteador após a queda de energia (ARP/cache ou estado interno travado).

O ideal aqui seria reiniciar o roteador, mas eu não tinha mais ninguém no local pra fazer isso.

Como alternativa, configurei acesso via Zima Remote (túnel HTTPS) para conseguir manter controle do servidor mesmo com o Tailscale instável e também para conseguir usar o serviço de SnapUp e ‘acordar’ minha workstation e usá-la como ponto de acesso alternativo e exit-node quando necessário.

Depois disso, sem uma mudança clara que eu consiga afirmar com certeza, a rede começou a voltar ao normal:

- o Tailscale estabilizou
- o ping voltou a responder
- rodei o Nmap novamente e todos os dispositivos reapareceram

Ou seja, a rede “destravou” — possivelmente porque o roteador finalmente se recuperou ou atualizou seu estado interno. Não dá pra afirmar exatamente o que foi o gatilho.

A hipótese mais provável é que tudo começou com:

- conflito entre o IP fixo (.250) e o DHCP
- somado a um estado inconsistente do roteador após a queda de energia

Isso acabou quebrando a conectividade IPv4 local por um tempo.

Depois que tudo normalizou, restabeleci o acesso via Tailscale (incluindo subnet e exit node) e não tive mais problemas.

### 💡 Lições

- IPv6 salvou o acesso quando o IPv4 falhou
- ter um segundo ponto de entrada na LAN (RustDesk) foi essencial
- em rede doméstica, DHCP com reservation costuma ser mais confiável que IP fixo no host
- roteador de operadora pode virar o ponto mais frágil da infra
- nem todo incidente tem causa 100% comprovável, e tudo bem — o importante é isolar hipóteses coerentes e restaurar o serviço
