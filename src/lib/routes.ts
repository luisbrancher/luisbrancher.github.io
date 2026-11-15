import { getCollection, type CollectionEntry } from 'astro:content';

export type Lang = 'pt' | 'en';
type PageKey = 'home' | 'cv' | 'blog';

const LANGS: Lang[] = ['pt', 'en'];

const PAGE_PATH: Record<PageKey, string> = {
  home: '',
  cv: 'cv/',
  blog: 'blog/',
};

/** pt na raiz, en em /en */
export function url(lang: Lang, page: PageKey | string): string {
  const path = page in PAGE_PATH ? PAGE_PATH[page as PageKey] : page;
  return `${lang === 'en' ? '/en' : ''}/${path}`;
}

export const postUrl = (post: CollectionEntry<'blog'>) => url(postLang(post), `blog/${postSlug(post)}/`);

export const postLang = (post: CollectionEntry<'blog'>) => post.id.split('/')[0] as Lang;
const postSlug = (post: CollectionEntry<'blog'>) => post.id.split('/').slice(1).join('/');

/** paths das páginas estáticas: pt na raiz, en em /en */
export function langPaths() {
  return LANGS.map((lang) => ({ params: { lang: lang === 'en' ? 'en' : undefined }, props: { lang } }));
}

export async function postPaths() {
  const posts = await getCollection('blog', (p) => !p.data.draft);
  return posts.map((post) => ({
    params: { lang: postLang(post) === 'en' ? 'en' : undefined, slug: postSlug(post) },
    props: { post },
  }));
}

export async function getPosts(lang: Lang) {
  const posts = await getCollection('blog', (p) => postLang(p) === lang && !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** post equivalente no outro idioma (mesmo translationKey), se existir */
export async function translationOf(post: CollectionEntry<'blog'>) {
  const other = postLang(post) === 'pt' ? 'en' : 'pt';
  const all = await getCollection('blog', (p) => postLang(p) === other && p.data.translationKey === post.data.translationKey);
  return all[0];
}

export function readingTime(post: CollectionEntry<'blog'>) {
  if (post.data.readingTime) return post.data.readingTime;
  const words = (post.body ?? '').split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

/** "07 jul 2026" / "Jul 07, 2026" */
export function formatDate(d: Date, lang: Lang) {
  const month = d.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return lang === 'pt' ? `${day} ${month} ${d.getUTCFullYear()}` : `${month} ${day}, ${d.getUTCFullYear()}`;
}

/** link equivalente no outro idioma para a página atual */
export function altLangUrl(lang: Lang, page: PageKey | string) {
  return url(lang === 'pt' ? 'en' : 'pt', page);
}
