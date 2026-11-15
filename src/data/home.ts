// Conteúdo do site: home, CV, menu e textos do blog. Certificações, VLANs e serviços ficam em profile.ts.
// Tudo aqui vem dos posts, dos repositórios públicos e das wikis (wiki-luisbrancher e wiki-homelab).
// Fica fora: nome de produto e números do estágio, nomes de clientes, IPs e nomes de host,
// pendências de segurança.
import type { Lang } from '../lib/routes';
import type { Cert } from './profile';

type L = Record<Lang, string>;

const gh = (repo: string) => `https://github.com/luisbrancher/${repo}`;
export const repoUrl = gh;

const restoreRunbook = `${gh('homelab-gitops')}/blob/main/docs/runbooks/database-restore.md`;

/** Campos que o recrutador procura. Os que estiverem null ficam ocultos.
 *  O nível em andamento vai entre parênteses, que a página mostra mais apagado. */
export const hiring: { english: L | null; citizenship: L | null; workMode: L | null } = {
  english: { pt: 'Português nativo, inglês B2 (rumo ao C1)', en: 'Native Portuguese, English B2 (moving to C1)' },
  citizenship: { pt: 'Brasileira e italiana (UE)', en: 'Brazilian and Italian (EU)' },
  workMode: null, // ex.: { pt: 'Remoto ou híbrido em Blumenau', en: 'Remote, or hybrid in Blumenau' }
};

/** Certificados que ficam só no CV: fora do foco das vagas. */
export const certsOffFocus = ['Web Front-End Developer', 'LFEL1001: Understanding the EU Cyber Resilience Act', 'Pre Security Certificate', 'Fortinet Certified Fundamentals in Cybersecurity'];
/** Perfil público com todas as credenciais, verificáveis. */
export const credlyUrl = 'https://www.credly.com/users/luis-brancher';

/** Certificados somados aos de profile.ts na home e no CV. */
export const extraCerts: Cert[] = [
  { name: 'Fortinet FortiGate 7.6 Operator', issuer: 'Fortinet', date: '2025-08', skills: { pt: ['FortiGate', 'Firewall'], en: ['FortiGate', 'Firewall'] } },
];

