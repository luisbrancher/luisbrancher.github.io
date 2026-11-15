---
title: "Reformulando meu homelab #07: NAS dedicado, GitOps no ar e a primeira experiência com Kubernetes e ArgoCD"
description: "Configurando um TrueNAS dedicado do zero e executando o primeiro deploy real do homelab-gitops: ArgoCD, Nextcloud, Immich e Jellyfin, com todos os erros no caminho."
date: 2026-07-07
readingTime: 12
tags: ["HOMELAB", "TRUENAS", "ARGOCD", "GITOPS", "TROUBLESHOOTING"]
repo: "https://github.com/luisbrancher/homelab-gitops"
repos: ["https://github.com/luisbrancher/homelab-gitops", "https://github.com/luisbrancher/homelab-infra"]
translationKey: "homelab-07-truenas-gitops"
---
Fazia um tempo que eu sabia que o storage do homelab precisava de uma solução melhor. Eu tinha uma VM `storage-server` rodando dentro do próprio Proxmox, com um disco SATA passado via passthrough, exportando NFS pros outros serviços. Funcionava, mas era gambiarra: storage rodando no mesmo hardware que o cluster, ocupando recursos de CPU e RAM, a única redundância que tinha era um backup em um HD externo e sem interface decente pra gerenciar.

A solução chegou na forma de um Lenovo V50s que encontrei barato na OLX: i3-10100, 8GB de RAM, slot PCIe livre. Virou o NAS dedicado. E com o NAS novo configurado, finalmente tinha o ambiente certo pra fazer o primeiro deploy real do `homelab-gitops`, o repositório que venho construindo há alguns meses e que nunca tinha rodado de verdade num cluster.

Esse post cobre as duas frentes: configurar o TrueNAS do zero no V50s e executar o primeiro deploy do ArgoCD com Nextcloud, Immich e Jellyfin. Com todos os erros no caminho.

##  O hardware do NAS

O plano era colocar quatro discos: dois SSDs de 1TB pra dados ativos e dois HDDs de 1TB pra backup. Comprei uma placa PCIe SATA (ASM1166) pra ter portas suficientes, e uma placa de rede 2.5GbE que já tinha por aqui pra ter mais banda no NFS.

Aqui já apareceu o primeiro problema: as duas placas PCIe juntas não funcionavam. O sistema reconhecia uma ou outra, nunca as duas ao mesmo tempo. Limitação do barramento PCIe do V50s. Tive que escolher: ficou o SATA card, perdeu a 2.5GbE. Por enquanto o NAS roda com a NIC onboard de 1GbE, pra resolver depois com um adaptador M.2 de rede.

##  TrueNAS 25.10

Instalei o TrueNAS 25.10 no M.2 dedicado do V50s. A instalação em si não tem muito segredo, mas tem alguns detalhes de BIOS que fazem diferença:

- **Secure Boot**: desabilitado, o TrueNAS não passa pelo boot com ele ativo
- **Wake on LAN**: habilitado, útil pra ligar o NAS remotamente
- **Power on after AC loss**: habilitado como Power ON, se cair a luz o NAS volta sozinho

Depois do boot inicial configurei o IP fixo `10.10.10.15` e habilitei SSH. Uma coisa que aprendi rápido: o filesystem root do TrueNAS é read-only. Não dá pra instalar software via script shell. O Tailscale, por exemplo, precisou ser instalado via **Apps → Discover → Tailscale** pela UI, não pelo `curl | sh` que uso no Ansible.

### Pools e datasets

Criei dois pools ZFS stripe: `data-ssd` com os dois SSDs e `backup-hdd` com os dois HDDs. Stripe sem redundância: se um disco falhar, o pool inteiro é perdido. Sei do risco e aceito conscientemente porque tenho replicação automática entre os pools.

Dentro do `data-ssd` criei os datasets por serviço: `nextcloud`, `immich`, `jellyfin`. Cada um virou um NFS share. E configurei uma Periodic Snapshot Task de 24h com retenção de duas semanas mais uma Replication Task que copia tudo do `data-ssd` pra o `backup-hdd` automaticamente depois de cada snapshot.

### Ajustes no homelab-infra

Com o NAS novo, o `storage-server` deixou de existir. Removi a VM do Terraform (`terraform state rm` antes de deletar o código), tirei do inventário do Ansible e atualizei as variáveis que apontavam para os paths antigos. O `nfs_server` no `vars.yml` passou a apontar para o TrueNAS em vez da VM.

Dois bugs apareceram nos serviços que dependiam do NFS antigo. O MotionEye no Pi4 parava de subir depois de reboot porque o diretório `/run/motioneye` é efêmero e sumia. Fix: adicionar `RuntimeDirectory=motioneye` no service do systemd via Ansible. O UpSnap reclamava de permissão no mount NFS porque o NFS exportava com `root_squash` por padrão, convertendo root do cliente para `nobody`. Fix: `chmod 777` no dataset pelo TrueNAS como root e `no_root_squash` nas opções de export.

