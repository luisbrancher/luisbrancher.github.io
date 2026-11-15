// Gera public/assets/luis-brancher-cv-{pt,en}.pdf a partir da página /cv/.
// Precisa do servidor rodando (npm run dev) e do Edge ou Chrome instalado.
//   npm run cv:pdf
//   BASE_URL=http://localhost:4321 BROWSER="C:/caminho/chrome.exe" npm run cv:pdf
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const base = process.env.BASE_URL ?? 'http://localhost:4321';
const browser = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!browser) throw new Error('Edge/Chrome não encontrado. Defina BROWSER com o caminho do executável.');

for (const [lang, path] of [['pt', '/cv/'], ['en', '/en/cv/']]) {
  const out = resolve(`public/assets/luis-brancher-cv-${lang}.pdf`);
  rmSync(out, { force: true });
  // perfil próprio a cada execução: no Windows o navegador segura o lock mesmo depois de terminar
  const profile = mkdtempSync(join(tmpdir(), 'cv-pdf-'));
  spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=4000',
    `--user-data-dir=${profile}`, `--print-to-pdf=${out}`, `${base}${path}`,
  ], { stdio: 'ignore' });

  // o executável pode devolver o controle antes de escrever o arquivo, então espera o tamanho estabilizar
  let size = -1;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const now = existsSync(out) ? statSync(out).size : 0;
    if (now > 0 && now === size) break;
    size = now;
  }
  if (size <= 0) throw new Error(`PDF não gerado: ${out}`);
  console.log(`${out} (${Math.round(size / 1024)} KB)`);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* fica na pasta temporária do sistema */ }
}
