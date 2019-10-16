const { app, BrowserWindow } = require('electron');

const server = require('./server.js');

const PORT = 1337;

const webServer = server(PORT);
let window;

function createWindow() {
  window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    show: false
  });

  window.maximize();

  window.on('closed', () => {
    window = null;
  });

  window.once('ready-to-show', () => { window.show(); });

  window.loadURL(`https://intercept:${PORT}`);
}

app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});
