import { FlexLayout, QLabel, QMainWindow, QWebEngineView, QWidget } from '@nodegui/nodegui';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the main window
const win = new QMainWindow();
win.setWindowTitle('IPTRADE');
win.resize(1200, 800);

// Create central widget and layout
const centralWidget = new QWidget();
centralWidget.setObjectName('myroot');
const rootLayout = new FlexLayout();
centralWidget.setLayout(rootLayout);

// Create status label
const statusLabel = new QLabel();
statusLabel.setText('Iniciando servicios...');
rootLayout.addWidget(statusLabel);

// Create web view for the frontend
const webView = new QWebEngineView();
webView.setObjectName('webview');

// Enable dev tools in development
webView.page().profile().setDevToolsEnabled(true);

// Configure web preferences
const settings = webView.settings();
settings.setAttribute('JavascriptEnabled', true);
settings.setAttribute('LocalStorageEnabled', true);
settings.setAttribute('WebGLEnabled', true);
settings.setAttribute('WebSocketsEnabled', true);
settings.setAttribute('NavigatorQtObjectEnabled', true);

rootLayout.addWidget(webView);

win.setCentralWidget(centralWidget);
win.show();

// Start the server and frontend
async function startApplication() {
  try {
    // Start the server process
    const serverProcess = spawn('node', ['server/src/dev.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    serverProcess.on('error', err => {
      statusLabel.setText(`Error al iniciar el servidor: ${err.message}`);
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start Vite development server
    const viteProcess = spawn('npm', ['run', 'dev:frontend'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    viteProcess.on('error', err => {
      statusLabel.setText(`Error al iniciar el frontend: ${err.message}`);
    });

    // Wait for frontend to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load the frontend in the web view
    webView.load('http://localhost:31000');

    // Monitor page load status
    webView.addEventListener('loadFinished', success => {
      if (success) {
        statusLabel.setText('Aplicación iniciada correctamente');
      } else {
        statusLabel.setText('Error al cargar la interfaz');
      }
    });

    // Handle application shutdown
    win.addEventListener('close', () => {
      serverProcess.kill();
      viteProcess.kill();
      process.exit(0);
    });
  } catch (error) {
    statusLabel.setText(`Error: ${error.message}`);
  }
}

// Add some basic styling
const styleSheet = `
  #myroot {
    background-color: #ffffff;
    height: '100%';
    flex-direction: column;
  }
  #webview {
    flex: 1;
    min-height: 600px;
  }
  QLabel {
    font-size: 14px;
    margin: 8px;
    color: #333333;
  }
`;

win.setStyleSheet(styleSheet);

// Start the application
startApplication();
