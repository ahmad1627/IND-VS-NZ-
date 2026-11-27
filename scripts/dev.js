/** Start both local servers without shell quoting or orphan npm processes. */
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const net=require('node:net');
const root=path.resolve(__dirname,'..');
const backendPort=Number(process.env.PORT||5000),frontendPort=5173;
const vite=path.join(root,'frontend/node_modules/vite/bin/vite.js');
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();process.exitCode=code;}
function free(port){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(Error(`Port ${port} is already in use. Stop your previous project terminals with Ctrl+C, then run npm run dev again.`)));server.listen(port,'127.0.0.1',()=>server.close(resolve));});}
function run(label,args,options){const child=spawn(process.execPath,args,{stdio:'inherit',...options});children.push(child);child.once('error',e=>{console.error(`${label} could not start: ${e.message}`);stop(1);});child.once('exit',code=>{if(!stopping){console.error(`${label} stopped (exit ${code}). Both development servers are stopping.`);stop(code||1);}});}
async function main(){
 if(!Number.isInteger(backendPort)||backendPort<1||backendPort>65535||backendPort===frontendPort)throw Error('PORT must be a valid backend port different from 5173. Default: 5000.');
 if(process.env.NODE_ENV!=='test'&&!fs.existsSync(path.join(root,'.env.local')))throw Error('Local setup is missing. For a NEW installation run npm run setup:local. For an existing installation restore your previous .env.local and api/data/localhost.json.');
 if(!fs.existsSync(vite))throw Error('Install dependencies first: npm ci and npm --prefix frontend ci');
 await Promise.all([free(backendPort),free(frontendPort)]);
 console.log(`Starting Pakistan A vs Sri Lanka A Fantasy\nOpen in Chrome or Edge: http://127.0.0.1:${frontendPort}\nBackend: http://127.0.0.1:${backendPort}\nKeep this terminal open. Ctrl+C stops both servers.`);
 run('Backend',[path.join(root,'backend/server.js'),'--local'],{cwd:root,env:{...process.env,PORT:String(backendPort)}});
 run('Frontend',[vite,'--host','127.0.0.1','--port',String(frontendPort),'--strictPort'],{cwd:path.join(root,'frontend'),env:{...process.env,FANTASY_DEV_API_TARGET:`http://127.0.0.1:${backendPort}`}});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
main().catch(e=>{console.error(`\nStartup error: ${e.message}`);stop(1);});
