import {copyFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';

const output = 'dist-launch';
renameSync(output + '/index.html', output + '/play.html');
copyFileSync(output + '/mint.html', output + '/index.html');
rmSync(output + '/hand-lab.html', {force:true});

if (process.env.DORKS_API_ORIGIN) {
 const target = new URL(process.env.DORKS_API_ORIGIN);
 if (target.protocol !== 'https:' || target.origin !== process.env.DORKS_API_ORIGIN) {
  throw new Error('Set DORKS_API_ORIGIN to the HTTPS origin of the DORKS backend.');
 }
 writeFileSync(output + '/_redirects', `/api/* ${target.origin}/api/:splat 200!\n`);
}
