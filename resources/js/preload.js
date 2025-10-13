// Expose protected Neutralino methods
window.openExternal = async (url) => {
    try {
        await Neutralino.os.open(url);
    } catch (error) {
        console.error('Failed to open external URL:', error);
    }
};

// Initialize Neutralino
Neutralino.init();
