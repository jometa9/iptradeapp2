// Initialize Neutralino
Neutralino.init();

// Enable drag for the window
Neutralino.window.setDraggable();

// Create global function for opening external links
window.openExternal = async url => {
  try {
    console.log('Attempting to open URL:', url);
    console.log('Operating System:', NL_OS);

    let command;
    // Usar comandos específicos del sistema operativo para abrir en el navegador predeterminado
    if (NL_OS === 'Windows') {
      // En Windows, usamos cmd /c start para asegurarnos de que se abra en el navegador predeterminado
      command = `cmd /c start "" "${url}"`;
    } else if (NL_OS === 'Darwin') {
      // macOS
      command = `open "${url}"`;
    } else {
      // Linux
      command = `xdg-open "${url}"`;
    }

    console.log('Executing command:', command);

    const result = await Neutralino.os.execCommand(command, {
      shouldRunInBackground: true, // Importante para Windows
    });

    console.log('Command result:', result);

    // Si el comando falla, intentar con el método alternativo
    if (!result || result.exitCode !== 0) {
      console.log('Command failed, trying alternative method...');

      // Método alternativo usando shell.openExternal
      if (NL_OS === 'Windows') {
        await Neutralino.os.execCommand(`explorer "${url}"`, {
          shouldRunInBackground: true,
        });
      } else {
        await Neutralino.os.open(url);
      }
    }

    return true;
  } catch (error) {
    console.error('Error opening external link:', error);

    // Último intento usando window.open
    try {
      console.log('Attempting final fallback with window.open...');
      window.open(url, '_system', 'noopener,noreferrer');
      return true;
    } catch (finalError) {
      console.error('All attempts to open URL failed:', finalError);
      return false;
    }
  }
};

async function startApplication() {
  try {
    // Start the backend server
    const result = await Neutralino.os.execCommand('node server/src/dev.js', {
      background: true,
    });
    console.log('Backend server started:', result);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load the frontend URL
    await Neutralino.window.loadURL('http://localhost:31000');

    // Add message handler for external links
    window.addEventListener('message', async event => {
      if (event.data.type === 'openExternal') {
        await window.openExternal(event.data.url);
      }
    });

    // Handle deep linking on startup
    Neutralino.events.on('urlSchemeAccess', evt => {
      handleDeepLink(evt.url);
    });
  } catch (error) {
    console.error('Error starting application:', error);
    await Neutralino.debug.log('Failed to start application: ' + error.toString());
  }
}

// Handle deep linking
async function handleDeepLink(url) {
  try {
    if (url.startsWith('iptrade://')) {
      // Extract token or necessary information from URL
      const params = new URLSearchParams(url.replace('iptrade://', ''));
      // Send information to frontend
      await Neutralino.window.postMessage({
        type: 'auth-callback',
        data: Object.fromEntries(params),
      });
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
  }
}

// Handle window close
Neutralino.events.on('windowClose', async () => {
  try {
    // Kill any running processes
    if (NL_OS === 'Windows') {
      await Neutralino.os.execCommand('taskkill /F /IM node.exe');
    } else {
      await Neutralino.os.execCommand('pkill -f "node server/src/dev.js"');
      await Neutralino.os.execCommand('pkill -f "vite"');
    }
  } catch (error) {
    console.error('Error cleaning up:', error);
  }
  Neutralino.app.exit();
});

// Start the application
startApplication();
