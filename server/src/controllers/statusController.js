import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getVersion = () => {
  try {
    const packageJsonPath = join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('Error reading version from package.json:', error);
    return '1.0.0';
  }
};

export const getStatus = (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    version: getVersion(),
  });
};
