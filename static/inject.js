class ConsoleInterceptor {
  constructor() {
    this.backlog = [];
    this.funcs = {};
    this.socket = null;
    this.open = false;

    this.intercept();
    this.setupSocket();

    this.int = setInterval(this.interval.bind(this), 1000);
  }

  interval() {
    if (this.socket) {
      try {
        this.socket.send("heartbeat");
      } catch (err) {

      }
    }
  }

  intercept() {
    for (const funcName in console) {
      if (typeof console[funcName] === 'function') {
        this.funcs[funcName] = console[funcName];
        console[funcName] = (...args) => {
          this.funcs[funcName](...args);
          this.backlog.push({ code: 'log', log: { type: funcName, args }, host: window.location.hostname, timestamp: Date.now() });
          this.update();
        }
      }
    }
  }

  setupSocket() {
    this.socket = new WebSocket('wss://intercept:1337/ws/site');
    this.socket.onopen = this.wsOpen.bind(this);
    this.socket.onerror = this.wsError.bind(this);
    this.socket.onclose = this.wsClose.bind(this);
    this.socket.onmessage = this.wsMessage.bind(this);
  }

  wsOpen(event) {
    this.funcs.log('Console Interceptor: ws connected');
    this.open = true;
    this.update();
  }

  wsError(err) {
    this.funcs.error('Console Interceptor: ws error: ' + err);
  }

  wsClose(event) {
    this.funcs.log('Console Interceptor: ws closed, retrying in 5s');
    this.socket = null;
    this.open = false;
    setTimeout(this.setupSocket.bind(this), 5000);
  }

  wsMessage(message) {
    const msg = JSON.parse(message.data);
    this.funcs.log('WS MESSAGE!!!', msg);
    switch (msg.code) {
      case 'eval': {
        const res = eval(msg.content);
        this.backlog.push({ code: 'eval_response', content: res });
        this.update();
        break;
      }
    }
  }

  update() {
    if (this.socket && this.open) {
      for (const log of this.backlog) {
        this.socket.send(JSON.stringify(log));
      }
      this.backlog = [];
    }
  }
}
const interceptor = new ConsoleInterceptor();

if (window.Granify) {
  Granify('setDebugLogging', true);
}