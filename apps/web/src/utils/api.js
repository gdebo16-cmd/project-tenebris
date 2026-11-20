import { api } from '../api.ts';

// Older helper, kept for the creator and sheet until they are rebuilt (R4, R5).
// It now goes through the same door as everything else: api() in src/api.ts.
export function sendJson(url, method = 'POST', body) {
    return api(url, { method, body });
}
