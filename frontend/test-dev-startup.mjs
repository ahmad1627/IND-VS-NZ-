// Exercise Vite's real development transformation, not only the production build.
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const server=await createServer({root,server:{port:0,strictPort:false,host:'127.0.0.1'}});
try{
 await server.listen();const port=server.httpServer.address().port;
 const text=await(await fetch(`http://127.0.0.1:${port}/src/App.jsx`)).text();
 const reactLine=text.split('\n').find(l=>l.includes('const React ='));
 assert.ok(reactLine,'Actual optimized React interop initialization is present');
 const lazyLine=text.split('\n').find(l=>l.startsWith('const EngagementHub ='));
 assert.ok(lazyLine,'Lazy hub initialization is present');
 const binding=reactLine.match(/import (\w+) from/)[1];
 const script=[{at:text.indexOf(reactLine),line:reactLine.replace(/^import [^;]+;/,'')},{at:text.indexOf(lazyLine),line:lazyLine}].sort((a,b)=>a.at-b.at).map(x=>x.line).join('\n');
 vm.runInNewContext(script,{[binding]:{lazy:fn=>({load:fn})}});
 console.log('PASS: actual Vite dev module initializes React before lazy feature components (no temporal-dead-zone startup crash).');
// Let Vite finish import crawling before shutting down its optimizer.
}finally{await server.waitForRequestsIdle();await server.close();}
