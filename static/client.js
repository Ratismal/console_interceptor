(function () {
  class ConsoleReceiver {
    constructor() {
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
      switch (msg.code) {
        case 'log': {
          const log = msg.log;
          console[log.type](...log.args);
          break;
        }
        case 'eval_response': {
          console.log(msg.content);
          break;
        }
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

