import {copyFileSync, cpSync, mkdirSync, writeFileSync} from 'node:fs';

const output = 'dist-launch';
copyFileSync(output + '/mint.html', output + '/index.html');
for (const directory of ['fonts', 'art/found']) {
 mkdirSync(output + '/' + directory, {recursive:true});
 cpSync('public/' + directory, output + '/' + directory, {recursive:true});
}
mkdirSync(output + '/brand', {recursive:true});
copyFileSync('public/brand/dorks-wordmark.svg', output + '/brand/dorks-wordmark.svg');

if (process.env.DORKS_API_ORIGIN) {
 const target = new URL(process.env.DORKS_API_ORIGIN);
 if (target.protocol !== 'https:' || target.origin !== process.env.DORKS_API_ORIGIN) {
  throw new Error('Set DORKS_API_ORIGIN to the HTTPS origin of the DORKS backend.');
 }
 writeFileSync(output + '/_redirects', `/api/* ${target.origin}/api/:splat 200!\n`);
}
