const { app, BrowserWindow, shell } = require('electron');

const server = require('./server.js');
const path = require('path');
const fs = require('fs');

const PORT = 1337;

const baseDir = path.join(app.getPath('documents'), 'ConsoleInterceptor');
const certDir = path.join(baseDir, 'cert');
const fileDir = path.join(baseDir, 'files');
const ISSUE_PAGE = fs.readFileSync(path.join('resources', 'issue.html'), { encoding: 'utf8' });


function createDirectory(name) {
  try {
    fs.mkdirSync(name);
  } catch { }
}

try {
  createDirectory(baseDir);
  createDirectory(certDir);
  createDirectory(fileDir);
  const files = fs.readdirSync('cert');
  for (const file of files) {
    try {
      fs.writeFileSync(path.join(certDir, file), fs.readFileSync(path.join('cert', file)));
    } catch { }
  }
} catch { }

let webServer;
let page;

try {
  webServer = new server({
    port: 1337,
    certDir,
    fileDir,
    resourceDir: 'resources'
  });
} catch (err) {
  page = ISSUE_PAGE.replace('<%MESSAGE%>', `<h2>Certificates could not be loaded.</h2>

  <p>Please ensure that your certificates exist and are installed correctly.</p>
  <p>Certificate path: <code>${certDir}</code></p>
  <p>Refer to the readme file for more details.</p>
`);
  shell.openItem(certDir);
}
let window;

function createWindow() {
  window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
  });

  window.maximize();

  window.on('closed', () => {
    window = null;
  });
  if (webServer) {
    window.loadURL(`https://intercept:${PORT}`);
  } else {
    window.loadURL('data:text/html;charset=utf-8,' + encodeURI(page));
  }
}

app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
    process.exit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});
