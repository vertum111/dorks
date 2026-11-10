import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dragons, frontImage} from '../src/cap-catalog.js';

mkdirSync('public/art/album', {recursive: true});
for (const cap of dragons) {
 const framing = cap.sprite
  ? ['-thumbnail', '144x144', '-background', 'none', '-gravity', 'center', '-extent', '192x192']
  : ['-thumbnail', '192x192^', '-gravity', 'center', '-extent', '192x192'];
 execFileSync('magick', [
  'public' + frontImage(cap), ...framing, '-strip',
  '-quality', '84', `public/art/album/${cap.id}.webp`,
 ]);
}