export const copy = {
  pt: {
    nav: { projects: '~/projetos', incidents: '~/incidentes', method: '~/como-trabalho', homelab: '~/homelab', stack: '~/stack', career: '~/trajetoria', blog: '~/blog' },
    skip: 'Pular para o conteúdo',
    description: 'Luis Brancher, estagiário de DevOps na ZPE Systems, em Blumenau, buscando vaga júnior em DevOps, SRE ou cloud. Terraform, Ansible, Kubernetes e GitOps em repositórios públicos, com restore de backup testado e os erros documentados.',
    role: 'DevOps, SRE e Cloud',
    available: 'Buscando vaga júnior em DevOps, SRE ou cloud',
    pitch: 'Estagiário de DevOps, com foco em observabilidade. Mantenho um homelab inteiro como código, com Terraform, Ansible e GitOps, alertas no Prometheus, backup com restore testado e cada falha documentada com causa e correção. Antes, 15 anos no audiovisual, onde coordenei uma equipe de 13 pessoas.',
    cvPdf: 'Baixar CV em PDF',
    cvShort: 'CV',
    sheet: { now: 'Hoje', nowV: 'Estágio em DevOps desde set/2026', location: 'Local', proof: 'Código público', proofV: 'repositórios públicos', articles: 'artigos técnicos', lab: 'Stack', labV: 'Terraform, Ansible, Kubernetes, ArgoCD, Linux, Prometheus, Grafana, GitHub Actions, AWS', study: 'Formação', studyV: 'ADS, UniCesumar (em andamento) · Superior completo em Publicidade e Propaganda', english: 'Idiomas', citizenship: 'Cidadania', workMode: 'Modalidade' },
    projects: { title: 'Projetos', lead: 'O que construí e o que cada projeto prova. As decisões e o que ainda falta abrem em cada um.', details: 'Decisões e o que falta', decisions: 'Decisões', open: 'Em aberto', post: 'Post' },
    incidents: {
      title: 'O que já quebrou',
      lead: 'Falhas reais, inclusive as minhas, com a causa e a correção. Quando existe um registro público, a linha leva até ele.',
      symptom: 'Sintoma', cause: 'Causa', fix: 'Correção', read: 'Ler',
    },
    method: { title: 'Como trabalho', lead: 'Quatro regras que sigo no homelab e levo para o trabalho.' },
    homelab: {
      title: 'Homelab',
      lead: 'Hardware real, rede segmentada e serviços de uso diário, descritos em código. É um nó só, de uso próprio, sem tráfego externo: não é alta disponibilidade.',
      flow: 'Do bare metal ao serviço',
      vlans: 'Rede segmentada',
      machines: 'Máquinas',
      machine: 'Máquina',
      services: 'Serviços',
      inventory: 'Inventário declarado no código, não é monitoramento ao vivo.',
      name: 'Serviço', role: 'Função', host: 'Host', vlan: 'VLAN', id: 'ID', access: 'Acesso',
      diagram: 'Ver topologia completa da rede',
      source: 'Código do diagrama (D2)',
    },
    stack: {
      title: 'Stack',
      lead: 'Agrupada por área, com o lugar onde cada coisa foi usada e até onde ela vai.',
      area: 'Área', tools: 'Ferramentas', where: 'Onde usei',
    },
    career: {
      title: 'Trajetória',
      about: 'Comecei com um homelab por curiosidade e estudei cibersegurança para entender o que estava fazendo. Foi aí que me apaixonei pela infraestrutura. Hoje trato tudo como código e penso em proteção antes de subir qualquer recurso. Venho do audiovisual, onde documentação, troubleshooting e prazo apertado já faziam parte do trabalho.',
      experience: 'Experiência',
      before: 'Antes: audiovisual',
      certs: 'Certificações e cursos',
      certsMore: 'Todas as credenciais, verificáveis, no Credly',
      studying: 'Em estudo, sem prova feita: Terraform Associate (004) e Google Associate Cloud Engineer.',
      cert: 'Nome', issuer: 'Emissor', date: 'Data',
      education: 'Formação',
    },
    blog: { title: 'Blog', lead: 'Homelab, AWS e automação, escritos enquanto os problemas aconteciam.', all: 'Todos os artigos', minRead: 'min', back: 'Voltar aos artigos', home: 'Início', toc: 'Neste artigo', other: 'Read in English' },
    contact: { title: 'Tem uma vaga júnior de DevOps, SRE ou cloud?', lead: 'Respondo por email ou LinkedIn.', copy: 'Copiar email', copied: 'Copiado' },
    footer: 'Feito com Astro. Infraestrutura e deploy nos repositórios públicos.',
    theme: 'Alternar tema claro ou escuro',
    cvSummary: 'Estagiário de DevOps, com foco em observabilidade, buscando vaga júnior em DevOps, SRE ou cloud. Mantenho um homelab inteiro como código, com Terraform, Ansible, k3s e ArgoCD, alertas no Prometheus, backup com restore testado e as falhas documentadas em repositórios públicos. Antes, audiovisual desde 2010, com coordenação de uma equipe de 13 pessoas.',
    cvProjects: 'Projetos',
  },
  en: {
    nav: { projects: '~/projects', incidents: '~/incidents', method: '~/how-i-work', homelab: '~/homelab', stack: '~/stack', career: '~/career', blog: '~/blog' },
    skip: 'Skip to content',
    description: 'Luis Brancher, DevOps intern at ZPE Systems in Blumenau, Brazil, looking for a junior DevOps, SRE or cloud role. Terraform, Ansible, Kubernetes and GitOps in public repos, with tested backup restores and the failures written down.',
    role: 'DevOps, SRE and Cloud',
    available: 'Looking for a junior DevOps, SRE or cloud role',
    pitch: 'DevOps intern, focused on observability. I run a whole homelab as code, with Terraform, Ansible and GitOps, Prometheus alerting, backups with a tested restore and every failure written down with cause and fix. Before this, 15 years in audiovisual, where I coordinated a team of 13.',
    cvPdf: 'Download PDF resume',
    cvShort: 'Resume',
    sheet: { now: 'Now', nowV: 'DevOps intern since Sep 2026', location: 'Based in', proof: 'Public code', proofV: 'public repositories', articles: 'technical articles', lab: 'Stack', labV: 'Terraform, Ansible, Kubernetes, ArgoCD, Linux, Prometheus, Grafana, GitHub Actions, AWS', study: 'Education', studyV: 'Systems Analysis and Development (in progress) · Degree in Advertising', english: 'Languages', citizenship: 'Citizenship', workMode: 'Work mode' },
    projects: { title: 'Projects', lead: 'What I built and what each project proves. Decisions and what is still missing open inside each one.', details: 'Decisions and what is missing', decisions: 'Decisions', open: 'Still open', post: 'Post' },
    incidents: {
      title: 'What has broken',
      lead: 'Real failures, my own included, with cause and fix. Where a public record exists, the row links to it.',
      symptom: 'Symptom', cause: 'Cause', fix: 'Fix', read: 'Read',
    },
    method: { title: 'How I work', lead: 'Four rules I follow on the homelab and bring to work.' },
    homelab: {
      title: 'Homelab',
      lead: 'Real hardware, a segmented network and services in daily use, described in code. It is a single node for my own use, with no external traffic: not high availability.',
      flow: 'From bare metal to service',
      vlans: 'Segmented network',
      machines: 'Machines',
      machine: 'Machine',
      services: 'Services',
      inventory: 'Inventory declared in code, not live monitoring.',
      name: 'Service', role: 'Role', host: 'Host', vlan: 'VLAN', id: 'ID', access: 'Access',
      diagram: 'View the full network topology',
      source: 'Diagram source (D2)',
    },
    stack: {
      title: 'Stack',
      lead: 'Grouped by area, with where each thing was used and how far it goes.',
      area: 'Area', tools: 'Tools', where: 'Used in',
    },
    career: {
      title: 'Career',
      about: 'I started with a homelab out of curiosity and studied cybersecurity to understand what I was doing. That is where I fell in love with infrastructure. Today I treat everything as code and think about protection before spinning up any resource. I come from audiovisual, where documentation, troubleshooting and tight deadlines were already part of the job.',
      experience: 'Experience',
      before: 'Before: audiovisual',
      certs: 'Certifications and courses',
      certsMore: 'All credentials, verifiable, on Credly',
      studying: 'Studying for, no exam taken yet: Terraform Associate (004) and Google Associate Cloud Engineer.',
      cert: 'Name', issuer: 'Issuer', date: 'Date',
      education: 'Education',
    },
    blog: { title: 'Blog', lead: 'Homelab, AWS and automation, written while the problems were happening.', all: 'All articles', minRead: 'min', back: 'Back to articles', home: 'Home', toc: 'On this page', other: 'Ler em português' },
    contact: { title: 'Hiring a junior for DevOps, SRE or cloud?', lead: 'I reply by email or LinkedIn.', copy: 'Copy email', copied: 'Copied' },
    footer: 'Built with Astro. Infrastructure and deploy live in the public repos.',
    theme: 'Toggle light or dark theme',
    cvSummary: 'DevOps intern focused on observability, looking for a junior DevOps, SRE or cloud role. I run a whole homelab as code, with Terraform, Ansible, k3s and ArgoCD, Prometheus alerting, backups with a tested restore and the failures written down in public repos. Before this, audiovisual since 2010, coordinating a team of 13.',
    cvProjects: 'Projects',
  },
};

export type Link = { label: string; href: string };

