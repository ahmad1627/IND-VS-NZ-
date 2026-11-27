const router=require('express').Router();
const {randomBytes,randomUUID}=require('crypto');
const db=require('./database');
const {authMiddleware}=require('./auth');
const {deadline,text}=require('./validation');
const composition=require('./teamComposition');
const E=require('./engagement');
router.use(authMiddleware);
router.use((req,res,next)=>{if(req.user.is_removed)return res.status(403).json({detail:'Account unavailable.'});next();});
function match(req){const m=db.getMatchById(req.query.match_id??req.body?.match_id);if(!m)throw Object.assign(Error('Match not found.'),{status:404});return m;}
function poll(m,id){const votes=Object.values(E.state(db).votes[m.id]||{}).filter(v=>db.getUserById(v.user_id)&&!db.getUserById(v.user_id).is_removed),counts=Object.fromEntries([m.team_a,m.team_b].map(t=>[t,votes.filter(v=>v.choice===t).length]));return {closed:deadline(m),cutoff:m.booster_locked_at||m.match_date,total:votes.length,counts,choice:E.state(db).votes[m.id]?.[id]?.choice||null,winner:m.status==='COMPLETED'?m.winner_team:null,result:m.status==='COMPLETED'?m.result:null};}
router.get('/overview',(req,res)=>{
 const m=match(req);E.recordMatch(db,m);
 const t=db.getFantasyTeam(req.user.id,m.id);
 res.json({server_time:new Date().toISOString(),match:{id:m.id,title:m.title,match_date:m.match_date,locked:deadline(m),status:m.status,team_a:m.team_a,team_b:m.team_b},managers:E.ranked(db,m),poll:poll(m,req.user.id),my_team:t?E.teamDetail(db,t,req.user):null,profile:E.profile(db,req.user,req.user)});
});
router.get('/players',(req,res)=>res.json({players:E.playerAnalytics(db),popularity:E.popularity(db,match(req))}));
router.get('/dream',(req,res)=>res.json({dream:E.dreamTeam(db,match(req))}));
router.get('/compare',(req,res)=>{
 const m=match(req),ids=[Number(req.query.left),Number(req.query.right)];
 if(ids[0]===ids[1])return res.status(400).json({detail:'Choose two different managers.'});
 const teams=ids.map(id=>E.validTeams(db,m).find(t=>t.id===id));if(teams.some(t=>!t))return res.status(404).json({detail:'Saved registered teams are required.'});
 const [left,right]=teams.map(t=>E.teamDetail(db,t,req.user));
 res.json({left,right,common:left.players.filter(p=>right.players.some(q=>q.id===p.id)).map(p=>p.id),winner:m.status!=='COMPLETED'?null:left.points===right.points?'Tie':left.points>right.points?left.name:right.name});
});
router.get('/share',(req,res)=>{const m=match(req),t=db.getFantasyTeam(req.user.id,m.id);if(!t)return res.status(404).json({detail:'Save a team first.'});res.json(E.teamDetail(db,t,req.user,{sharing:true}));});
router.get('/profile/:id',(req,res)=>{const u=db.getUserById(req.params.id);if(!u||u.is_removed)return res.status(404).json({detail:'Manager not found.'});res.json(E.profile(db,u,req.user));});
router.post('/preferences',(req,res)=>{if(typeof req.body.public_profile!=='boolean')return res.status(400).json({detail:'Choose a profile privacy setting.'});E.state(db).preferences[req.user.id]={public_profile:req.body.public_profile};res.json({saved:true});});
router.post('/celebrations/claim',(req,res)=>{
 // Claim under the existing transaction BEFORE animation: refresh/multiple tabs cannot replay it.
 const p=E.profile(db,req.user,req.user),ids=p.pending_celebrations,seen=E.state(db).seen;
 seen[req.user.id]=[...new Set([...(seen[req.user.id]||[]),...ids])];
 res.json({events:p.activity.filter(a=>ids.includes(a.id))});
});
router.post('/predictions',(req,res)=>{
 const m=match(req);if(deadline(m))return res.status(409).json({detail:'Predictions closed at the official lineup deadline.'});
 if(![m.team_a,m.team_b].includes(req.body.choice))return res.status(400).json({detail:'Choose a competing team.'});
 const votes=E.state(db).votes[m.id] ||= {},old=votes[req.user.id];
 if(old&&old.choice!==req.body.choice)return res.status(409).json({detail:'Your one prediction is already recorded.'});
 votes[req.user.id] ||= {user_id:req.user.id,choice:req.body.choice,at:new Date().toISOString()};res.json(poll(m,req.user.id));
});
router.get('/weekly',(req,res)=>{let date=Date.now();if(req.query.week){date=Date.parse(req.query.week);if(!Number.isFinite(date))return res.status(400).json({detail:'Invalid week date.'});}res.json(E.weekly(db,date));});
router.get('/boosters',(req,res)=>{
 const uses=db.powerBoosterUses.filter(u=>u.user_id===req.user.id);
 res.json({boosters:['3X'].map(role=>{const u=uses.find(u=>u.role===role),m=u?db.getMatchById(u.match_id):null,t=u?db.getFantasyTeam(req.user.id,u.match_id):null;
 return {role,status:!u?'Available':m?.status==='COMPLETED'?'Expired (consumed)':u.consumed_at||deadline(m)?'Consumed · active for match':'Reserved',match:m?.title||null,applied_at:u?.applied_at||null,points:t&&m?.status==='COMPLETED'?E.teamDetail(db,t,req.user).breakdown.booster_extra:null};})});
});
router.post('/validate',(req,res)=>{
 const m=match(req),b=req.body,ids=b.player_ids,errors=[];
 if(!Array.isArray(ids)||ids.length!==11||new Set(ids).size!==11||ids.some(id=>!Number.isSafeInteger(id))){errors.push('Choose exactly 11 distinct eligible players.');}
 else {const error=composition(db,m,ids);if(error)errors.push(error.detail);}
 if(!Array.isArray(ids)||!ids.includes(b.captain_id)||!ids.includes(b.vice_captain_id)||b.captain_id===b.vice_captain_id)errors.push('Choose different captain and vice-captain from your XI.');
 const use=db.powerBoosterUses.find(u=>u.user_id===req.user.id&&u.match_id===m.id);
 if(use?.role==='3X'&&(!ids?.includes(use.player_id)||[b.captain_id,b.vice_captain_id].includes(use.player_id)))errors.push('Keep your reserved 3X player in the XI, separate from captain and vice-captain.');
 if(deadline(m)||!m.is_active||m.team_selection_disabled)errors.push('This fixture is not open for team submission.');
 res.json({valid:errors.length===0,errors,locked:deadline(m),count:Array.isArray(ids)?ids.length:0});
});
router.get('/leagues',(req,res)=>res.json({leagues:E.state(db).leagues.filter(l=>l.members.some(m=>m.user_id===req.user.id)).map(l=>E.leagueView(db,l,req.user))}));
router.post('/leagues',(req,res)=>{
 const name=text(req.body.name,'League name',3,60),leagues=E.state(db).leagues;
 const existing=leagues.find(l=>l.owner_id===req.user.id&&l.name.toLowerCase()===name.toLowerCase());if(existing)return res.json(E.leagueView(db,existing,req.user));
 if(leagues.filter(l=>l.owner_id===req.user.id).length>=10)return res.status(400).json({detail:'You can own at most 10 leagues.'});
 const at=new Date().toISOString();let code;do{code=randomBytes(6).toString('hex').toUpperCase();}while(leagues.some(l=>l.invite_code===code));
 const l={id:randomUUID(),owner_id:req.user.id,name,invite_code:code,created_at:at,members:[{user_id:req.user.id,joined_at:at}]};leagues.push(l);res.json(E.leagueView(db,l,req.user));
});
router.post('/leagues/join',(req,res)=>{
 const code=text(req.body.code,'Invite code',12,12).toUpperCase(),l=E.state(db).leagues.find(l=>l.invite_code===code);if(!l)return res.status(404).json({detail:'Invite code not found.'});
 if(!l.members.some(m=>m.user_id===req.user.id))l.members.push({user_id:req.user.id,joined_at:new Date().toISOString()});res.json(E.leagueView(db,l,req.user));
});
module.exports=router;