##  Primeiro deploy do homelab-gitops

Com o NAS no ar e os paths atualizados no `homelab-gitops`, era hora de rodar de verdade o que eu tinha escrito nos últimos meses. A sequência do README parecia simples, mas na prática, levei várias horas debugando.

### Os primeiros dois passos

```bash
kubectl apply -f bootstrap/namespaces.yml
kubectl apply -f bootstrap/argocd-app-of-apps.yml
```

Isso foi tranquilo. Os namespaces foram criados, o App of Apps registrou e o ArgoCD começou a puxar os `Application` objects do diretório `apps/`. Em segundos os cinco apps apareceram no watch: `cert-manager`, `cnpg-operator`, `nextcloud`, `immich`, `jellyfin`. Todos `Progressing`.

### cnpg-operator OutOfSync

O primeiro problema foi o `cnpg-operator` travando em `OutOfSync` depois de alguns minutos. O erro no `kubectl describe`:

```
CustomResourceDefinition "clusters.postgresql.cnpg.io" is invalid:
metadata.annotations: Too long: may not be more than 262144 bytes
```

Os CRDs do CNPG são grandes demais pra caber na annotation `last-applied-configuration` que o kubectl usa por padrão — é um problema conhecido que descobri pesquisando. O fix é adicionar `ServerSideApply=true` nos syncOptions do `apps/cnpg-operator.yml` e sincronizar via UI do ArgoCD (Sync → Server-Side Apply, sem marcar Force, porque `--force` e `--server-side` são mutuamente exclusivos). Após alguns minutos o operator subiu e virou `Synced/Healthy`.

### PVCs que não bindavam

Com os namespaces criados, apliquei os PVCs:

```bash
kubectl apply -f charts/nextcloud/pvc.yml
kubectl apply -f charts/immich/pvc.yml
kubectl apply -f charts/jellyfin/pvc.yml
```

Dois ficaram em `Pending`. O `immich-pvc` pedia 200Gi mas o PV tinha capacidade de 100Gi declarada. Kubernetes não binda quando o PVC pede mais do que o PV oferece. Fix simples: corrigir o PVC pra 100Gi.

O `jellyfin-media-pvc` não tinha `storageClassName: ""` no manifest, então herdava o StorageClass padrão do cluster (`local-path`) em vez de binder com o PV que tinha campo vazio explícito. Fix: adicionar o campo no PVC.

### A morte das imagens Bitnami

O Nextcloud no Helm usa um subchart do PostgreSQL da Bitnami. O problema: as imagens `bitnami/postgresql` com tags nominais como `16-debian-12` não existem mais no Docker Hub. A Bitnami migrou pra um modelo de imagens pagas. O cluster ficava em `ImagePullBackOff` sem saída.

A solução foi mover o banco do Nextcloud também pro CNPG, igual ao Immich. Criei um `charts/nextcloud/postgres-cluster.yml` com um Cluster CNPG, desabilitei o subchart da Bitnami no `values.yml` e ativei o `externalDatabase` apontando pro service do CNPG.

Mas o chart do Nextcloud sempre gera um init container que tenta resolver o host `nextcloud-postgresql` antes de iniciar, independente de você ter habilitado banco externo ou não. A solução foi criar um Service `ExternalName` que redireciona esse nome pro CNPG:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nextcloud-postgresql
  namespace: nextcloud
spec:
  type: ExternalName
  externalName: nextcloud-postgres-rw.nextcloud.svc.cluster.local
```

### Imagem do Postgres do Immich incompatível com o CNPG

O `postgres-cluster.yml` do Immich estava usando `ghcr.io/immich-app/postgres:17-vectorchord0.4.3-pgvectors0.4.0`. Dois problemas: a tag não existia mais, e a imagem do Immich não tem o UID 26 que o operator CNPG exige pra inicializar o banco.

A solução foi trocar pela imagem `ghcr.io/tensorchord/cloudnative-vectorchord:17-0.3.0`, que é construída especificamente pra rodar com CNPG e já tem os UIDs corretos e as extensões vectorchord disponíveis.

Mesmo com a imagem certa, as extensões precisaram ser criadas manualmente como superuser depois do banco subir, porque o usuário `immich` não tem permissão pra isso:

```bash
kubectl exec -it immich-postgres-1 -n immich -- psql -U postgres -d immich -c "CREATE EXTENSION IF NOT EXISTS vchord CASCADE;"
kubectl exec -it immich-postgres-1 -n immich -- psql -U postgres -d immich -c "CREATE EXTENSION IF NOT EXISTS cube CASCADE;"
kubectl exec -it immich-postgres-1 -n immich -- psql -U postgres -d immich -c "CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;"
```

### NFS com root\_squash bloqueando tudo

O Immich subiu, conectou no banco, rodou as migrations e então:

```
Failed to create /data/encoded-video/.immich: Error: EACCES: permission denied
```

O Jellyfin:

```
Access to the path '/config/log' is denied.
```

Mesmo problema do UpSnap no Pi4. O TrueNAS exporta NFS com `root_squash` ativo por padrão, que mapeia UID 0 para `nobody`. Os pods rodavam como root, o TrueNAS bloqueava a escrita. Fix: nos NFS shares de cada serviço no TrueNAS, configurar **Maproot User: root** e **Maproot Group: root**. Após isso, restart dos pods e tudo passou a escrever normalmente.

### bjw-s common library e as env vars ignoradas

O chart do Immich usa a biblioteca `bjw-s common library`. Eu tinha as variáveis de ambiente no nível raiz do `values.yml`:

```
env:
  DB_HOSTNAME: immich-postgres-rw
