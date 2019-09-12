const Koa = require('koa');
const static = require('koa-static');
const route = require('koa-route');
const websockify = require('koa-websocket');
const fs = require('fs');

const key = fs.readFileSync('cert/interceptLocal.key', { encoding: 'utf8' });
const cert = fs.readFileSync('cert/interceptLocal.crt', { encoding: 'utf8' });

const app = websockify(new Koa(), {}, {
  key, cert
});

app.use(async (ctx, next) => {
  console.log('%s %s', ctx.method, ctx.url);
  ctx.set('Access-Control-Allow-Origin', '*');
  ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  ctx.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
  await next();
});

const clients = [];
const sites = [];

app.ws.use((ctx, next) => {
  console.log('WS %s', ctx.path);
  if (ctx.path === '/ws/site') {
    sites.push(ctx.websocket);
    console.log('New ws site connection');
    ctx.websocket.on('message', function (message) {
      if (message !== "heartbeat")
        for (const client of clients) {
          client.send(message);
        }
    });
    ctx.websocket.on('close', () => {
      sites.splice(sites.indexOf(ctx.websocket), 1);
    });
  } else if (ctx.path === '/ws/client') {
    clients.push(ctx.websocket);
    ctx.websocket.on('message', function (message) {
      if (message !== "heartbeat")
        for (const site of sites) {
          site.send(message);
        }
    });
    ctx.websocket.on('close', () => {
      clients.splice(clients.indexOf(ctx.websocket), 1);
    });
  }
});

app.use(static('static'));


const PORT = 1337;
app.listen(PORT);
console.log('App is listening on', PORT);