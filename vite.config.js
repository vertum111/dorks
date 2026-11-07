import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

const launchOnly = process.env.VITE_DORKS_LAUNCH_ONLY === '1';
const page = name => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
 build: {
  copyPublicDir: !launchOnly,
  rollupOptions: {input: launchOnly ? {mint:page('./mint.html')} : {
   game:page('./index.html'), mint:page('./mint.html'), handLab:page('./hand-lab.html'),
  }},
 },
});
