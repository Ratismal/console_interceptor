(function () {
  class ConsoleReceiver {
    constructor() {
      this.setupSocket();

      this.int = setInterval(this.interval.bind(this), 1000);
      this.sites = [];
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
      if (!site && msg.id) {
        site = { id: msg.id, origin: msg.origin, hip: msg.hip, logs: [] }
        this.sites.push(site);
      }
      if (msg.href) {
        site.origin = msg.href;
      }
      this.updateSites();

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
          site.logs.push(log);
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
          this.addLog(site, {
            type: type.join(' '), args: [msg.content]
          });
          break;
        }
        case 'close': {
          this.sites.splice(this.sites.indexOf(site), 1);
          this.updateSites();
          break;
        }
      }
    }

    formatLog(log) {
      for (let i = 0; i < log.args.length; i++) {
        if (typeof log.args[i] === 'string')
          log.args[i] = log.args[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        else if (log.args[i] instanceof Error) {
          log.args[i] = log.args[i].stack;
        } else
          log.args[i] = JSON.stringify(log.args[i], null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      let format = log.args[0];
      let args = log.args.slice(1);
      let regex = /%([\S]*?)([a-z%])/ig;
      let parts = format.split(/%[\S]*?[a-z%]/i);
      let out = ['<span>'];
      let result;
      let i = 0;
      while ((result = regex.exec(format)) !== null) {
        out.push(parts.shift());
        let mod = result[1];
        let type = result[2];
        let swap = result[0];
        let arg = args.shift();
        if (++i > 100) break;

        if (arg !== undefined)
          switch (type.toLowerCase()) {
            case 's': {
              swap = arg;
              break;
            }
            case 'i':
            case 'd': {
              swap = parseInt(arg);
              break;
            }
            case 'f': {
              swap = parseFloat(arg);
              break;
            }
            case 'o': {
              swap = `<div class="obj">${arg}</div>`;
              break;
            }
            case 'c': {
              let a = arg
              a = a.replace(/"/g, '\\"')
              swap = `</span><span style="${a}">`;
              break;
            }
            default: {
              args.unshift(arg);
              break;
            }
          }
        out.push(swap);
      }
      out.push(...parts);
      return [out.join(''), ...args].join(' ');
    }

    addLog(site, log) {
      const el = document.createElement('div');
      el.className = 'log ' + log.type;
      let formatted = this.formatLog(log);
      el.innerHTML = `<div>${formatted}</div>`;
      site.elogs.appendChild(el);
      site.elogs.scrollTop += site.elogs.scrollHeight;
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
            if (e.code === 'Enter') {
              e.preventDefault();
              this.addLog(site, {
                type: 'eval_input',
                args: [site.input.value]
              });
              this.socket.send(JSON.stringify({
                code: 'eval',
                target: site.id,
                content: site.input.value
              }));
              site.input.value = '';
            }
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

  const receiver = new ConsoleReceiver();

  window.send = function (code) {
    receiver.socket.send(JSON.stringify({
      code: 'eval',
      content: code
    }));
  }
})();

