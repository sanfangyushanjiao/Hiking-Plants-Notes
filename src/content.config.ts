import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const plants = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/plants' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		location: z.string().optional(),
		photos: z.array(z.string()),
		summary: z.string().optional(),
		draft: z.boolean().optional(),
	}),
});

export const collections = { plants };
