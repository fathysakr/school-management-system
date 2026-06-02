const cache = new Map<string, { data: any; expiry: number }>();
const DEFAULT_TTL = 10_000;

export function cached<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiry > now) return Promise.resolve(entry.data);
  const p = fn();
  p.then(data => {
    cache.set(key, { data, expiry: now + ttl });
    if (cache.size > 100) {
      const oldest = cache.entries().next().value;
      if (oldest) cache.delete(oldest[0]);
    }
  }).catch(() => {});
  return p;
}

export function cacheInvalidate(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
