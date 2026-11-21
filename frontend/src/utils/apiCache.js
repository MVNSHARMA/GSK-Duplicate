/**
 * Lightweight client-side API cache & in-flight request deduplicator for /api/* GET requests.
 *
 * - Eliminates duplicate concurrent GET requests when opening Admin modules.
 * - Serves recently visited module data (< 20s TTL) immediately on route transitions
 *   so switching between Admin Dashboard tabs feels instantaneous.
 * - Automatically invalidates cached entries immediately whenever any mutation
 *   (POST, PUT, PATCH, DELETE) occurs anywhere in the application.
 */

const CACHE_STORE = new Map();
const IN_FLIGHT_GETS = new Map();
let lastSeenToken = null;
let isInstalled = false;

const BYPASS_SUBSTRINGS = [
  '/pdf',
  '/export',
  '/cron',
  '/debug-ping',
  '/communications/notifications/unread-count',
  '/retention-status',
];

function getTtlForUrl(urlStr) {
  if (
    urlStr.includes('/api/settings') ||
    urlStr.includes('/api/vehicle-templates') ||
    urlStr.includes('/api/admins/technicians')
  ) {
    return 60 * 1000; // 60s for reference/config endpoints
  }
  return 20 * 1000; // 20s for operational list/dashboard endpoints
}

function shouldBypassCache(urlStr) {
  if (!urlStr.includes('/api/')) return true;
  return BYPASS_SUBSTRINGS.some((sub) => urlStr.includes(sub));
}

export function clearApiCache(prefix = null) {
  if (!prefix) {
    CACHE_STORE.clear();
    return;
  }
  for (const key of CACHE_STORE.keys()) {
    if (key.includes(prefix)) {
      CACHE_STORE.delete(key);
    }
  }
}

export function installApiCache() {
  if (isInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }
  isInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function cachedFetch(input, init = {}) {
    const urlStr = typeof input === 'string' ? input : input?.url || String(input);
    const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();

    // Detect auth token change (login/logout) and flush cache
    const currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('gsk_token') : null;
    if (currentToken !== lastSeenToken) {
      CACHE_STORE.clear();
      IN_FLIGHT_GETS.clear();
      lastSeenToken = currentToken;
    }

    // Any write operation immediately invalidates all cached GET responses
    if (method !== 'GET' && method !== 'HEAD') {
      if (urlStr.includes('/api/')) {
        CACHE_STORE.clear();
      }
      const response = await nativeFetch(input, init);
      if (urlStr.includes('/api/')) {
        CACHE_STORE.clear();
      }
      return response;
    }

    if (shouldBypassCache(urlStr)) {
      return nativeFetch(input, init);
    }

    const cacheKey = `${currentToken || 'anon'}:${urlStr}`;
    const now = Date.now();
    const cached = CACHE_STORE.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      // Background revalidation if entry is > 8s old so subsequent view is always fresh
      if (now - cached.cachedAt > 8000 && !IN_FLIGHT_GETS.has(cacheKey)) {
        const bgPromise = nativeFetch(input, { ...init, signal: undefined })
          .then(async (res) => {
            if (res.ok) {
              const bodyText = await res.text();
              CACHE_STORE.set(cacheKey, {
                status: res.status,
                statusText: res.statusText,
                headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
                bodyText,
                cachedAt: Date.now(),
                expiresAt: Date.now() + getTtlForUrl(urlStr),
              });
            }
          })
          .catch(() => {})
          .finally(() => {
            IN_FLIGHT_GETS.delete(cacheKey);
          });
        IN_FLIGHT_GETS.set(cacheKey, bgPromise);
      }

      return new Response(cached.bodyText, {
        status: cached.status,
        statusText: cached.statusText,
        headers: {
          ...cached.headers,
          'X-GSK-Cache': 'HIT',
        },
      });
    }

    // Deduplicate identical concurrent GET requests (unless caller passes a custom AbortSignal)
    if (!init?.signal && IN_FLIGHT_GETS.has(cacheKey)) {
      try {
        const shared = await IN_FLIGHT_GETS.get(cacheKey);
        if (shared && shared.bodyText !== undefined) {
          return new Response(shared.bodyText, {
            status: shared.status,
            statusText: shared.statusText,
            headers: shared.headers,
          });
        }
      } catch (_) {
        // Fall through to normal fetch
      }
    }

    const fetchWork = (async () => {
      const res = await nativeFetch(input, init);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const bodyText = await res.text();
        const entry = {
          status: res.status,
          statusText: res.statusText,
          headers: { 'Content-Type': contentType },
          bodyText,
          cachedAt: Date.now(),
          expiresAt: Date.now() + getTtlForUrl(urlStr),
        };
        CACHE_STORE.set(cacheKey, entry);
        return entry;
      }
      return { rawResponse: res };
    })();

    if (!init?.signal) {
      IN_FLIGHT_GETS.set(cacheKey, fetchWork);
    }

    try {
      const entry = await fetchWork;
      if (entry?.rawResponse) {
        return entry.rawResponse;
      }
      return new Response(entry.bodyText, {
        status: entry.status,
        statusText: entry.statusText,
        headers: {
          ...entry.headers,
          'X-GSK-Cache': 'MISS',
        },
      });
    } finally {
      if (!init?.signal) {
        IN_FLIGHT_GETS.delete(cacheKey);
      }
    }
  };
}
