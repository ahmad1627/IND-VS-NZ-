// Local-only Python adapter. Runs outside game-state persistence and Redis locks.
const {spawn} = require('node:child_process');
const path = require('node:path');
let running = 0;
module.exports = (req,res) => {
  if (process.env.AI_ENABLED === 'false' || process.env.VERCEL || running >= 2) return res.status(503).json({detail:'AI assistant is unavailable. Manual selection still works.'});
  const payload = JSON.stringify(req.body || {});
  if (Buffer.byteLength(payload) > 32768) return res.status(413).json({detail:'AI request too large.'});
  running++;
  let output='', done=false;
  const child = spawn(process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(__dirname,'../ai_recommend.py')], {stdio:['pipe','pipe','ignore'], windowsHide:true, env:Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|HOME|USERPROFILE|TEMP|TMP|LANG|LC_ALL)$/i.test(key)))});
  const finish=(code,body)=>{if(done)return;done=true;clearTimeout(timer);running--;if(!res.destroyed)res.status(code).json(body);};
  const timer=setTimeout(()=>{child.kill();finish(503,{detail:'AI timed out. Try again or continue manually.'});},3500);
  child.stdout.on('data',data=>{output+=data; if(output.length>262144){child.kill();finish(503,{detail:'Invalid AI response.'});}});
  child.stdin.on('error',()=>{});
  child.on('error',()=>finish(503,{detail:'Python is unavailable. Install Python 3 or set PYTHON_COMMAND.'}));
  child.on('close',code=>{try{finish(code===0?200:400,JSON.parse(output));}catch{finish(503,{detail:'AI unavailable. Continue manually.'});}});
  res.on('close',()=>{if(!done){child.kill();finish(503,{detail:'Request closed.'});}});
  child.stdin.end(payload);
};
