import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
export { corsHeaders, z };
export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function authorize(req: Request, operation: 'extract' | 'generate') {
  if (req.method !== 'POST') throw new RequestError(405, 'Use POST.');
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new RequestError(401, 'Sign in to use this service. Test personas cannot call paid APIs.');
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || !service) throw new RequestError(503, 'Service configuration unavailable.');
  const client = createClient(url, key, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new RequestError(401, 'Session invalid. Sign in again.');
  const admin = createClient(url, service);
  if (operation === 'generate') {
    const role = await admin.rpc('has_role', { _user_id: data.user.id, _role: 'admin' });
    if (role.error || !role.data) throw new RequestError(403, 'Only administrators can generate benchmark problems.');
  }
  const budget = await admin.rpc('consume_ai_request', { _user_id: data.user.id, _operation: operation });
  if (budget.error) throw new RequestError(503, 'Rate-limit service unavailable; request blocked safely.');
  if (!budget.data) throw new RequestError(429, 'Hourly request limit reached. Try again next hour.');
}
export async function readBody(req: Request, maxBytes: number): Promise<unknown> {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new RequestError(415, 'JSON input required.');
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError(400, 'Request body missing.');
  let bytes = 0, text = ''; const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new RequestError(413, 'Input exceeds the upload limit.'); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); } catch { throw new RequestError(400, 'Malformed JSON input.'); }
}

/** Preserve existing model/protocol; retry only explicit transient HTTP failures.
 * A five-minute infrastructure deadline avoids indefinitely held requests.
 * Timeout/network ambiguity is never replayed because inference may be billed. */
export async function gatewayFetch(url: string, init: RequestInit) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(300000) }); }
    catch { throw new RequestError(504, 'AI request did not complete. No answer was produced or retried.'); }
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      const wait = Number(response.headers.get('Retry-After') ?? '2');
      if (!Number.isFinite(wait) || wait > 10) return response;
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, Math.max(1000, wait * 1000) + Math.random() * 250));
      continue;
    }
    return response;
  }
  throw new RequestError(503, 'AI service unavailable.');
}
export async function requireGatewayOK(response: Response) {
  if (response.ok) return;
  let message = `AI service returned ${response.status}; answer withheld.`;
  try {
    const body = await response.json();
    const safe = body.message ?? body.error?.message;
    if (typeof safe === 'string') message = safe.slice(0, 1000);
  } catch { /* retain safe status-only message */ }
  throw new RequestError(response.status, message);
}
export function errorResponse(error: unknown) {
  const status = error instanceof RequestError ? error.status : 502;
  return new Response(JSON.stringify({ error: error instanceof RequestError ? error.message : 'Invalid or incomplete AI output; answer withheld.' }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(status === 429 ? { 'Retry-After': '3600' } : {}) },
  });
}