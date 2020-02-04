"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var ConsoleInterceptor =
/*#__PURE__*/
function () {
  function ConsoleInterceptor() {
    _classCallCheck(this, ConsoleInterceptor);

    if (!('toJSON' in Error.prototype)) Object.defineProperty(Error.prototype, 'toJSON', {
      value: function value() {
        var alt = {
          _interceptClass: 'error'
        };
        Object.getOwnPropertyNames(this).forEach(function (key) {
          alt[key] = this[key];
        }, this);
        return alt;
      },
      configurable: true,
      writable: true
    });
    this.backlog = [];
    this.funcs = {};
    this.socket = null;
    this.open = false;
    this.intercept();
    this.setupSocket();
    this["int"] = setInterval(this.interval.bind(this), 1000);
  }

  _createClass(ConsoleInterceptor, [{
    key: "interval",
    value: function interval() {
      if (this.socket) {
        try {
          this.socket.send("heartbeat");
        } catch (err) {}
      }
    }
  }, {
    key: "intercept",
    value: function intercept() {
      var _this = this;

      var _loop = function _loop(funcName) {
        if (typeof console[funcName] === 'function') {
          _this.funcs[funcName] = console[funcName];

          console[funcName] = function () {
            var _this$funcs;

            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
            }

            (_this$funcs = _this.funcs)[funcName].apply(_this$funcs, args);

            _this.backlog.push({
              code: 'log',
              log: {
                type: funcName,
                args: args
              },
              host: window.location.hostname,
              href: window.location.href,
              timestamp: Date.now()
            });

            _this.update();
          };
        }
      };

      for (var funcName in console) {
        _loop(funcName);
      }
    }
  }, {
    key: "setupSocket",
    value: function setupSocket() {
      this.socket = new WebSocket('wss://intercept:1337/ws/site');
      this.socket.onopen = this.wsOpen.bind(this);
      this.socket.onerror = this.wsError.bind(this);
      this.socket.onclose = this.wsClose.bind(this);
      this.socket.onmessage = this.wsMessage.bind(this);
    }
  }, {
    key: "wsOpen",
    value: function wsOpen(event) {
      this.funcs.log('Console Interceptor: ws connected');
      this.open = true;
      this.update();
    }
  }, {
    key: "wsError",
    value: function wsError(err) {
      this.funcs.error('Console Interceptor: ws error: ' + err);
    }
  }, {
    key: "wsClose",
    value: function wsClose(event) {
      this.funcs.log('Console Interceptor: ws closed, retrying in 5s');
      this.socket = null;
      this.open = false;
      setTimeout(this.setupSocket.bind(this), 5000);
    }
  }, {
    key: "wsMessage",
    value: function wsMessage(message) {
      var msg = JSON.parse(message.data);

      switch (msg.code) {
        case 'eval':
          {
            var res;

            try {
              res = eval(msg.content);
            } catch (err) {
              res = err;
            }

            this.backlog.push({
              code: 'eval_response',
              content: res
            });
            this.update();
            break;
          }
      }
    }
  }, {
    key: "update",
    value: function update() {
      if (this.socket && this.open) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = this.backlog[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var log = _step.value;
            this.socket.send(JSON.stringify(log));
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator["return"] != null) {
              _iterator["return"]();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        this.backlog = [];
      }
    }
  }]);

  return ConsoleInterceptor;
}();

var interceptor = new ConsoleInterceptor();