```

Essas variáveis simplesmente eram ignoradas. O servidor subia tentando conectar num host chamado `database`, que é o default hardcoded. A estrutura correta pro bjw-s é:

```
controllers:
  main:
    containers:
      main:
        env:
          DB_HOSTNAME: immich-postgres-rw
```

Depois desse ajuste o servidor conectou no banco pela primeira vez.

### Nextcloud derrubado pelo liveness probe

Na primeira inicialização, o Nextcloud precisa criar todas as tabelas do banco. Isso leva mais tempo do que o default do liveness probe. O Kubernetes matava o container antes de terminar a inicialização, o pod entrava em `CrashLoopBackOff` e nunca conseguia terminar o setup.

Fix: aumentar o `initialDelaySeconds` pra 120 e o `failureThreshold` pra 10 nos probes do Nextcloud. Na próxima tentativa o container subiu e o Nextcloud inicializou corretamente.

##  TLS e DNS

Com todos os serviços `Healthy`, faltava acesso externo. O `ClusterIssuer` do cert-manager estava criado mas os challenges ficaram travados em `pending` por horas. O motivo: criei o `ClusterIssuer` antes de criar o secret `cloudflare-api-token`. O cert-manager não conseguia autenticar na Cloudflare pra criar o registro TXT de validação.

Fix: criar o secret e deletar os challenges antigos pra forçar reemissão:

```bash
kubectl delete challenge -n nextcloud nextcloud-tls-1-...
kubectl delete challenge -n immich immich-tls-1-...
kubectl delete challenge -n jellyfin jellyfin-tls-1-...
```

Em alguns minutos os três certificados viraram `Ready: True`.

Para o DNS, criei registros A na Cloudflare apontando pra o IP Tailscale do k3s-node, todos com proxy desabilitado (DNS only). O IP Tailscale não é roteável publicamente, então na prática só quem está na minha rede Tailscale consegue acessar, mesmo que o nome resolva pra qualquer um que consulte o DNS.

O último detalhe foi o MagicDNS do Tailscale interceptando as consultas DNS. Ativando **Override DNS servers** no painel do Tailscale com o Cloudflare como global nameserver, o problema sumiu e os três domínios passaram a resolver corretamente.

##  Estado final

| App | Status | Endereço |
| --- | --- | --- |
| `cert-manager` | Synced / Healthy | — |
| `cnpg-operator` | Synced / Healthy | — |
| `nextcloud` | Synced / Healthy | nextcloud.homelab.luisbrancher.dev |
| `immich` | Synced / Healthy | immich.homelab.luisbrancher.dev |
| `jellyfin` | Synced / Healthy | jellyfin.homelab.luisbrancher.dev |

TLS emitido via Let's Encrypt pra todos os três. Acesso via Tailscale de qualquer dispositivo na minha rede.

##  O que ficou pendente

Nem tudo fechou nessa sessão. O `immich-nextcloud-photos-pvc` está criado e bound, mas ainda não montado no pod do Immich. Falta adicionar `extraVolumes` e `extraVolumeMounts` no `values.yml` e configurar o path como External Library na UI. O Jellyfin também está no ar mas sem conteúdo: os arquivos de mídia precisam ser enviados via SFTP pro `/mnt/media` no k3s-node, que é onde o `hostPath` PVC aponta.

São os próximos passos. Por enquanto, o que importa é que saí de zero pra tudo healthy em um cluster real, com storage dedicado, TLS automático e GitOps funcionando. Qualquer mudança de configuração agora é um git push.

O código está no [homelab-gitops](https://github.com/luisbrancher/homelab-gitops) e a infraestrutura no [homelab-infra](https://github.com/luisbrancher/homelab-infra).