export const projects: {
  name: L;
  outcome: L;
  tags: string[];
  decisions: Record<Lang, string[]>;
  open?: L;
  repos: string[];
  post?: string;
  doc?: { label: L; href: string };
  /** entra no CV de uma página */
  cv?: boolean;
}[] = [
  {
    name: { pt: 'Cluster GitOps no homelab', en: 'GitOps cluster on the homelab' },
    outcome: {
      pt: 'Um git push atualiza o serviço e reverter o commit faz o rollback. k3s com ArgoCD rodando Nextcloud, Immich e Jellyfin, com TLS automático e acesso só pela rede Tailscale. O primeiro deploy passou por mais de 10 falhas até os cinco apps ficarem Synced e Healthy.',
      en: 'A git push updates the service and reverting the commit rolls it back. k3s with ArgoCD running Nextcloud, Immich and Jellyfin, with automatic TLS and access only through the Tailscale network. The first deploy went through more than 10 failures before all five apps were Synced and Healthy.',
    },
    tags: ['k3s', 'ArgoCD', 'Helm', 'cert-manager', 'CloudNativePG', 'Tailscale'],
    decisions: {
      pt: [
        'App of Apps: um único bootstrap manual, e todo serviço novo entra por um arquivo no repositório.',
        'Um Helm release por serviço: falha isolada, rollback granular e diff limpo.',
        'Postgres em disco local, fora do NFS, por causa de fsync e locking. O custo apareceu depois: os bancos ficaram fora dos snapshots.',
        'Secrets fora do git: o repositório só tem placeholders que documentam a estrutura.',
      ],
      en: [
        'App of Apps: a single manual bootstrap, and every new service comes in as a file in the repo.',
        'One Helm release per service: isolated failures, granular rollback and a clean diff.',
        'Postgres on local disk, off NFS, because of fsync and locking. The cost showed up later: the databases were left out of the snapshots.',
        'Secrets stay out of git: the repo only holds placeholders documenting the structure.',
      ],
    },
    open: {
      pt: 'O GitOps cobre só parte do cluster, e uma recuperação total ainda pede cerca de 10 passos manuais. Próximos: SOPS, sync waves, versões fixas e staging.',
      en: 'GitOps covers only part of the cluster, and a full recovery still takes about 10 manual steps. Next: SOPS, sync waves, pinned versions and staging.',
    },
    repos: ['homelab-gitops'],
    post: 'homelab-07-truenas-gitops',
    cv: true,
  },
  {
    name: { pt: 'Alertas e monitoramento de fora', en: 'Alerting and outside-in monitoring' },
    outcome: {
      pt: 'Prometheus e Alertmanager fora do cluster, avisando no Telegram sobre host fora, disco cheio ou enchendo, memória, site fora do ar, certificado vencendo e backup atrasado. Um blackbox exporter testa os serviços como um usuário, com painel de uptime no Grafana em código. Preparando o alerta de backup, descobri que o dump agendado do Git nunca tinha rodado.',
      en: 'Prometheus and Alertmanager outside the cluster, notifying on Telegram about a host down, a disk full or filling up, memory, a site down, a certificate expiring and an overdue backup. A blackbox exporter probes the services the way a user would, with an uptime dashboard in Grafana as code. While building the backup alert, I found that the scheduled Git dump had never run.',
    },
    tags: ['Prometheus', 'Alertmanager', 'blackbox_exporter', 'PromQL', 'Grafana', 'Ansible'],
    decisions: {
      pt: [
        'Monitoramento fora do que ele monitora: se o cluster cai, as métricas da queda continuam lá.',
        'Backup alertado pela idade do último sucesso, que o próprio script grava no textfile collector, e não pelo erro: um script que morre sem avisar deixa o valor envelhecer. Um absent() cobre o caso de nunca ter rodado.',
        'Toda regra testada simulando a falha sem derrubar o serviço: o site apontado para 127.0.0.1, o timestamp envelhecido em 27 h e um exporter parado. Nos três, chegaram o aviso e o resolvido.',
        'O blackbox escuta só em localhost: o /probe aceita qualquer alvo e, exposto, transformaria a máquina num scanner da rede.',
        'Config validada com promtool e amtool antes de ser instalada pelo Ansible, e o warning de disco inibido quando o critical do mesmo disco dispara.',
      ],
      en: [
        'Monitoring lives outside what it monitors: if the cluster goes down, the metrics of the outage are still there.',
        'Backups are alerted on the age of the last success, which the script itself writes to the textfile collector, not on the error: a script that dies silently lets the value age. An absent() covers the case where it never ran.',
        'Every rule tested by simulating the failure without taking the service down: the site pointed at 127.0.0.1, the timestamp aged by 27 h and an exporter stopped. In all three, the alert and the resolve arrived.',
        'The blackbox exporter listens on localhost only: /probe accepts any target and, exposed, would turn the machine into a network scanner.',
        'Config validated with promtool and amtool before Ansible installs it, and the disk warning inhibited when the critical for the same disk fires.',
      ],
    },
    open: {
      pt: 'O Loki ainda não recebe logs, o cluster e os bancos ainda não têm métricas próprias e não há SLO. Os próximos passos são um aviso externo para quando o próprio monitoramento cair e um agente de logs e métricas no k3s.',
      en: 'Loki receives no logs yet, the cluster and the databases have no metrics of their own and there is no SLO. Next are an external check for when monitoring itself goes down and a logs and metrics agent on k3s.',
    },
    repos: ['homelab-infra'],
    doc: { label: { pt: 'Pull request das sondas e alertas', en: 'Probes and alerts pull request' }, href: 'https://github.com/luisbrancher/homelab-infra/pull/4' },
    cv: true,
  },
  {
    name: { pt: 'Backup com restore testado', en: 'Backups with a tested restore' },
    outcome: {
      pt: 'Os bancos passaram quatro meses sem backup, e nada reclamou. Hoje há dump diário validado, snapshots ZFS, replicação e cópia externa criptografada. O restore em um Postgres descartável devolveu 7.183 assets e 7.124 embeddings, iguais à produção.',
      en: 'The databases went four months with no backup, and nothing complained. Now there is a validated daily dump, ZFS snapshots, replication and an encrypted off-site copy. Restoring into a throwaway Postgres brought back 7,183 assets and 7,124 embeddings, matching production.',
    },
    tags: ['CronJob', 'pg_dump', 'CloudNativePG', 'TrueNAS', 'ZFS', 'rclone'],
    decisions: {
      pt: [
        'O dump grava em .tmp, valida com pg_restore --list e só então renomeia: um arquivo pela metade nunca parece válido.',
        'Ordem fixa: primeiro os dumps, depois o snapshot que os inclui, depois a cópia para fora.',
        'COPY em vez de SYNC na cópia externa: uma exclusão acidental ou um ransomware não chega lá. A contrapartida é não ter versões.',
        'Stripe nos pools de propósito, para ter mais espaço, com o risco aceito por escrito.',
      ],
      en: [
        'The dump writes to .tmp, validates with pg_restore --list and only then renames: a half-written file never looks valid.',
        'Fixed order: dumps first, then the snapshot that includes them, then the off-site copy.',
        'COPY instead of SYNC for the off-site copy: an accidental delete or ransomware does not reach it. The trade-off is having no versions.',
        'Striped pools on purpose, for more space, with the risk accepted in writing.',
      ],
    },
    open: {
      pt: 'O restore a partir da cópia externa já foi provado para os dumps: voltaram do Drive iguais byte a byte, com as chaves guardadas fora do NAS. Falta exercitar a recuperação completa, de ponta a ponta.',
      en: 'Restoring from the off-site copy is proven for the dumps: they came back from Drive byte for byte, with the keys kept off the NAS. A full end-to-end recovery has not been exercised yet.',
    },
    repos: ['homelab-gitops'],
    doc: { label: { pt: 'Runbook de restore', en: 'Restore runbook' }, href: restoreRunbook },
    cv: true,
  },
  {
    name: { pt: 'Infraestrutura do homelab como código', en: 'Homelab infrastructure as code' },
    outcome: {
      pt: 'VMs e containers no Proxmox provisionados com Terraform e configurados com Ansible, com a rede (OPNsense, 4 VLANs, switch e AP) em um repositório próprio. Cerca de 3.600 linhas versionadas em três repositórios.',
      en: 'Proxmox VMs and containers provisioned with Terraform and configured with Ansible, with the network (OPNsense, 4 VLANs, switch and AP) in its own repo. About 3,600 versioned lines across three repos.',
    },
    tags: ['Terraform', 'HCP Terraform', 'Ansible', 'Proxmox', 'OPNsense'],
    decisions: {
      pt: [
        'HCP Terraform Agent dentro da rede: os jobs saem por conexão de saída, sem abrir porta.',
        'Migração de telmate/proxmox para bpg/proxmox depois de dois erros seguidos de compatibilidade com o Proxmox 9.',
        'Token de API com privilégio mínimo e LXC não privilegiado.',
        'Rede validada em bancada antes de migrar a casa, e configurada à mão antes de virar playbook.',
      ],
      en: [
        'HCP Terraform Agent inside the network: jobs run over an outbound connection, with no open ports.',
        'Moved from telmate/proxmox to bpg/proxmox after two compatibility errors in a row with Proxmox 9.',
        'Least-privilege API token and unprivileged LXC.',
        'Network validated on a bench before moving the house over, and configured by hand before becoming a playbook.',
      ],
    },
    open: {
      pt: 'Tarefas repetidas que ainda não viraram roles, versões do k3s e do ArgoCD sem fixar e uma correção da placa de rede que vive só no host.',
      en: 'Repeated tasks not yet turned into roles, unpinned k3s and ArgoCD versions, and a NIC fix that lives only on the host.',
    },
    repos: ['homelab-infra', 'homelab-network'],
    post: 'proxmox-terraform',
    cv: true,
  },
  {
    name: { pt: 'Git próprio com deploy contínuo', en: 'Self-hosted Git with continuous deploy' },
    outcome: {
      pt: 'Um push na main publica o site, e um erro de validação barra o deploy. Forgejo em LXC própria, criada com Terraform e configurada com Ansible, com um runner de Actions que publica 6 sites internos. Fiz o teste negativo: um link quebrado de propósito deixou o job vermelho, o envio foi pulado e o site no ar não mudou.',
      en: 'A push to main publishes the site, and a validation error blocks the deploy. Forgejo on its own LXC, created with Terraform and configured with Ansible, with an Actions runner that publishes 6 internal sites. I ran the negative test: a link broken on purpose turned the job red, the upload was skipped and the live site did not change.',
    },
    tags: ['Forgejo', 'Forgejo Actions', 'Terraform', 'Ansible', 'Caddy', 'rsync'],
    decisions: {
      pt: [
        'Chave de deploy presa ao rrsync: não abre shell e só escreve na pasta dos sites. O custo é não ter isolamento entre sites da mesma máquina.',
        'Git fora do cluster, e o código de infraestrutura continua no GitHub: o Git não vira dependência para reconstruir o cluster que ele descreve.',
        'Uma LXC por público, porque o compartilhamento da Tailscale é por máquina: quem vê o site de viagens não alcança o financeiro.',
        'Runner sem privilégio e registrado offline, com o segredo gerado no servidor. Nada disso passa pelo repositório, que é público.',
      ],
      en: [
        'Deploy key locked to rrsync: no shell, and it only writes to the sites folder. The cost is no isolation between sites on the same machine.',
        'Git lives outside the cluster, and the infrastructure code stays on GitHub: Git does not become a dependency for rebuilding the cluster it describes.',
        'One LXC per audience, because Tailscale sharing is per machine: whoever sees the travel site cannot reach the finance one.',
        'Unprivileged runner, registered offline, with the secret generated on the server. None of it goes through the repo, which is public.',
      ],
    },
    open: {
      pt: 'Não há alerta quando um job do runner falha, e a validação só existe em dois dos seis sites. O dump diário do Forgejo já tem alerta de idade, mas o restore dele ainda não foi testado. Os repositórios dos sites são privados; o do runner é público.',
      en: 'There is no alert when a runner job fails, and validation only exists on two of the six sites. The daily Forgejo dump now has an age alert, but restoring it has not been tested yet. The site repos are private; the runner code is public.',
    },
    repos: ['homelab-infra'],
    cv: false, // no CV, o espaço ficou com a observabilidade
  },
  {
    name: { pt: 'Primeira IaC: este site na AWS', en: 'First IaC: this website on AWS' },
    outcome: {
      pt: 'Por cerca de seis meses este site rodou num servidor Debian na AWS, criado com Terraform, configurado com Ansible e publicado pelo GitHub Actions via rsync sobre Tailscale. Em set/2026 migrei para o GitHub Pages: o site é estático e não precisava de um servidor. O código da infraestrutura continua público.',
      en: 'For about six months this site ran on a Debian server on AWS, created with Terraform, configured with Ansible and published by GitHub Actions via rsync over Tailscale. In Sep 2026 I moved it to GitHub Pages: the site is static and did not need a server. The infrastructure code is still public.',
    },
    tags: ['AWS', 'Terraform', 'Ansible', 'GitHub Actions', 'Cloudflare', 'nginx'],
    decisions: {
      pt: [
        'VPC própria e IAM com Deny explícito para instâncias fora do t4g.micro, porque o Deny vence qualquer política anexada depois.',
        'Par de chaves só para o CI, separado da chave pessoal, depois de quatro falhas seguidas no primeiro workflow.',
        'Desligar a infraestrutura quando ela deixou de se pagar: um site estático não justifica um servidor ligado.',
      ],
      en: [
        'Custom VPC and IAM with an explicit Deny for instances other than t4g.micro, because a Deny beats any policy attached later.',
        'A key pair just for CI, separate from my personal key, after four failures in a row on the first workflow.',
        'Turning the infrastructure off once it stopped paying for itself: a static site does not justify a running server.',
      ],
    },
    open: {
      pt: 'Era uma instância só, com HTTPS terminado na Cloudflare e a origem em HTTP, e o workflow só fazia deploy, sem testes. Hoje eu fecharia a origem com TLS e trocaria a chave de longa duração por OIDC.',
      en: 'It was a single instance, with HTTPS terminated at Cloudflare and the origin on HTTP, and the workflow only deployed, with no tests. Today I would close the origin with TLS and swap the long-lived key for OIDC.',
    },
    repos: ['personal-site-infra', 'luisbrancher.dev'],
    post: 'github-actions',
    cv: false, // o CV cabe em uma página; a AWS continua na linha de stack
  },
];

