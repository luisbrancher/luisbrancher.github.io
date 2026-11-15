// Dados pessoais, certificações, VLANs e serviços do homelab.
import type { Lang } from '../lib/routes';

type L = Record<Lang, string>;

export const person = {
  short: 'Luis Brancher',
  location: { pt: 'Blumenau - SC - Brasil', en: 'Blumenau - SC - Brazil' } as L,
  email: 'luisbrancher@proton.me',
  linkedin: 'https://www.linkedin.com/in/luisbrancher/',
  github: 'https://github.com/luisbrancher',
};

// lista para o JSON-LD da página (knowsAbout)
export const stack: { name: L | string }[] = [
  { name: 'Linux' },
  { name: 'Python' },
  { name: 'Bash' },
  { name: 'Docker' },
  { name: 'Terraform' },
  { name: 'AWS' },
  { name: 'Ansible' },
  { name: 'Git' },
  { name: 'Kubernetes' },
  { name: 'ArgoCD' },
  { name: 'Proxmox' },
  { name: 'Prometheus' },
  { name: 'Grafana' },
  { name: 'Nginx' },
  { name: 'SSH' },
  { name: { pt: 'Redes', en: 'Networking' } },
  { name: 'Firewall' },
  { name: { pt: 'Monitoramento', en: 'Monitoring' } },
  { name: { pt: 'Segurança', en: 'Security' } },
  { name: { pt: 'Documentação', en: 'Documentation' } },
];

export type Cert = { name: string; issuer: string; date: string; id?: string; skills: { pt: string[]; en: string[] }; featured?: boolean };

// date em AAAA-MM; formatada por idioma na renderização
export const certs: Cert[] = [
  { name: 'LFEL1009: Getting Started with OpenTofu', issuer: 'Linux Foundation', date: '2026-11', skills: { pt: ['OpenTofu'], en: ['OpenTofu'] } },
  { name: 'LFEL1001: Understanding the EU Cyber Resilience Act', issuer: 'Linux Foundation', date: '2026-10', skills: { pt: ['Cyber Resilience Act'], en: ['Cyber Resilience Act'] } },
  { name: 'LFS158: Introduction to Kubernetes', issuer: 'Linux Foundation', date: '2026-09', skills: { pt: ['Kubernetes'], en: ['Kubernetes'] } },
  { name: 'Terraform Basics Training Course', issuer: 'KodeKloud', date: '2026-04', id: '250d6f6c-ddad-4732-8092-1d1199811af2', skills: { pt: ['Terraform'], en: ['Terraform'] } },
  { name: 'Fortinet Certified Associate in Cybersecurity', issuer: 'Fortinet', date: '2025-08', id: '4860626429LF', featured: true, skills: { pt: ['Fortinet', 'Network Security'], en: ['Fortinet', 'Network Security'] } },
  { name: 'Fortinet Certified Fundamentals in Cybersecurity', issuer: 'Fortinet', date: '2025-08', id: '2243338952LF', skills: { pt: ['Fortinet', 'Cibersegurança'], en: ['Fortinet', 'Cybersecurity'] } },
  { name: 'Cybersecurity Professional Certificate', issuer: 'Google', date: '2025-05', id: 'UM7P9L9C3MOJ', featured: true, skills: { pt: ['Linux', 'Python', 'SQL', 'Detecção de Intrusão', 'Gestão de Vulnerabilidades'], en: ['Linux', 'Python', 'SQL', 'Intrusion Detection', 'Vulnerability Management'] } },
  { name: 'Cyber Security 101 Certificate', issuer: 'TryHackMe', date: '2025-06', id: 'THM-PCBMCJBRQV', skills: { pt: [], en: [] } },
  { name: 'Pre Security Certificate', issuer: 'TryHackMe', date: '2025-04', id: 'THM-HNX6LWNXCU', skills: { pt: [], en: [] } },
  { name: 'Web Front-End Developer', issuer: 'Era Conectada', date: '2021-06', skills: { pt: ['HTML5 / CSS3', 'JavaScript / jQuery', 'Bootstrap'], en: ['HTML5 / CSS3', 'JavaScript / jQuery', 'Bootstrap'] } },
];

export function certDate(date: string, lang: Lang) {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const vlans = [
  { name: 'trusted', id: 10 },
  { name: 'iot', id: 20 },
  { name: 'guest', id: 30 },
  { name: 'lab', id: 40 },
];

export const services = [
  { name: 'nextcloud', host: 'k3s', category: { pt: 'File Sync', en: 'File Sync' } },
  { name: 'immich', host: 'k3s', category: { pt: 'Backup de Fotos', en: 'Photo Backup' } },
  { name: 'jellyfin', host: 'k3s', category: { pt: 'Media Server', en: 'Media Server' } },
  { name: 'cert-manager', host: 'k3s', category: { pt: "TLS / Let's Encrypt", en: "TLS / Let's Encrypt" } },
  { name: 'cnpg-operator', host: 'k3s', category: { pt: 'PostgreSQL Operator', en: 'PostgreSQL Operator' } },
  { name: 'prometheus', host: 'LXC', category: { pt: 'Métricas', en: 'Metrics' } },
  { name: 'alertmanager', host: 'LXC', category: { pt: 'Alertas no Telegram', en: 'Telegram Alerts' } },
  { name: 'blackbox', host: 'LXC', category: { pt: 'Sondas HTTP e DNS', en: 'HTTP and DNS Probes' } },
  { name: 'grafana', host: 'LXC', category: { pt: 'Dashboards', en: 'Dashboards' } },
  { name: 'loki', host: 'LXC', category: { pt: 'Agregação de Logs', en: 'Log Aggregation' } },
  { name: 'forgejo', host: 'LXC', category: { pt: 'Git self-hosted', en: 'Self-hosted Git' } },
  { name: 'forgejo-runner', host: 'LXC', category: { pt: 'Runner de CI/CD', en: 'CI/CD Runner' } },
  { name: 'scrutiny', host: 'TrueNAS', category: { pt: 'Saúde dos Discos', en: 'Disk Health' } },
  { name: 'omada-controller', host: 'Pi4', category: { pt: 'Gestão de Rede', en: 'Network Mgmt' } },
  { name: 'motioneye', host: 'Pi4', category: { pt: 'NVR / CCTV', en: 'NVR / CCTV' } },
  { name: 'upsnap', host: 'Pi4', category: { pt: 'Wake-on-LAN', en: 'Wake-on-LAN' } },
];

export const loc = (v: L | string, lang: Lang) => (typeof v === 'string' ? v : v[lang]);
