export default class ConsoleReceiver {
  constructor() {
    this.setupSocket();

    this.int = setInterval(this.interval.bind(this), 1000);
    this.sites = [];

    this.update = { version: null, href: null };
  }

  interval() {
    if (this.socket) {
      try {
        this.socket.send("heartbeat");
      } catch (err) {

      }
    }
  }

  setupSocket() {
    this.socket = new WebSocket('wss://intercept:1337/ws/client');
    window.socket = this.socket;
    this.socket.onopen = this.wsOpen.bind(this);
    this.socket.onerror = this.wsError.bind(this);
    this.socket.onclose = this.wsClose.bind(this);
    this.socket.onmessage = this.wsMessage.bind(this);
  }

  wsOpen(event) {
    console.log('Console Interceptor: ws connected');
  }

  wsError(err) {
    console.error('Console Interceptor: ws error: ' + err);
  }

  wsClose(event) {
    console.log('Console Interceptor: ws closed, reconnecting in 5s');
    this.socket = null;
    setTimeout(this.setupSocket.bind(this), 5000);
  }

  wsMessage(message) {
    const msg = JSON.parse(message.data);
    let site = this.sites.find(s => s.id === msg.id);
    if (!site && msg.id && msg.hip) {
      site = { id: msg.id, origin: msg.origin, hip: msg.hip, logs: [], closed: false }
      this.sites.push(site);
    }
    if (msg.href) {
      site.origin = msg.href;
    }
    // this.updateSites();

    switch (msg.code) {
      case 'log': {
        const log = msg.log;
        for (let i = 0; i < log.args.length; i++) {
          if (log.args[i] && log.args[i]._interceptClass === 'error') {
            let err = new Error(log.args[i].message);
            err.stack = log.args[i].stack;
            log.args[i] = err;
          }
        }
        console[log.type](...log.args);
        log.id = msg.mid;
        // site.logs.push(log);
        this.addLog(site, log);
        break;
      }
      case 'eval_response': {
        console.log(msg.content);
        let type = ['eval'];
        if (msg.content && msg.content._interceptClass === 'error') {
          let err = new Error(msg.content.message);
          err.stack = msg.content.stack;
          msg.content = err;
          type.push('error');
        }
        let log = {
          type: type.join(' '),
          args: [msg.content],
          id: msg.mid
        };
        console.log(log, msg);

        this.addLog(site, log);
        break;
      }
      case 'update': {
        this.update.href = msg.update.href;
        this.update.version = msg.update.version;
        break;
      }
      case 'close': {
        site.closed = true;
        // this.sites.splice(this.sites.indexOf(site), 1);
        // this.updateSites();
        break;
      }
      case 'alert': {
        alert(msg.message);
      }
    }
  }

