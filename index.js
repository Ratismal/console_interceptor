const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const static = require('koa-static');
const websockify = require('koa-websocket');
const fs = require('fs');
const path = require('path');
const Catflake = require('catflake');
const Router = require('@koa/router');
const multer = require('@koa/multer');

const upload = multer();

const key = fs.readFileSync('cert/interceptLocal.key', { encoding: 'utf8' });
const cert = fs.readFileSync('cert/interceptLocal.crt', { encoding: 'utf8' });

const catflake = new Catflake({ stringify: true });

const app = websockify(new Koa(), {}, {
  key, cert
});

app.use(bodyParser());

app.use(async (ctx, next) => {
  console.log('%s %s', ctx.method, ctx.url);
  ctx.set('Access-Control-Allow-Origin', '*');
  ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  ctx.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
  await next();
});

const consonants = [
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'
];
const vowels = [
  'a', 'e', 'i', 'o', 'u', 'y'
];

function hasteflake(id) {
  let parts = id.split('').map(Number);
  parts = parts.slice(parts.length - 8);
  let flake = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // consonant
      let seed;
      if (i === 0) seed = parts[i] + parts[i + 1];
      else seed = parts[i] + parts[i - 1];
      seed = seed % consonants.length;
      flake.push(consonants[seed]);
    } else {
      // vowel
      let seed = (parts[i] + parts[i - 1]) % vowels.length;
      flake.push(vowels[seed]);
    }
  }
  return flake.join('');
}

const clients = [];
const sites = [];

function updateSites() {

}

function broadcast(clients, message) {
  let id = null;
  if (typeof message === 'object') {
    if (message.target) id = message.target;
  }
  if (typeof message !== 'string') message = JSON.stringify(message);
  for (const client of clients) {
    if (!id || id === client.id)
      client.websocket.send(message)
  }
}

function injectId(ctx, message) {
  if (message !== 'heartbeat') {
    if (typeof message === 'string')
      message = JSON.parse(message);
    message.id = ctx.id;
    message.hip = hasteflake(ctx.id);
    message.origin = ctx.headers.origin;
    message.mid = catflake.generate();
  }
  return message;
}

app.ws.use((ctx, next) => {
  console.log('WS %s', ctx.path);
  ctx.id = catflake.generate();
  if (ctx.path === '/ws/site') {
    sites.push(ctx);
    console.log('New ws site connection');
    ctx.websocket.on('message', function (message) {
      message = injectId(ctx, message);
      if (message !== "heartbeat")
        broadcast(clients, message);
    });
    ctx.websocket.on('close', () => {
      sites.splice(sites.indexOf(ctx), 1);
      broadcast(clients, { code: 'close', id: ctx.id });
    });
    broadcast(clients, { code: 'open', id: ctx.id, origin: ctx.headers.origin, hip: hasteflake(ctx.id) });
  } else if (ctx.path === '/ws/client') {
    clients.push(ctx);
    ctx.websocket.on('message', function (message) {
      message = injectId(ctx, message);
      if (message !== "heartbeat")
        broadcast(sites, message);
    });
    ctx.websocket.on('close', () => {
      clients.splice(clients.indexOf(ctx), 1);
      broadcast(sites, { code: 'close', id: ctx.id });
    });
    broadcast(sites, { code: 'open', id: ctx.id, origin: ctx.headers.origin, hip: hasteflake(ctx.id) });
  }
});

const heartbeat = setInterval(function () {
  broadcast(sites, { code: 'heartbeat' });
  broadcast(clients, { code: 'heartbeat' });
}, 1000);

app.use(static('static'));

function find(text, start, end) {
  const s = text.indexOf(start);
  const e = text.lastIndexOf(end);
  return {
    start: s,
    end: e + end.length,
    content: text.substring(s + start.length, e),
    removed: text.substring(0, s).concat(text.substring(e + end.length, text.length))
  };
}

const router = new Router();

router.get('/assets/components/:name', (ctx, next) => {
  let name = ctx.params.name;
  if (name.endsWith('.mjs')) name = name.substring(0, name.length - 4);
  let file = fs.readFileSync(path.join(__dirname, 'components', name + '.vue'), { encoding: 'utf8' });
  let html = find(file, '<template>', '</template>');
  let script = find(html.removed, '<script>', '</script>');

  let htmlContent = html.content.replace(/`/g, '\\`');
  let jsContent = script.content.replace('export default {', 'export default { template,');

  let output = `const template = \`${htmlContent}\`;

${jsContent}`;

  ctx.set('Content-Type', 'text/javascript');
  ctx.status = 200;
  ctx.body = output;
})

const FILE_DIR = path.join(__dirname, 'files');

function formatName(name, i) {
  let parts = name.split('.');
  let ext = parts[parts.length - 1];
  let base = parts.slice(0, parts.length - 1).join('.');
  return `${base}_${i}${ext ? '.' + ext : ''}`;
}

function saveFile(name, value) {
  const n = name.toLowerCase();
  const files = fs.readdirSync(FILE_DIR).map(f => f.toLowerCase());
  let i = 0;
  if (files.includes(n)) {
    let newName;
    do {
      i++;
      newName = formatName(n, i);
    } while (files.includes(newName));
  }

  fs.writeFileSync(path.join(__dirname, 'files', i === 0 ? name : formatName(name, i)), value);
}


router.post('/upload', upload.fields([
  {
    name: 'file',
    maxCount: 8
  }
]), (ctx, next) => {
  for (const file of ctx.files.file) {
    saveFile(file.originalname, file.buffer);
  }

  ctx.status = 200;
});

app.use(router.routes());
app.use(router.allowedMethods());


const PORT = 1337;
app.listen(PORT);
console.log('App is listening on', PORT);