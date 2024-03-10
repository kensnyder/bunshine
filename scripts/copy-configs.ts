import fs from 'node:fs/promises';

const files = await fs.readdir(`${import.meta.dir}/../templates`);
const packages = await fs.readdir(`${import.meta.dir}/../packages`);

for (const pkg of packages) {
  for (const file of files) {
    const src = `${import.meta.dir}/../templates/${file}`;
    const dest = `${import.meta.dir}/../packages/${pkg}/${file}`;
    await fs.copyFile(src, dest);
    console.log(`Copied templates/${file} to packages/${pkg}`);
  }
}

console.log('Done copying files.');
