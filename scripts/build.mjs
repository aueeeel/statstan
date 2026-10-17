import { cp, mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'check.html', 'styles.css', 'app.js', 'config.js', 'favicon.svg']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true });
console.log('Built Forte Vision → dist/');
