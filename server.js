import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.get('/api/health', (_request, response) => response.json({ ready: true }));
app.get('/api/utilities', async (_request, response, next) => {
  try {
    const directory = await readFile(path.join(here, 'src', 'data', 'utilities.json'), 'utf8');
    response.type('json').send(directory);
  } catch (error) {
    next(error);
  }
});
app.use(express.static(path.join(here, 'public')));
app.get('*splat', (_request, response) => response.sendFile(path.join(here, 'public', 'index.html')));

app.listen(port, '0.0.0.0', () => {
  console.log(`CitizenWater is running at http://localhost:${port}`);
});
