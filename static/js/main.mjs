import ConsoleReceiver from './receiver.mjs';

import App from './app.mjs';

import Application from '/assets/components/Application.mjs';
import JSObject from '/assets/components/JSObject.mjs';
import Log from '/assets/components/Log.mjs';

Vue.component('application', Application);
Vue.component('js-object', JSObject);
Vue.component('log', Log);

const receiver = new ConsoleReceiver();

window.receiver = receiver;
window.send = function (code) {
  receiver.socket.send(JSON.stringify({
    code: 'eval',
    content: code
  }));
}

const app = new Vue(App);