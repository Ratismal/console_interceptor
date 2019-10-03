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
        case 'close': {
          site.closed = true;
          // this.sites.splice(this.sites.indexOf(site), 1);
          // this.updateSites();
          break;
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
      let logArgs = this.sanitizeArgs(log.args);
      let format = logArgs[0];
      let args = logArgs.slice(1);
      let out = [];
      let stringifyStrings = false;
      if (typeof format.original === 'string') {
        let regex = /%([\S]*?)([a-z%])/ig;
        let parts = format.text.split(/%[\S]*?[a-z%]/i);
        let result;
        let i = 0;
        while ((result = regex.exec(format.text)) !== null) {
          out.push(parts.shift());
          let mod = result[1];
          let type = result[2];
          let swap = result[0];
          let arg = args.shift();
          if (++i > 100) break;

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
                if (minimal) swap = arg.text;
                else
                  swap = `<div class="obj">${arg.text}</div>`;
                break;
              }
              case 'c': {
                if (!minimal) {
                  swap = this.formatStyle(arg.text);
                }
                break;
              }
              default: {
                args.unshift(arg);
                break;
              }
            }
          }
          out.push(swap);
        }
        out.push(...parts);
      } else {
        args = logArgs;
        stringifyStrings = true;
      }
      out = [out.join('')];
      if (!minimal && out[0] !== '') out[0] = `<span>${out[0]}</span>`;
      if (out[0] === '') out = [];
      for (const arg of args) {
        if (minimal) out.push(arg.text);
        else {
          if (typeof arg.original === 'string') {
            let str = arg.text;
            if (stringifyStrings)
              str = this.formatClass('type-string', arg.text);
            out.push(str);
          } else if (typeof arg.original === 'number' || typeof arg.original === 'boolean') {
            out.push(this.formatClass('type-number', arg.text));
          } else if (arg.original === undefined || arg.original === null) {
            out.push(this.formatClass('type-undefined', arg.text));
          } else {
            out.push(arg.text);
          }
        }
      }
      return out.join(' ');
    }

    addLog(site, log) {
      site.input = '';
      log.formatted = this.formatLog(log);
      log.minimal = this.formatLog(log, true).toLowerCase();
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

  const receiver = new ConsoleReceiver();

  window.send = function (code) {
    receiver.socket.send(JSON.stringify({
      code: 'eval',
      content: code
    }));
  }

  var app = new Vue({
    el: '#app',
    data() {
      let history = localStorage.getItem('history');
      history = history ? JSON.parse(history) : history = [];
      return {
        receiver,
        filter: '',
        inputs: {},
        mods: {},
        theme: localStorage.getItem('theme') || 'light',
        themes: ['Light', 'Dark'],
        history
      }
    },
    watch: {
      theme(newValue) {
        localStorage.setItem('theme', newValue);
      },
      history(newValue) {
        localStorage.setItem('history', JSON.stringify(newValue));
      },
      filter() {
        let els = this.$el.querySelectorAll('.logs');
        setTimeout(function () {
          for (const el of els) {
            el.scrollTop += el.scrollHeight;
          }
        }, 1);
      }
    },
    methods: {
      selectTheme(theme) {
        this.theme = theme.toLowerCase();
      },
      initMod(id) {
        if (!this.mods[id])
          Vue.set(this.mods, id, {
            collapsed: false,
            index: -1,
            cachedInput: '',
            input: ''
          });
      },
      getClass(id) {
        this.initMod(id);
        let site = this.receiver.sites.find(s => s.id === id);
        return {
          session: true,
          collapsed: !!this.mods[id].collapsed,
          closed: !site || site.closed
        }
      },
      toggleSite(id) {
        this.mods[id].collapsed = !this.mods[id].collapsed;
      },
      formatLog(log) {
        return this.receiver.formatLog(log);
      },
      getLogs(site) {
        let f = this.filter.toLowerCase().trim();
        return site.logs.filter(l => l.minimal.includes(f));
      },
      confirmInput(site) {
        let input = this.mods[site.id].input;
        // add entry to beginning of history
        this.history = this.history.filter(h => h !== input);
        this.history.unshift(input);
        if (input) {
          this.receiver.addLog(site, {
            type: 'eval_input',
            args: [input],
            id: Date.now()
          });
          this.receiver.socket.send(JSON.stringify({
            code: 'eval',
            target: site.id,
            content: input
          }));
          this.mods[site.id].input = '';
          this.mods[site.id].index = -1;
        }
      },
      clearSite(site) {
        site.logs = [];
      },
      removeSite(site) {
        let sites = this.receiver.sites;
        sites.splice(sites.indexOf(site), 1);
      },
      moveHistory(amount, id) {
        let site = this.mods[id];
        if (site.index === -1 && amount === 1) {
          site.cachedInput = site.input;
        }
        site.index = Math.min(Math.max(site.index + amount, -1), this.history.length - 1);
        console.log(site.index, this.history);
        if (site.index === -1) {
          site.input = site.cachedInput;
        } else {
          site.input = this.history[site.index];
        }
      }
    }
  })
})();

