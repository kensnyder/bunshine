#!/usr/bin/env bun

import fs from 'fs/promises';
import { devLogger, HttpRouter, prodLogger, serveFiles } from '../index.ts';

const folder = Bun.argv[2] || process.cwd();

if (!(await fs.exists(folder))) {
  console.error(`Folder "${folder}" does not exist.`);
  process.exit(1);
}

const app = new HttpRouter();
app.use(Bun.env.NODE_ENV === 'production' ? prodLogger() : devLogger());
app.headGet(
  '*',
  serveFiles(folder, {
    index: ['index.html'],
  })
);
app.enableGracefulShutdown();
app.listen();

console.log(`☀️ Bunshine serving static files at ${app.server!.url}`);
