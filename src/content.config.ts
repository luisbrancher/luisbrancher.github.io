import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Posts em src/content/blog/<lang>/<slug>.md — o id fica "pt/slug" ou "en/slug".
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    readingTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
    repo: z.string().url().optional(),
    repos: z.array(z.string().url()).optional(),
    translationKey: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
