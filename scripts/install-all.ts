import fs from 'node:fs/promises';

const packages = await fs.readdir(`${import.meta.dir}/../packages`);

for (const pkg of packages) {
  await Bun.spawn(['bun', 'install'], {
    cwd: `${import.meta.url}/../packages/${pkg}`,
  }).exited;
}
