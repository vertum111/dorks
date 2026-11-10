import http from 'node:http';
import {matchApi} from './match-server.mjs';
import {foundApi} from './found-api.mjs';
import {nearOwnershipGate} from './found-ownership.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.json':'application/json','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const api=matchApi({siteOrigin:process.env.DORKS_SITE_ORIGIN,gate:nearOwnershipGate()});
const found=foundApi();
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/healthz'){res.end('ok');return;}
 if(await found(req,res,url)||await api(req,res,url))return;
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad request');return;}
 const target=path.resolve(root,'.'+(['/','/play','/play/'].includes(pathname)?'/index.html':pathname==='/mint'||pathname==='/mint/'?'/mint.html':pathname));
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
 fs.stat(target,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(target).pipe(res);});
});
const managedPort=process.env.PORT;
const host=managedPort?'0.0.0.0':'127.0.0.1';
let port=Number(managedPort||4173);
server.on('error',err=>{if(!managedPort&&err.code==='EADDRINUSE'&&port<4183){server.listen(++port,host);}else{console.error(err.message);process.exitCode=1;}});
server.on('listening',()=>{const url=`http://127.0.0.1:${port}`;console.log(`\nDORKS is ready: ${url}\nKeep this terminal open. Ctrl+C stops the game server.\n`);if(process.argv.includes('--open'))spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'}).on('error',()=>{});});
server.listen(port,host);
