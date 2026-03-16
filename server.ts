import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import app from './server/app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

// Serve Vite build output
app.use(express.static(distPath));

// SPA fallback: all non-API routes serve index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Peinture server running on http://localhost:${port}`);
});