  sanitizeArgs(args) {
    let a = args.slice(0);
    for (let i = 0; i < args.length; i++) {
      let arg = a[i];
      let out = { original: arg };
      if (typeof arg === 'string') {
        out.text = arg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        out.type = "string";
      } else if (arg instanceof Error) {
        out.text = arg.stack;
        out.type = "error";
      } else {
        out.text = (JSON.stringify(arg, null, 2) + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        out.type = typeof arg;
      }
      a[i] = out;
    }
    return a;
  }

  formatEvalResponse(log) {

  }

  formatStyle(style, text = '') {
    return `</span><span style="${style.replace(/"/g, '\\"')}">${text}`;
  }

  formatClass(style, text = '') {
    return `<span class="${style.replace(/"/g, '\\"')}">${text}</span>`;
  }

  formatLog(log, minimal = false) {
    if (log.args.length === 0) return null;
    let logArgs = this.sanitizeArgs(log.args);
    let format = logArgs[0];
    let args = logArgs.slice(1);
    let out = [];
    let current = [];
    let style = '';
    let stringifyStrings = false;
    if (typeof format.original === 'string') {
      let regex = /%([\S]*?)([a-z%])/ig;
      let parts = format.text.split(/%[\S]*?[a-z%]/i);
      let result;
      let i = 0;
      while ((result = regex.exec(format.text)) !== null) {
        current.push(parts.shift());
        let mod = result[1];
        let type = result[2];
        let swap = result[0];
        let arg = args.shift();

        if (arg !== undefined) {
          switch (type.toLowerCase()) {
            case 's': {
              swap = arg.text;
              break;
            }
            case 'i':
            case 'd': {
              swap = parseInt(arg.text);
              break;
            }
            case 'f': {
              swap = parseFloat(arg.text);
              break;
            }
            case 'o': {
              let index = logArgs.indexOf(arg);
              if (minimal) swap = arg.text;
              else
                swap = arg.original;
              break;
            }
            case 'c': {
              if (!minimal) {
                out.push({ parts: current, style });
                style = arg.text;
                current = [];
              }
              swap = '';
              break;
            }
            default: {
              args.unshift(arg);
              break;
            }
          }
        }
        current.push(swap);
      }
      current.push(...parts);
    } else {
      args = logArgs;
      stringifyStrings = true;
    }
    if (current.length > 0) {
      out.push({ parts: current, style });
    }
    for (const arg of args) {
      if (minimal) out.push(arg.text);
      else {
        if (typeof arg.original === 'string') {
          out.push({
            parts: [arg.text],
            class: stringifyStrings ? 'type-string' : ''
          });
        } else if (typeof arg.original === 'number' || typeof arg.original === 'boolean') {
          out.push({
            parts: [arg.text], class: 'type-number'
          });
        } else if (arg.original === undefined || arg.original === null) {
          out.push({
            parts: [arg.text], class: 'type-undefined'
          });
        } else if (typeof arg.original === 'object') {
          out.push({
            parts: [arg.original]
          });
        } else {
          out.push({
            parts: [arg.text]
          });
        }
      }
    }
    let minified = [];
    for (const segment of out) {
      // console.log(segment);
      for (const part of segment.parts) {
        if (typeof part === 'object')
          minified.push(JSON.stringify(part));
        else
          minified.push(part);
      }
    }
    return { raw: out, minified: minified.join(' ').toLowerCase().split(' ') };
  }

  addLog(site, log) {
    site.input = '';
    log.processed = this.formatLog(log);
    site.logs.push(log);
    while (site.logs.length > 500) site.logs.shift();
    let el = document.querySelector(`#${site.hip} .logs`);
    if (el) {
      let csh = el.scrollHeight;
      let cst = el.scrollTop;
      setTimeout(function () {
        if (csh - cst < 380)
          el.scrollTop += el.scrollHeight;
      }, 0);
    }
    // const el = document.createElement('div');
    // el.className = 'log ' + log.type;
    // let formatted = this.formatLog(log);
    // el.innerHTML = `<div>${formatted}</div>`;
    // site.elogs.appendChild(el);
    // site.elogs.scrollTop += site.elogs.scrollHeight;
  }

  updateSites() {
    const sessions = document.getElementById('sessions');
    // sessions.innerHTML = '';
    for (const site of this.sites) {
      if (!site.id) continue;
      if (!site.init) {
        site.init = true;
        site.wrap = document.createElement('div');
        site.wrap.className = 'session';
        site.etitle = document.createElement('div');
        site.etitle.className = 'title';
        site.ecoll = document.createElement('button');
        site.ecoll.type = 'button';
        site.ecoll.innerText = 'Toggle';
        site.ecoll.className = 'button';
        site.eid = document.createElement('span');
        site.eid.className = 'id';
        site.ehref = document.createElement('span');
        site.ehref.className = 'href';
        site.elogs = document.createElement('div');
        site.elogs.className = 'logs';
        site.ecoll.addEventListener('click', () => {
          site.elogs.classList.toggle('collapsed');
        });
        site.input = document.createElement('input');
        site.input.type = 'text';
        site.input.className = 'log-input';
        site.input.addEventListener('keydown', e => {

        });
        site.etitle.appendChild(site.ecoll);
        site.etitle.appendChild(site.eid);
        site.etitle.appendChild(site.ehref);
        site.wrap.appendChild(site.etitle);
        site.wrap.appendChild(site.elogs);
        site.wrap.appendChild(site.input);
        sessions.appendChild(site.wrap);
      }
      site.eid.innerText = site.hip + ': ';
      site.ehref.innerText = site.origin;
    }
  }
}