/** O que já quebrou. Os mais recentes primeiro; os que têm medição antes e depois logo no topo. */
export const incidents: { symptom: string | L; cause: L; fix: L; post?: string; anchor?: L; href?: L }[] = [
  {
    symptom: { pt: 'Backup diário do Git nunca gerou um arquivo', en: 'Daily Git backup never produced a file' },
    cause: { pt: 'O cron roda com um PATH mínimo, e o script chamava um binário que fica fora dele. Morria com exit 127 todo dia, desde a primeira noite, e o erro ia para um e-mail que ninguém recebe. Apareceu quando fui escrever o alerta desse backup.', en: 'cron runs with a minimal PATH, and the script called a binary outside it. It died with exit 127 every day since the first night, and the error went to an email nobody receives. It showed up when I set out to write the alert for that backup.' },
    fix: { pt: 'O script fixa o próprio PATH e grava a hora do último sucesso. Se ela passar de 26 horas, ou nunca aparecer, chega alerta no Telegram.', en: 'The script now sets its own PATH and records the time of the last success. If it gets older than 26 hours, or never shows up, an alert reaches Telegram.' },
    href: { pt: 'https://github.com/luisbrancher/homelab-infra/commit/77ab4ed', en: 'https://github.com/luisbrancher/homelab-infra/commit/77ab4ed' },
  },
  {
    symptom: { pt: 'Backup noturno enfileira 57 GiB que já estavam no destino', en: 'Nightly backup queues 57 GiB already at the destination' },
    cause: { pt: 'Um erro 403 de cota fez falhar a listagem de uma pasta, e o rclone tratou "não consegui ler" como "não existe". Três hipóteses minhas caíram antes de o log responder.', en: 'A 403 quota error made one folder listing fail, and rclone treated "could not read" as "does not exist". Three of my hypotheses fell before the log answered.' },
    fix: { pt: 'Execução abortada, credencial OAuth própria e lista de exclusão. A execução agendada caiu de mais de 9 horas para cerca de 8 minutos.', en: 'Run aborted, my own OAuth credential and an exclude list. The scheduled run went from over 9 hours to about 8 minutes.' },
    post: 'revisando-homelab-pt2-backup',
    anchor: { pt: '57gib-que-não-deviam-subir', en: '57gib-that-shouldnt-have-gone-up' },
  },
  {
    symptom: { pt: 'Thin pool do Proxmox a 98,7%, sem nenhum alerta', en: 'Proxmox thin pool at 98.7%, with no alert' },
    cause: { pt: 'Discos da VM com discard=ignore: a VM sabia o que tinha apagado, mas o Proxmox não. No fluxo de baixar e apagar mídia, o pool só crescia.', en: 'VM disks with discard=ignore: the VM knew what it had deleted, but Proxmox did not. With media being downloaded and deleted, the pool only grew.' },
    fix: { pt: 'discard=on, fstrim e um timer. O volume do sistema caiu para 56,4%, com 48 GB recuperados.', en: 'discard=on, fstrim and a timer. The system volume dropped to 56.4%, with 48 GB recovered.' },
    post: 'revisando-homelab-pt1-discos',
    anchor: { pt: '48gb-presos-no-thin-pool', en: '48gb-stuck-in-the-thin-pool' },
  },
  {
    symptom: { pt: 'Wi-Fi de visitantes abre a interface do roteador', en: 'Guest Wi-Fi reaches the router admin' },
    cause: { pt: 'O bloqueio cobria as outras VLANs, mas não os IPs do próprio roteador. A falha era minha e vinha desde maio.', en: 'The block covered the other VLANs, but not the IPs of the router itself. The flaw was mine and dated back to May.' },
    fix: { pt: 'Regras sobre (self), com só DNS, DHCP e NTP liberados, e teste real por um celular na rede guest.', en: 'Rules on (self), allowing only DNS, DHCP and NTP, then a real test from a phone on the guest network.' },
    post: 'revisando-homelab',
    anchor: { pt: 'o-que-apareceu', en: 'what-turned-up' },
  },
  {
    symptom: { pt: 'Servidor some do Tailscale, a 10.000 km de casa', en: 'Server drops off Tailscale, 10,000 km from home' },
    cause: { pt: 'Depois de uma queda de energia. Hipótese: conflito entre IP fixo e DHCP, somado ao roteador da operadora. A causa nunca ficou comprovada.', en: 'After a power outage. Hypothesis: a static IP and DHCP conflict, plus the ISP router. The cause was never proven.' },
    fix: { pt: 'Entrada pela LAN a partir da workstation e SSH por IPv6 link-local. Virou motivo para refazer o homelab.', en: 'Got in through the LAN from the workstation, then SSH over IPv6 link-local. It became the reason to rebuild the homelab.' },
    post: 'drp',
  },
  {
    symptom: { pt: 'Host Proxmox congela sob tráfego alto', en: 'Proxmox host freezes under heavy traffic' },
    cause: { pt: 'Bug da placa e1000e/I219. Primeiro suspeitei da CPU e subi para 16 vCPUs, sem efeito.', en: 'An e1000e/I219 NIC bug. I first suspected the CPU and went up to 16 vCPUs, with no effect.' },
    fix: { pt: 'Offloads desligados, com o processamento na CPU. Fica fora do código, então está registrado como desvio.', en: 'Offloads turned off, moving the work to the CPU. It lives outside the code, so it is recorded as drift.' },
    post: 'revisando-homelab',
    anchor: { pt: 'o-que-mudou-na-mão', en: 'what-changed-by-hand' },
  },
  {
    symptom: { pt: 'Scrutiny marca o SSD de boot como Failed', en: 'Scrutiny flags the boot SSD as Failed' },
    cause: { pt: '121 erros de mídia antigos, de um SSD comprado usado. O smartctl mostrou 100% de spare e testes sem erro.', en: '121 old media errors, from an SSD bought used. smartctl showed 100% spare and clean tests.' },
    fix: { pt: 'De "trocar já" para "acompanhar": o contador nunca zera, e o que importa é se ele cresce. Configuração guardada fora do NAS.', en: 'From "replace now" to "watch it": the counter never resets, and what matters is whether it grows. Config kept off the NAS.' },
    post: 'revisando-homelab-pt1-discos',
    anchor: { pt: 'o-ssd-de-boot-que-nasceu-failed', en: 'the-boot-ssd-that-started-out-failed' },
  },
  {
    symptom: 'metadata.annotations: Too long: may not be more than 262144 bytes',
    cause: { pt: 'CRDs do CNPG grandes demais para a annotation last-applied-configuration.', en: 'CNPG CRDs too large for the last-applied-configuration annotation.' },
    fix: { pt: 'ServerSideApply=true nos syncOptions do Application.', en: 'ServerSideApply=true in the Application syncOptions.' },
    post: 'homelab-07-truenas-gitops',
    anchor: { pt: 'cnpg-operator-outofsync', en: 'cnpg-operator-stuck-outofsync' },
  },
  {
    symptom: 'rsync: connection unexpectedly closed',
    cause: { pt: 'Primeiro, a chave no secret sem a newline final. Depois, a passphrase, que o runner não tem como digitar.', en: 'First, the key in the secret was missing its final newline. Then the passphrase, which the runner cannot type.' },
    fix: { pt: 'Par de chaves dedicado ao CI, separado da chave pessoal.', en: 'A key pair dedicated to CI, separate from my personal key.' },
    post: 'github-actions',
    anchor: { pt: 'os-erros-que-apareceram', en: 'the-errors-that-appeared' },
  },
];

