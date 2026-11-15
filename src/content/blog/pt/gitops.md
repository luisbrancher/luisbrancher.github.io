---
title: "Reformulando meu homelab #03: GitOps com ArgoCD e planejamento de código"
description: "Como estruturei o repositório e o cluster com ArgoCD para gerenciar todo o homelab de forma declarativa e automatizada."
date: 2026-04-20
readingTime: 7
tags: ["GITOPS", "ARGOCD", "KUBERNETES", "IAC", "HOMELAB"]
repo: "https://github.com/luisbrancher/homelab-gitops"
translationKey: "gitops"
---
Quando decidi reconstruir meu homelab do zero com IaC, o objetivo era claro: nada de SSH pra subir serviço, nada de "deixa eu lembrar o que eu rodei aqui". Terraform pra provisionar as VMs no Proxmox, Ansible pra configurar o sistema operacional, k3s pra orquestrar os containers e ArgoCD pra fechar o ciclo. Tudo declarativo, tudo no git.

Essa última parte, o ArgoCD, foi onde eu passei mais tempo pensando antes de escrever qualquer código. Como foi minha primeira experiência com esse tipo de ferramenta, precisei entender um pouco sobre estrutura de arquivos e como organizar para tudo rodar certinho.

Como estou em viagem, estou escrevendo toda parte de IaC para deixar meu novo homelab pronto pra quando chegar em casa, para apenas instalar o bootstrap e rodar os comandos. Já tenho post aqui sobre o hardware e como usei terraform para provisionar ([aqui](../novo-homelab-01/)). Toda a parte de configuração do Ansible ([aqui](../novo-homelab-02/)). Nesse artigo, explico como configurar o k3s com ArgoCD e, quando retornar pra casa, provavelmente farei um post/vídeo rodando os códigos e fazendo o troubleshooting.

##  O problema que o ArgoCD resolve

Depois que o Ansible termina o trabalho e o k3s sobe, você tem um cluster funcional, mas vazio. A dúvida honesta é: como coloco meus serviços lá de um jeito que eu consiga reproduzir e entender daqui a seis meses?

Eu poderia usar `helm install` via linha de comando, mas seria apenas trocar um "docker manual" por um "kubernetes manual". Eu queria um estado declarativo real. Se o cluster explodir amanhã, não quero ter que lembrar de nada.

Com GitOps, você inverte a lógica: em vez de você empurrar as mudanças para o cluster, você declara como quer que as coisas sejam no Git e o ArgoCD se vira para garantir que o cluster reflita isso. A fonte da verdade sai do terminal e vai para o repositório.

Na prática: git push atualiza o serviço. Deu erro? Reverte o commit e o serviço volta ao estado anterior. Quer saber o que tem rodando? Basta olhar o repositório.

##  App of Apps: gerenciando o gerenciador

O ArgoCD trabalha com um objeto chamado `Application`: cada um representa um serviço e diz de onde vem o chart, como configurar e onde instalar. Mas quem cria essas `Application` objects?

Se você cria manualmente, perde parte do benefício. A solução é o padrão **App of Apps**: uma `Application` especial que aponta pro diretório `apps/` do repositório. O ArgoCD monitora esse diretório e qualquer arquivo `.yaml` que aparecer lá vira automaticamente um novo serviço gerenciado.

Você aplica esse bootstrap **uma única vez**, manualmente:

```bash
kubectl apply -f bootstrap/argocd-app-of-apps.yaml
```

Depois disso, adicionar um novo serviço é só criar `apps/novo-servico.yaml` e dar `git push`. O ArgoCD detecta e sincroniza.

Essa foi uma das coisas que mais clicou pra mim durante o processo. A elegância está em ter um único ponto de entrada que desdobra todo o resto.

##  A estrutura final

Depois de bastante iteração, o repositório `homelab-gitops` ficou assim:

```
homelab-gitops/
├── bootstrap/          # aplicado uma vez, manualmente
├── apps/               # ArgoCD monitora esse diretório
├── charts/             # values.yaml + PVCs por serviço
└── config/             # configurações que não são serviços
    └── cert-manager/
```

Cada serviço tem sua pasta em `charts/` com dois arquivos: `values.yaml` pra configurar o Helm chart e `pvc.yaml` pra declarar o storage. O `apps/` tem só os manifests do ArgoCD, leves, sem configuração de negócio.

