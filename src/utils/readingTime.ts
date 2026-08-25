import type { CollectionEntry } from 'astro:content';

const WORDS_PER_MINUTE = 200;

/** Estimated reading time for a post, e.g. "4 min read". Counts prose and code alike. */
export function readingTime(post: CollectionEntry<'writing'>): string {
  const words = (post.body ?? '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}
