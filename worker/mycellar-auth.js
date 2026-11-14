/* MyCellar · service d'autorisation Google Drive (Cloudflare Worker), v2.2
   Rôle unique : échanger le code d'autorisation contre des jetons, puis renouveler le jeton d'accès,
   avec le secret du projet Google (que l'app ne doit jamais contenir). Il ne stocke rien, ne journalise
   aucun jeton, et ne voit jamais les sauvegardes : elles vont directement de l'appareil au Google Drive.

   Variables du Worker (Settings › Variables and Secrets) :
     CLIENT_ID       identifiant OAuth « Application Web » (…apps.googleusercontent.com)
     CLIENT_SECRET   secret de cet identifiant (type « Secret », jamais en clair)
     ALLOWED_ORIGIN  adresse de l'app, sans « / » final (ex. https://mycellar.pages.dev) ; plusieurs : séparées par des virgules
     REDIRECT_URI    adresse de retour déclarée chez Google, exactement (ex. https://mycellar.pages.dev/)
   Routes : POST /token { code, code_verifier }   POST /refresh { refresh_token } */
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const MAX_BODY = 4096;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = okOrigin ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' } : { vary: 'Origin' };
    const json = (status, o) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!okOrigin) return json(403, { error: 'origin' });
    const path = new URL(req.url).pathname;
    if (req.method !== 'POST' || (path !== '/token' && path !== '/refresh')) return json(404, { error: 'not_found' });
    if (!env.CLIENT_ID || !env.CLIENT_SECRET || !env.REDIRECT_URI) return json(500, { error: 'not_configured' });

    const text = await req.text();
    if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
    let body; try { body = JSON.parse(text); } catch { return json(400, { error: 'bad_json' }); }
    if (!body || typeof body !== 'object') return json(400, { error: 'bad_json' });

    const p = new URLSearchParams({ client_id: env.CLIENT_ID, client_secret: env.CLIENT_SECRET });
    if (path === '/token') {
      const { code, code_verifier: v } = body;
      if (typeof code !== 'string' || !code || code.length > 512) return json(400, { error: 'bad_code' });
      if (typeof v !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(v)) return json(400, { error: 'bad_verifier' });
      p.set('grant_type', 'authorization_code'); p.set('code', code); p.set('code_verifier', v);
      p.set('redirect_uri', env.REDIRECT_URI);   // fixée ici : impossible de détourner le service vers une autre adresse
    } else {
      const t = body.refresh_token;
      if (typeof t !== 'string' || !t || t.length > 512) return json(400, { error: 'bad_token' });
      p.set('grant_type', 'refresh_token'); p.set('refresh_token', t);
    }

    let r, j;
    try { r = await fetch(GOOGLE_TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p.toString() }); j = await r.json(); }
    catch { return json(502, { error: 'google_unreachable' }); }
    if (!r.ok) return json(r.status >= 500 ? 502 : 400, { error: typeof j?.error === 'string' ? j.error.slice(0, 64) : 'google_error' });
    const out = { access_token: j.access_token, expires_in: j.expires_in };
    if (j.refresh_token) out.refresh_token = j.refresh_token;
    return json(200, out);
  },
};