/** Como trabalho: cada princípio vem de um caso real. */
export const principles: { title: L; text: L }[] = [
  {
    title: { pt: 'Tudo passa pelo git', en: 'Everything goes through git' },
    text: { pt: 'No cluster, um push atualiza o serviço e um revert desfaz, com o ArgoCD aplicando o que está no repositório. Rede e máquinas também estão em código. O que é sensível não vai para o GitHub: fica num Forgejo hospedado por mim, num LXC do homelab, com runner próprio de Actions.', en: 'On the cluster, a push updates the service and a revert rolls it back, with ArgoCD applying what is in the repo. Network and machines are in code too. Anything sensitive stays off GitHub, in a Forgejo instance I host on a homelab LXC, with its own Actions runner.' },
  },
  {
    title: { pt: 'IA como par, com a decisão comigo', en: 'AI as a pair, with the decision on me' },
    text: {
      pt: 'Quando a ferramenta é nova, faço sozinho, para entender o que está acontecendo. Depois uso a IA como professora, para tirar dúvidas, e para acelerar o que já sei fazer, sempre vendo o diff antes de aplicar.',
      en: 'When a tool is new to me, I do it on my own to understand what is going on. Then I use AI as a teacher, to answer questions, and to speed up what I already know how to do, always reading the diff before applying it.',
    },
  },
  {
    title: { pt: 'Só confio no que testei', en: 'I only trust what I have tested' },
    text: { pt: 'Backup só conta depois de um restore, e o playbook roda duas vezes para provar que a segunda não muda nada. Com segurança é igual: rede em VLANs, IAM de privilégio mínimo e acesso pelo Tailscale, e ainda assim a auditoria achou visitantes chegando na administração do roteador.', en: 'A backup only counts after a restore, and a playbook runs twice to prove the second run changes nothing. Security works the same way: VLANs, least-privilege IAM and access through Tailscale, and the audit still found guests reaching the router admin.' },
  },
  {
    title: { pt: 'Documento o erro junto com a solução', en: 'I write down the failure along with the fix' },
    text: { pt: 'Publico artigos técnicos a partir das minhas notas, com ajuda de IA na redação, e mantenho runbooks nos repositórios. É o que eu já fazia no audiovisual, coordenando criação, produtoras e clientes.', en: 'I publish technical articles from my own notes, with help from AI on the writing, and keep runbooks in the repos. It is what I already did in audiovisual, coordinating creatives, production companies and clients.' },
  },
];

