// The ONE door to the server. Every request in the app goes through api().
//
//   const home = await api<HomeData>('/api/home');                       // GET
//   await api('/api/campaigns', { method: 'POST', body: { name } });      // send JSON
//
// If the server says no (400, 401, 404, 500...), api() throws an ApiError that carries
// the server's message and the HTTP status, so pages can show the message and react to
// the status (401 = not logged in).

export class ApiError extends Error {
    status: number;
    missing: string[];
    constructor(status: number, message: string, missing: string[] = []) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.missing = missing;
    }
}

type ApiOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    // 'no-cache' = always ask the server, but let it answer "unchanged" (304) cheaply
    cache?: RequestCache;
};

export async function api<T = unknown>(path: string, { method = 'GET', body, cache }: ApiOptions = {}): Promise<T> {
    const res = await fetch(path, {
        method,
        cache,
        credentials: 'same-origin', // send the login cookie
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null); // some answers have no body
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP error! status: ${res.status}`, Array.isArray(data?.missing) ? data.missing : []);
    return data as T;
}
