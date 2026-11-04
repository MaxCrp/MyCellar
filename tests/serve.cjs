// Petit serveur statique qui imite Cloudflare (Workers et Pages) : « /index.html » est redirigé vers « / ».
// C'est cette redirection qui cassait le service worker sur iPhone. Usage : node tests/serve.cjs [port]
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public'), port = +process.argv[2] || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.endsWith('/index.html')) { res.writeHead(307, { location: u.pathname.slice(0, -10) + u.search }); return res.end(); }
  let f = path.join(root, decodeURIComponent(u.pathname));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(data);
  });
}).listen(port);