/** Experiência em tecnologia. Do estágio, só o que é genérico: sem nome de produto nem números. */
export const jobs: { period: L; role: L; org: L; text?: L; bullets?: Record<Lang, string[]> }[] = [
  {
    period: { pt: 'set/2026 – hoje', en: 'Sep 2026 – now' },
    role: { pt: 'Estágio em DevOps', en: 'DevOps Intern' },
    org: { pt: 'ZPE Systems', en: 'ZPE Systems' },
    text: { pt: 'Foco em observabilidade.', en: 'Focused on observability.' },
    bullets: {
      pt: [
        'Análise de alertas: leio os disparos nos dados e proponho o que ajustar ou remover, descrevendo o risco de cada mudança.',
        'Criei por iniciativa própria um mapa interativo dos fluxos de uma plataforma interna, hoje usado como documentação pela equipe.',
      ],
      en: [
        'Alert analysis: I read the firing data and propose what to tune or remove, describing the risk of each change.',
        'On my own initiative, I built an interactive map of the flows of an internal platform, now used by the team as documentation.',
      ],
    },
  },
  {
    period: { pt: 'mar/2026 – hoje', en: 'Mar 2026 – now' },
    role: { pt: 'Projetos próprios de cloud e DevOps', en: 'Personal cloud and DevOps projects' },
    org: { pt: 'Código público, com base de homelab desde 2023', en: 'Public code, on a homelab foundation since 2023' },
    bullets: {
      pt: [
        'Homelab reconstruído como código, do bare metal ao serviço, em repositórios públicos.',
        'Backup de PostgreSQL com verificação e restore testado.',
        'Rede em 4 VLANs com OPNsense, configurada via Ansible e API.',
        'Git próprio com runner de Actions, que valida e publica sites a cada push.',
        'Primeira IaC na AWS: Terraform, IAM de privilégio mínimo e deploy por GitHub Actions sobre Tailscale.',
      ],
      en: [
        'Homelab rebuilt as code, from bare metal to service, in public repositories.',
        'PostgreSQL backups with verification and a tested restore.',
        'Network split into 4 VLANs with OPNsense, configured through Ansible and the API.',
        'Self-hosted Git with an Actions runner that validates and publishes sites on every push.',
        'First IaC on AWS: Terraform, least-privilege IAM and deploys through GitHub Actions over Tailscale.',
      ],
    },
  },
];

