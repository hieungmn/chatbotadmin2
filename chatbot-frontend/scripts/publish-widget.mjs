import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(frontendRoot, 'dist/chatbot-widget.js');
const destinationDirectory = resolve(frontendRoot, '../chatbot-backend/public/static');
await mkdir(destinationDirectory, { recursive: true });
await copyFile(source, resolve(destinationDirectory, 'chatbot-widget.js'));
console.log('Widget bundle published to backend /static/chatbot-widget.js');
