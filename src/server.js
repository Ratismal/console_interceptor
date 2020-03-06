const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const koaStatic = require('koa-static');
const websockify = require('koa-websocket');
const fs = require('fs');
const path = require('path');
const Catflake = require('catflake');
const Router = require('@koa/router');
const multer = require('@koa/multer');
const snekfetch = require('snekfetch');
const package = require('../package.json');

const upload = multer();

const catflake = new Catflake({ stringify: true });

const consonants = [
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'
];
const vowels = [
  'a', 'e', 'i', 'o', 'u', 'y'
];

let hasUpdate = null;

const CompareResult = {
  // Our version is newer than the latest release
  NEWER: 1,
  // The latest release is newer than our version
  OLDER: 2,
  // Our versions are the same
  SAME: 3
}

function compareSegment(v1, v2) {
  if (v1 < v2) return CompareResult.OLDER;
  if (v1 > v2) return CompareResult.NEWER;
  return CompareResult.SAME;
}

function compareVersions(tag) {
  let v1 = package.version.split('.').map(Number);
  let v2 = tag.substring(1).split('.').map(Number);
  let parts = v1.map((v, i) => compareSegment(v, v2[i]));
  for (const part of parts) {
    switch (part) {
      case CompareResult.NEWER:
        return false;
      case CompareResult.OLDER:
        return true;
    }
  }
  return false;
}

async function checkForUpdates() {
  try {
    const res = await snekfetch.get('https://api.github.com/repos/ratismal/console_interceptor/releases/latest');
    if (compareVersions(res.body.tag_name)) {
      hasUpdate = { href: res.body.html_url, version: res.body.tag_name };
    }
  } catch (err) {
    /* NO-OP */
  }
}

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

module.exports = class ConsoleInterceptor {
  constructor(options = {}) {
    this.port = options.port || 1337;
    this.certDir = options.certDir || 'cert';
    this.fileDir = options.fileDir || 'files';
    this.resourceDir = options.resourceDir || path.join(__dirname, 'resources');

    this.key = fs.readFileSync(path.join(this.certDir, 'interceptLocal.key'), { encoding: 'utf8' });
    this.cert = fs.readFileSync(path.join(this.certDir, 'interceptLocal.crt'), { encoding: 'utf8' });
    this.root = fs.readFileSync(path.join(this.certDir, 'rootCA.crt'), { encoding: 'utf8' });

    this.app = null;
    this.router = null;
    this.clients = [];
    this.sites = [];
    this.heartbeat = null;

    this.initialize();
  }

  async initialize() {
    await checkForUpdates();

    try {
      const stat = fs.lstatSync(this.fileDir);
    } catch (err) {
      console.error(err);
      fs.mkdirSync(this.fileDir);
    }
    const app = websockify(new Koa(), {}, {
      key: this.key, cert: this.cert
    });
    this.app = app;

    app.use(bodyParser());

    app.use(async (ctx, next) => {
      console.log('%s %s', ctx.method, ctx.url);
      ctx.set('Access-Control-Allow-Origin', '*');
      ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      ctx.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
      await next();
    });

    app.ws.use((ctx, next) => {
      console.log('WS %s', ctx.path);
      ctx.id = catflake.generate();
      if (ctx.path === '/ws/site') {
        this.sites.push(ctx);
        console.log('New ws site connection');
        ctx.websocket.on('message', (message) => {
          message = this.injectId(ctx, message);
          if (message !== "heartbeat")
            this.broadcast(this.clients, message);
        });
        ctx.websocket.on('close', () => {
          this.sites.splice(this.sites.indexOf(ctx), 1);
          this.broadcast(this.clients, { code: 'close', id: ctx.id });
        });
        this.broadcast(this.clients, { code: 'open', id: ctx.id, origin: ctx.headers.origin, hip: hasteflake(ctx.id) });
      } else if (ctx.path === '/ws/client') {
        this.clients.push(ctx);
        ctx.websocket.on('message', (message) => {
          message = this.injectId(ctx, message);
          if (message !== "heartbeat")
            this.broadcast(this.sites, message);
        });
        ctx.websocket.on('close', () => {
          this.clients.splice(this.clients.indexOf(ctx), 1);
          this.broadcast(this.sites, { code: 'close', id: ctx.id });
        });
        if (hasUpdate) {
          console.log('sending update notice');
          this.broadcast([ctx], { code: 'update', update: hasUpdate });
        }
        this.broadcast(this.sites, { code: 'open', id: ctx.id, origin: ctx.headers.origin, hip: hasteflake(ctx.id) });
      }
    });

    this.heartbeat = setInterval(() => {
      this.broadcast(this.sites, { code: 'heartbeat' });
      this.broadcast(this.clients, { code: 'heartbeat' });
    }, 1000);

    app.use(async (ctx, next) => {
      if (ctx.path === '/ssl') {
        ctx.body = this.root;
        ctx.status = 200;
        ctx.set('Content-Type', 'application/x-x509-ca-cert');
        ctx.set('Content-Disposition', 'filename=intercept-ssl-cert.pem');
        return;
      } else await next();
    })

    app.use(koaStatic(path.join(this.resourceDir, 'static')));

    const router = new Router();
    this.router = router;

    router.get('/assets/components/:name', (ctx, next) => {
      let name = ctx.params.name;
      if (name.endsWith('.mjs')) name = name.substring(0, name.length - 4);
      let file = fs.readFileSync(path.join(this.resourceDir, 'components', name + '.vue'), { encoding: 'utf8' });
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

    router.post('/upload', upload.fields([
      {
        name: 'file',
        maxCount: 8
      }
    ]), (ctx, next) => {
      for (const file of ctx.files.file) {
        this.saveFile(file.originalname, file.buffer);
      }

      ctx.status = 200;
    });

    app.use(router.routes());
    app.use(router.allowedMethods());


    app.listen(this.port);
    console.log('App is listening on', this.port);
  }

  broadcast(clients, message) {
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

  injectId(ctx, message) {
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

  formatName(name, i) {
    let parts = name.split('.');
    let ext = parts[parts.length - 1];
    let base = parts.slice(0, parts.length - 1).join('.');
    return `${base}_${i}${ext ? '.' + ext : ''}`;
  }

  saveFile(name, value) {
    const n = name.toLowerCase();
    const files = fs.readdirSync(this.fileDir).map(f => f.toLowerCase());
    let i = 0;
    if (files.includes(n)) {
      let newName;
      do {
        i++;
        newName = this.formatName(n, i);
      } while (files.includes(newName));
    }

    fs.writeFileSync(path.join(this.fileDir, i === 0 ? name : this.formatName(name, i)), value);
  }
}