/** cv: entra no CV de uma página. */
export const audiovisualJobs: { period: L; role: L; org: L; text?: L; cv?: boolean }[] = [
  {
    period: { pt: '2021 – 2026', en: '2021 – 2026' },
    role: { pt: 'Motion designer e editor freelancer, para clientes no Brasil e no exterior', en: 'Freelance motion designer and editor, for clients in Brazil and abroad' },
    org: { pt: 'Alicerce Educação e clientes internacionais', en: 'Alicerce Educação and international clients' },
    text: { pt: 'Mais de 4 anos na Alicerce, criando os vídeos e contratando produtoras locais pelo Brasil, com 70 projetos registrados. Em 2026, motion design, VTs com IA e edição de podcast para clientes de fora.', en: 'Over 4 years at Alicerce, creating the videos and hiring local production companies across Brazil, with 70 recorded projects. In 2026, motion design, AI-assisted spots and podcast editing for clients abroad.' },
    cv: true,
  },
  {
    period: { pt: '2019 – 2021', en: '2019 – 2021' },
    role: { pt: 'Coordenador de criação', en: 'Creative Lead' },
    org: { pt: 'Henry Schein Brazil', en: 'Henry Schein Brazil' },
    text: { pt: 'Promovido de editor de vídeo a coordenador em menos de um ano. Equipe de 13 pessoas, 3 videomakers e 10 designers, com campanhas mensais de varejo, e-commerce e audiovisual.', en: 'Promoted from video editor to coordinator in under a year. A team of 13, 3 videographers and 10 designers, running monthly retail, e-commerce and video campaigns.' },
    cv: true,
  },
  {
    period: { pt: '2016 – 2019', en: '2016 – 2019' },
    role: { pt: 'Analista de marketing, depois freelancer', en: 'Marketing Analyst, then freelancer' },
    org: { pt: 'Dental Cremer (hoje Henry Schein) e agências', en: 'Dental Cremer (now Henry Schein) and agencies' },
    text: { pt: 'Primeiro profissional de vídeo contratado: criei o setor e o toquei sozinho por cerca de um ano e meio.', en: 'First video professional hired: I created the video department and ran it alone for about a year and a half.' },
  },
  {
    period: { pt: '2010 – 2016', en: '2010 – 2016' },
    role: { pt: 'TV e produção: edição, direção de imagem ao vivo e motion', en: 'TV and production: editing, live image direction and motion' },
    org: { pt: 'RBS TV, RBA TV, UNIASSELVI e Fábrica de Cinema do Alto Vale', en: 'RBS TV, RBA TV, UNIASSELVI and Fábrica de Cinema do Alto Vale' },
    // fora do CV para ele caber em uma página; continua na home
  },
];

export const schooling: { title: L; org: string; period: L; note?: L }[] = [
  {
    title: { pt: 'Análise e Desenvolvimento de Sistemas', en: 'Systems Analysis and Development' },
    org: 'UniCesumar',
    period: { pt: 'jul/2026 – jul/2028, em andamento', en: 'Jul 2026 – Jul 2028, in progress' },
  },
  {
    title: { pt: 'Disciplinas de Cibersegurança concluídas', en: 'Completed Cybersecurity courses' },
    org: 'PUC-PR',
    period: { pt: 'mai – dez/2025', en: 'May – Dec 2025' },
    note: { pt: 'Linux, Python, CCNA CyberOps, Network Defense e Ethical Hacking. Labs de Wazuh com Shuffle, Snort e pfSense.', en: 'Linux, Python, CCNA CyberOps, Network Defense and Ethical Hacking. Labs on Wazuh with Shuffle, Snort and pfSense.' },
  },
  {
    title: { pt: 'Publicidade e Propaganda; Tecnólogo em Design Gráfico', en: 'Advertising; Graphic Design technologist degree' },
    org: 'UNIASSELVI',
    period: { pt: '2009 – 2013', en: '2009 – 2013' },
  },
  {
    title: { pt: 'Inglês geral, 8 semanas em Liverpool', en: 'General English, 8 weeks in Liverpool' },
    org: 'Kaplan International',
    period: { pt: '2023', en: '2023' },
  },
];

export const flow: { tool: string; what: L; repo?: string }[] = [
  { tool: 'Terraform', what: { pt: 'Cria VMs e LXC no Proxmox', en: 'Creates VMs and LXC on Proxmox' }, repo: 'homelab-infra' },
  { tool: 'Ansible', what: { pt: 'Configura o sistema e sobe o k3s', en: 'Configures the OS and brings up k3s' }, repo: 'homelab-infra' },
  { tool: 'ArgoCD', what: { pt: 'Reconcilia o cluster com o git', en: 'Reconciles the cluster with git' }, repo: 'homelab-gitops' },
  { tool: 'Helm', what: { pt: 'Entrega um release por serviço', en: 'Ships one release per service' }, repo: 'homelab-gitops' },
  { tool: 'Prometheus', what: { pt: 'Métricas, sondas e alertas no Telegram, fora do cluster de propósito', en: 'Metrics, probes and Telegram alerts, outside the cluster on purpose' }, repo: 'homelab-infra' },
];