A separação parece óbvia depois de pronta, mas levou um tempo pra entender por que ela existe. O `apps/nextcloud.yaml` responde "como fazer o deploy". O `charts/nextcloud/values.yaml` responde "como o Nextcloud deve se comportar". São responsabilidades diferentes.

##  Dúvidas reais que tive

**Um Helm release por serviço?**

Sim. A tentação de agrupar serviços relacionados num release só é real, mas o isolamento compensa. Falha no Immich não afeta o Nextcloud. Rollback granular. Diff limpo no git. Vale a verbosidade.

**.yaml ou .yml?**

Zero diferença técnica. A convenção do ecossistema Kubernetes é `.yaml`, então é isso.

**Todo arquivo YAML começa com ---?**

Não é obrigatório em arquivo com um único documento, mas é boa prática. Em arquivos com múltiplos recursos — como o `pvc.yaml` que tem PV e PVC juntos, o `---` separando cada objeto é obrigatório. Usar em todos os arquivos resolve o problema de ter que pensar caso a caso.

**Onde vai o API token da Cloudflare?**

Essa foi a que mais gerou dúvida. A resposta é: nunca no git. O `ClusterIssuer` do cert-manager só referencia o nome de um Secret, o valor real você aplica via CLI:

```bash
kubectl create secret generic cloudflare-api-token \
  --namespace cert-manager \
  --from-literal=api-token=SEU_TOKEN
```

O mesmo vale pra credenciais do Nextcloud, Immich, qualquer coisa sensível. O arquivo que fica no repo é um placeholder documentando a estrutura do Secret, sem nenhum valor real.

No futuro isso evolui pra SOPS: você encripta o arquivo antes de commitar e aí sim pode versionar. Mas por enquanto, CLI resolve e é honesto com o estágio atual do projeto.

**O cert-manager sabe que a configuração está em config/cert-manager/?**

Não automaticamente. O ArgoCD só monitora `apps/`. O `ClusterIssuer` e o Secret da Cloudflare você aplica manualmente — igual ao bootstrap. É uma exceção justificada: são recursos que você configura uma vez e raramente muda.

##  A ordem importa

Uma coisa que aprendi: a ordem de deploy não é trivial quando os serviços têm dependências.

O cert-manager precisa estar healthy antes de criar o `ClusterIssuer`. O `ClusterIssuer` precisa existir antes de qualquer Ingress com a annotation `cert-manager.io/cluster-issuer`. Os PVCs precisam existir antes dos pods que os montam.

A sequência que funcionou:

```
namespaces → App of Apps → cert-manager healthy
→ PVCs → ClusterIssuer → Secrets
→ git push dos outros serviços
```

O ArgoCD tem um mecanismo chamado **sync waves** pra automatizar essa ordenação — uma annotation que define em que "onda" cada recurso deve ser criado. É o próximo passo natural, mas não é necessário pra começar.

##  O que fica de fora do repo

Três categorias de coisas que não vão no `homelab-gitops`:

- **Secrets** — valores sensíveis sempre via CLI
- **Infraestrutura** — VMs, rede, storage físico ficam no `homelab-infra` (Terraform + Ansible)
- **Configuração de aplicação** — a External Library do Immich apontando pro diretório de fotos do Nextcloud, por exemplo, você configura pela UI. Não tem como declarar isso em YAML.

Essa última categoria me incomodou no começo. Parece que quebra o "tudo declarativo". Mas faz sentido aceitar: GitOps gerencia o estado da infraestrutura do cluster, não o estado interno da aplicação.

##  O que vem depois

O repo está funcional, mas tem espaço pra evoluir:

- **SOPS** pra encriptar secrets e versionar com segurança
- **Sync waves** pra automatizar a ordem de deploy
- **External Secrets Operator** pra buscar secrets de um vault externo
- **Staging environment** — um namespace separado pra testar mudanças antes de aplicar em produção

Nenhum disso é necessário agora. O que existe já é um GitOps real: estado declarado no git, reconciliação automática, histórico completo de mudanças.

Se o cluster morrer amanhã, eu sei exatamente o que precisa rodar pra voltar. E isso, no fim, era o objetivo.

### 💡 Resumo

O repositório do cluster está aberto em [github.com/luisbrancher/homelab-gitops](https://github.com/luisbrancher/homelab-gitops). A infraestrutura que provisiona o cluster desde o bare metal está detalhada no repositório [homelab-infra](https://github.com/luisbrancher/homelab-infra).