export const access: Record<string, L> = {
  trusted: { pt: 'Acesso irrestrito', en: 'Unrestricted' },
  iot: { pt: 'Só internet', en: 'Internet only' },
  guest: { pt: 'Só internet', en: 'Internet only' },
  lab: { pt: 'Internet e trusted', en: 'Internet and trusted' },
};

/** Máquinas do homelab, sem endereços. */
export const machines: { name: string; role: L }[] = [
  { name: 'Mini PC N150', role: { pt: 'OPNsense: roteador, firewall e VLANs', en: 'OPNsense: router, firewall and VLANs' } },
  { name: 'Lenovo M80q, i5-13500T', role: { pt: 'Proxmox: VM do k3s e LXCs de monitoramento e Forgejo', en: 'Proxmox: k3s VM, monitoring and Forgejo LXCs' } },
  { name: 'Lenovo V50s, i3-10100', role: { pt: 'TrueNAS: 2 SSDs de dados e 2 HDDs de backup', en: 'TrueNAS: 2 data SSDs and 2 backup HDDs' } },
  { name: 'Raspberry Pi 4', role: { pt: 'Omada Controller, MotionEye e UpSnap', en: 'Omada Controller, MotionEye and UpSnap' } },
];

export const skills: { area: L; tools: string[]; note?: L; where: Link[] }[] = [
  { area: { pt: 'Infraestrutura como código', en: 'Infrastructure as code' }, tools: ['Terraform', 'HCP Terraform', 'Ansible', 'Ansible Vault'], where: [{ label: 'homelab-infra', href: gh('homelab-infra') }, { label: 'personal-site-infra', href: gh('personal-site-infra') }, { label: 'homelab-network', href: gh('homelab-network') }] },
  { area: { pt: 'Kubernetes e GitOps', en: 'Kubernetes and GitOps' }, tools: ['Kubernetes (k3s)', 'ArgoCD', 'Helm', 'cert-manager', 'CloudNativePG'], note: { pt: 'Um nó, de uso próprio.', en: 'A single node, for my own use.' }, where: [{ label: 'homelab-gitops', href: gh('homelab-gitops') }] },
  { area: { pt: 'Armazenamento e backup', en: 'Storage and backup' }, tools: ['TrueNAS', 'ZFS', 'NFS', 'pg_dump', 'rclone'], where: [{ label: 'homelab-gitops', href: gh('homelab-gitops') }] },
  {
    area: { pt: 'Cloud', en: 'Cloud' },
    tools: ['AWS (EC2, VPC, IAM)', 'GCP (estudo)', 'Cloudflare'],
    note: { pt: 'Fundamentos com projeto real: uma instância na AWS por cerca de seis meses, hoje desligada. GCP ainda começando.', en: 'Fundamentals with a real project: one AWS instance for about six months, now turned off. GCP just starting.' },
    where: [{ label: 'personal-site-infra', href: gh('personal-site-infra') }, { label: 'terraform-gcp-study', href: gh('terraform-gcp-study') }],
  },
  {
    area: { pt: 'CI/CD', en: 'CI/CD' },
    tools: ['GitHub Actions', 'Forgejo Actions', 'Git'],
    note: { pt: 'No GitHub, deploy automatizado sem etapa de testes. No Forgejo, um runner próprio publica 6 sites internos a cada push, e em dois deles um check de validação barra o deploy quando falha. O runner está no homelab-infra, que é público; os repositórios dos sites são privados.', en: 'On GitHub, automated deploys with no test stage. On Forgejo, my own runner publishes 6 internal sites on every push, and on two of them a validation check blocks the deploy when it fails. The runner lives in homelab-infra, which is public; the site repos are private.' },
    where: [{ label: 'luisbrancher.dev', href: gh('luisbrancher.dev') }, { label: 'homelab-infra', href: gh('homelab-infra') }],
  },
  {
    area: { pt: 'Observabilidade', en: 'Observability' },
    tools: ['Prometheus', 'Alertmanager', 'blackbox_exporter', 'Grafana', 'Loki', 'Scrutiny'],
    note: { pt: 'Regras próprias em PromQL, sondas de fora e alerta de backup pela idade do último sucesso, tudo no Telegram e testado simulando a falha. O Loki ainda não recebe logs. No estágio, análise de alertas.', en: 'My own PromQL rules, outside-in probes and backup alerts on the age of the last success, all on Telegram and tested by simulating the failure. Loki receives no logs yet. At the internship, alert analysis.' },
    where: [{ label: 'homelab-infra', href: gh('homelab-infra') }],
  },
  {
    area: { pt: 'Rede e segurança', en: 'Networking and security' },
    tools: ['OPNsense', 'VLANs', 'Firewall', 'Tailscale', 'WireGuard', 'SSH hardening', 'nginx'],
    note: { pt: 'Em laboratório, na PUC-PR: detecção de força bruta em SSH com Wazuh e resposta orquestrada no Shuffle, e regras de Snort avaliando falso-positivo.', en: 'In lab work, at PUC-PR: SSH brute-force detection with Wazuh and orchestrated response in Shuffle, and Snort rules assessed for false positives.' },
    where: [{ label: 'homelab-network', href: gh('homelab-network') }, { label: 'personal-site-infra', href: gh('personal-site-infra') }],
  },
  {
    area: { pt: 'Sistemas e containers', en: 'Systems and containers' },
    tools: ['Linux (Debian)', 'Proxmox', 'LVM-thin', 'systemd', 'Docker Compose'],
    note: { pt: 'Debian em VMs e LXC, discos por UUID e by-id, LVM-thin com fstrim. Docker só com Compose, sem imagens próprias.', en: 'Debian on VMs and LXC, disks by UUID and by-id, LVM-thin with fstrim. Docker with Compose only, no images of my own.' },
    where: [{ label: 'homelab-infra', href: gh('homelab-infra') }],
  },
  { area: { pt: 'Scripting', en: 'Scripting' }, tools: ['Bash', 'Python'], note: { pt: 'Scripts e automação, não desenvolvimento.', en: 'Scripts and automation, not software development.' }, where: [{ label: 'python-security-tools', href: gh('python-security-tools') }] },
];

/** Repositórios citados na página; alimenta o número do hero. */
export const publicRepos = ['homelab-gitops', 'homelab-infra', 'homelab-network', 'personal-site-infra', 'luisbrancher.dev', 'terraform-gcp-study', 'python-security-tools'];
