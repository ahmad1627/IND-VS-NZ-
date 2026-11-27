/** Analytics only: authoritative scoring, lineups and lock rules remain in the game. */
const {createHash}=require('crypto');
const {deadline}=require('./validation');
const {playerMultiplier}=require('./scoringEngine');
const composition=require('./teamComposition');
const round=n=>Math.round(n*10)/10;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function state(db){return db.engagement_v1 ||= {version:1,snapshots:{},votes:{},leagues:[],preferences:{},awards:{},seen:{}};}
function validTeams(db,m){
 const users=new Map(db.users.map(u=>[u.id,u])),seen=new Set();
 return db.getFantasyTeamsByMatch(m.id).filter(t=>{const u=users.get(t.user_id);return u&&!u.is_removed&&!u.email?.toLowerCase().startsWith('test.manager.')&&Array.isArray(t.player_ids)&&t.player_ids.length===11&&new Set(t.player_ids).size===11&&t.player_ids.includes(t.captain_id)&&t.player_ids.includes(t.vice_captain_id)&&t.captain_id!==t.vice_captain_id;}).sort((a,b)=>b.total_points-a.total_points||a.id-b.id).filter(t=>{const key=users.get(t.user_id).email?.toLowerCase().trim()||String(t.user_id);if(seen.has(key))return false;seen.add(key);return true;});
}
function ranked(db,m){let previous,rank;return validTeams(db,m).map((t,i)=>{if(t.total_points!==previous)rank=i+1;previous=t.total_points;const u=db.getUserById(t.user_id);return {user_id:u.id,team_id:t.id,name:u.full_name||'Fantasy manager',team_name:u.fantasy_team_name||'Fantasy XI',points:t.total_points,rank};});}
function recordMatch(db,m,supplied){
 const rows=(supplied||ranked(db,m)).map(r=>({user_id:r.user_id,team_id:r.team_id,rank:r.rank,points:r.points??r.total_points}));
 const fingerprint=hash([m.status,m.score_revision||0,rows]),history=state(db).snapshots[m.id] ||= [];
 if(history.at(-1)?.id!==fingerprint){history.push({id:fingerprint,at:new Date().toISOString(),match_id:m.id,status:m.status,revision:m.score_revision||0,rows});const live=history.filter(s=>s.status!=='COMPLETED');if(live.length>100)history.splice(history.indexOf(live[0]),1);}
 return history;
}
function withMovement(db,m,rows){const hs=recordMatch(db,m,rows),prev=hs.at(-2);return rows.map(r=>{const old=prev?.rows.find(x=>x.user_id===r.user_id);return {...r,previous_rank:old?.rank??null,rank_movement:old?old.rank-r.rank:null,rank_recorded_at:hs.at(-1).at};});}
function teamDetail(db,t,viewer,{sharing=false}={}){
 const m=db.getMatchById(t.match_id),u=db.getUserById(t.user_id);
 if(!u||u.is_removed)throw Object.assign(Error('Registered manager not found.'),{status:404});
 if(!deadline(m)&&(sharing||viewer.id!==u.id&&!viewer.is_admin))throw Object.assign(Error('Lineups are private until the official deadline.'),{status:403});
 const stats=new Map(db.getPlayerMatchStats(m.id).map(s=>[s.player_id,s]));
 const players=t.player_ids.map(id=>{const p=db.getPlayerForMatch(id, m.id),s=stats.get(id),base=s?.fantasy_points??0;
 const lead=playerMultiplier(id,p?.role,t.captain_id,t.vice_captain_id,null,null),mult=playerMultiplier(id,p?.role,t.captain_id,t.vice_captain_id,t.booster_id,t.power_booster_role);
 return {id,name:p?.name||'Unavailable player',team:p?.team,role:p?.role,base:s?base:null,captain:id===t.captain_id,vice:id===t.vice_captain_id,multiplier:mult,leadership_extra:round(base*(lead-1)),booster_extra:round(base*(mult-lead)),points:round(base*mult),categories:s?.points_breakdown||null};});
 const breakdown=Object.fromEntries(['playing_xi','batting_total','bowling_total','fielding_total'].map(k=>[k,round(players.reduce((n,p)=>n+(p.categories?.[k]||0),0))]));
 breakdown.captain_extra=round(players.filter(p=>p.captain).reduce((n,p)=>n+p.leadership_extra,0));breakdown.vice_extra=round(players.filter(p=>p.vice).reduce((n,p)=>n+p.leadership_extra,0));breakdown.booster_extra=round(players.reduce((n,p)=>n+p.booster_extra,0));
 breakdown.unclassified=round(t.total_points-Object.values(breakdown).reduce((a,b)=>a+b,0));
 return {team_id:t.id,user_id:u.id,name:u.full_name||'Fantasy manager',team_name:u.fantasy_team_name||'Fantasy XI',match_id:m.id,title:m.title,final:m.status==='COMPLETED',points:t.total_points,rank:ranked(db,m).find(r=>r.user_id===u.id)?.rank??null,booster:t.power_booster_role||null,players,breakdown,reconciled:round(players.reduce((n,p)=>n+p.points,0))===t.total_points,categories_available:players.some(p=>p.categories)};
}
function playerAnalytics(db){
 const complete=new Map(db.matches.filter(m=>m.status==='COMPLETED').map(m=>[m.id,m])),groups=new Map();
 for(const s of db.playerMatchStats)if(complete.has(s.match_id)){if(!groups.has(s.player_id))groups.set(s.player_id,[]);groups.get(s.player_id).push(s);}
 return db.players.map(p=>{const history=(groups.get(p.id)||[]).sort((a,b)=>Date.parse(complete.get(a.match_id).match_date)-Date.parse(complete.get(b.match_id).match_date)).map(s=>({match_id:s.match_id,title:complete.get(s.match_id).title,points:s.fantasy_points,runs:s.runs??null,wickets:s.wickets??null}));
 const values=history.map(s=>s.points),total=round(values.reduce((a,b)=>a+b,0)),avg=values.length?total/values.length:null,sd=avg===null?null:Math.sqrt(values.reduce((n,v)=>n+(v-avg)**2,0)/values.length);
 return {id:p.id,name:p.name,role:p.role,team:p.team,history,total,average:avg===null?null:round(avg),highest:values.length?Math.max(...values):null,consistency:values.length<2?null:round(Math.max(0,100*(1-sd/(Math.abs(avg)||1)))),trend:values.length<2?null:round(values.at(-1)-values.at(-2))};});
}
function popularity(db,m){if(!deadline(m))return {available:false,reason:'Selection percentages unlock at the official deadline.',players:[]};const teams=validTeams(db,m),count=new Map(),cs=new Map(),vs=new Map();for(const t of teams){for(const id of new Set(t.player_ids))count.set(id,(count.get(id)||0)+1);cs.set(t.captain_id,(cs.get(t.captain_id)||0)+1);vs.set(t.vice_captain_id,(vs.get(t.vice_captain_id)||0)+1);}return {available:true,total:teams.length,players:db.getPlayersForMatch(m.id).filter(p=>p.availability_status!=='OUT').map(p=>({id:p.id,name:p.name,role:p.role,percentage:teams.length?round(100*(count.get(p.id)||0)/teams.length):null,captain_percentage:teams.length?round(100*(cs.get(p.id)||0)/teams.length):null,vice_percentage:teams.length?round(100*(vs.get(p.id)||0)/teams.length):null}))};}
const dreamCache=new Map();
function dreamTeam(db,m){
 if(m.status!=='COMPLETED'||!db.getPlayerMatchStats(m.id).length||m.result==='NO_RESULT')return null;
 const stats=new Map(db.getPlayerMatchStats(m.id).map(s=>[s.player_id,s.fantasy_points]));
 const pool=db.getPlayersForMatch(m.id).filter(p=>p.availability_status!=='OUT'&&stats.has(p.id)).sort((a,b)=>a.id-b.id),cacheKey=hash([m.id,pool,Array.from(stats)]);
 if(dreamCache.has(cacheKey))return dreamCache.get(cacheKey);
 // Exact dynamic program: role counts, team A count, captain and vice flags.
 const roles=['WK','BAT','AR','BOWL'],max=[4,6,4,6],min=[1,3,1,3];let states=new Map([['0,0,0,0,0,0,0',{counts:[0,0,0,0,0,0,0],ids:[],score:0,c:null,v:null}]]);
 for(const p of pool){const next=new Map(states),ri=roles.indexOf(p.role);if(ri<0)continue;for(const v of states.values()){
 if(v.ids.length===11||v.counts[ri]>=max[ri])continue;const a=v.counts[4]+Number(p.team===m.team_a),b=v.ids.length+1-a;if(a>7||b>7)continue;
 for(const kind of ['normal','captain','vice']){if(kind==='captain'&&v.c||kind==='vice'&&v.v)continue;const counts=[...v.counts];counts[ri]++;counts[4]=a;if(kind==='captain')counts[5]=1;if(kind==='vice')counts[6]=1;
 const score=round(v.score+stats.get(p.id)*playerMultiplier(p.id,p.role,kind==='captain'?p.id:null,kind==='vice'?p.id:null,null,null)),key=counts.join(',');if(next.has(key)&&next.get(key).score>=score)continue;
 next.set(key,{counts,score,ids:[...v.ids,p.id],c:kind==='captain'?p.id:v.c,v:kind==='vice'?p.id:v.v});}}states=next;}
 let best=null;for(const v of states.values())if(v.ids.length===11&&v.c&&v.v&&min.every((n,i)=>v.counts[i]>=n)&&!composition(db,m,v.ids)&&(!best||v.score>best.score))best=v;
 const result=best?{points:best.score,captain_id:best.c,vice_captain_id:best.v,players:best.ids.map(id=>{const p=db.getPlayerForMatch(id, m.id);return {id,name:p.name,team:p.team,role:p.role,points:stats.get(id)};})}:null;
 if(dreamCache.size>=10)dreamCache.delete(dreamCache.keys().next().value);dreamCache.set(cacheKey,result);return result;
}
function completedRows(db,id){return db.matches.filter(m=>m.status==='COMPLETED').sort((a,b)=>Date.parse(a.match_date)-Date.parse(b.match_date)).map(match=>({match,row:ranked(db,match).find(r=>r.user_id===id)}));}
function streak(items,predicate){let current=0,best=0;for(const x of items){current=predicate(x)?current+1:0;best=Math.max(best,current);}return {current,best};}
function leagueView(db,l,viewer){
 if(!l.members.some(m=>m.user_id===viewer.id))throw Object.assign(Error('This league is private.'),{status:403});const ids=new Set(l.members.filter(m=>db.getUserById(m.user_id)&&!db.getUserById(m.user_id).is_removed).map(m=>m.user_id));
 const history=db.matches.filter(m=>m.status==='COMPLETED'&&Date.parse(m.match_date)>=Date.parse(l.created_at)).map(m=>{const rows=ranked(db,m).filter(r=>ids.has(r.user_id)&&Date.parse(l.members.find(x=>x.user_id===r.user_id).joined_at)<=Date.parse(m.booster_locked_at||m.match_date));let prev,rank;return {match_id:m.id,title:m.title,rows:rows.map((r,i)=>{if(prev!==r.points)rank=i+1;prev=r.points;return {...r,rank};})};});
 const totals=new Map();for(const h of history)for(const r of h.rows){const t=totals.get(r.user_id)||{...r,points:0,played:0,wins:0};t.points=round(t.points+r.points);t.played++;if(r.rank===1&&r.points>0)t.wins++;totals.set(r.user_id,t);}
 let prev,rank;const rows=[...totals.values()].sort((a,b)=>b.points-a.points||a.user_id-b.user_id).map((r,i)=>{if(prev!==r.points)rank=i+1;prev=r.points;return {...r,rank};});
 return {id:l.id,name:l.name,invite_code:l.invite_code,created_at:l.created_at,members:ids.size,rows,history,champions:db.matches.length&&db.matches.every(m=>m.status==='COMPLETED')?rows.filter(r=>r.rank===1&&r.points>0):[],activity:l.members.filter(m=>ids.has(m.user_id)).map(m=>({at:m.joined_at,text:`${db.getUserById(m.user_id).full_name||'A manager'} joined the league.`}))};
}
function profile(db,user,viewer){
 const e=state(db),own=user.id===viewer.id;if(!own&&e.preferences[user.id]?.public_profile!==true)throw Object.assign(Error('This manager’s career profile is private.'),{status:403});
 const completed=completedRows(db,user.id),entries=completed.filter(x=>x.row),ranks=entries.map(x=>x.row.rank),points=entries.map(x=>x.row.points),top10=streak(completed,x=>x.row&&x.row.rank<=10&&x.row.points>0),participation=streak(completed,x=>!!x.row),prediction=streak(completed.filter(x=>x.match.result==='WIN'),x=>e.votes[x.match.id]?.[user.id]?.choice===x.match.winner_team);
 const history=Object.values(e.snapshots).flat().flatMap(s=>{const r=s.rows.find(r=>r.user_id===user.id);return r?[{id:s.id,at:s.at,match_id:s.match_id,title:db.getMatchById(s.match_id)?.title,rank:r.rank,points:r.points,status:s.status}]:[];}).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 let improvement=0,confirmedImprovement=0;for(const hs of Object.values(e.snapshots))for(let i=1;i<hs.length;i++){const a=hs[i-1].rows.find(r=>r.user_id===user.id),b=hs[i].rows.find(r=>r.user_id===user.id);if(a&&b){improvement=Math.max(improvement,a.rank-b.rank);if(db.getMatchById(hs[i].match_id)?.status==='COMPLETED')confirmedImprovement=Math.max(confirmedImprovement,a.rank-b.rank);}}
 const details=entries.map(x=>teamDetail(db,db.fantasyTeams.find(t=>t.id===x.row.team_id),viewer)),captainBest=details.length?Math.max(...details.map(d=>d.players.find(p=>p.captain)?.points||0)):null;
 const leagues=e.leagues.filter(l=>l.members.some(m=>m.user_id===user.id)).map(l=>leagueView(db,l,user)),leagueWins=leagues.reduce((n,l)=>n+l.history.filter(h=>h.rows.some(r=>r.user_id===user.id&&r.rank===1&&r.points>0)).length,0),ls=leagues.map(l=>streak(l.history,h=>h.rows.some(r=>r.user_id===user.id&&r.rank===1&&r.points>0)));
 const rules=[['champion','Fantasy Champion','★','gold','Rank 1 with positive points in a completed match.',entries.some(x=>x.row.rank===1&&x.row.points>0)],['top10','Top 10 Finisher','◆','silver','Top 10 with positive points in a completed match.',entries.some(x=>x.row.rank<=10&&x.row.points>0)],['captain','Captain Genius','♛','gold','Captain contributes at least 100 points in a completed match.',captainBest>=100],['comeback','Comeback King','↗','silver','Gain 5 places between saved snapshots of one completed match.',confirmedImprovement>=5],['consistent','Consistency Master','✦','platinum','Three consecutive completed fixtures with positive Top 10 finishes.',top10.best>=3],['century','Century Club','100','bronze','At least 100 points in a completed match.',points.some(n=>n>=100)],['elite','Elite Manager','♜','platinum','Five completed participations and three match wins.',entries.length>=5&&entries.filter(x=>x.row.rank===1&&x.row.points>0).length>=3],['league','League Champion','♔','gold','Win an eligible private league after series completion.',leagues.some(l=>l.champions.some(r=>r.user_id===user.id))],['veteran','Fantasy Veteran','◈','bronze','Participate in five completed matches.',entries.length>=5],['predictor','Perfect Predictor','✓','silver','Correctly predict an officially finalized winner.',completed.some(x=>x.match.result==='WIN'&&e.votes[x.match.id]?.[user.id]?.choice===x.match.winner_team)]];
 const grants=e.awards[user.id] ||= {};const badges=rules.map(([id,name,icon,tier,condition,earned])=>{if(earned&&!grants[id])grants[id]={at:new Date().toISOString()};if(!earned)delete grants[id];return {id,name,icon,tier,condition,earned:Boolean(earned),earned_at:earned?grants[id].at:null};});
 const best=points.length?Math.max(...points):null,records={highest_points:best,best_rank:ranks.length?Math.min(...ranks):null,worst_rank:ranks.length?Math.max(...ranks):null,best_captain:captainBest,best_batting:details.length?Math.max(...details.map(d=>d.breakdown.batting_total)):null,best_bowling:details.length?Math.max(...details.map(d=>d.breakdown.bowling_total)):null,biggest_rank_gain:history.length>1?improvement:null,longest_top10_streak:top10.best};
 const activity=entries.map(x=>({id:`score-${x.match.id}-${x.match.score_revision||0}`,at:e.snapshots[x.match.id]?.at(-1)?.at||x.match.match_date,text:`${x.match.title}: finalized score ${x.row.points} points, rank ${x.row.rank}.`,celebrate:x.row.points>0&&x.row.points===best}));
 for(const x of completed)activity.push({id:`result-${x.match.id}-${x.match.score_revision||0}`,at:e.snapshots[x.match.id]?.at(-1)?.at||x.match.match_date,text:`Official result available: ${x.match.title} — ${x.match.winner_team||x.match.result||'completed'}.`,celebrate:false});
 for(const b of badges.filter(b=>b.earned))activity.push({id:`badge-${b.id}-${b.earned_at}`,at:b.earned_at,text:`Achievement unlocked: ${b.name}`,celebrate:true});
 for(const x of completed)if(x.match.result==='WIN'&&e.votes[x.match.id]?.[user.id]?.choice===x.match.winner_team)activity.push({id:`prediction-${x.match.id}-${x.match.score_revision||0}`,at:e.snapshots[x.match.id]?.at(-1)?.at||x.match.match_date,text:`Your prediction for ${x.match.title} was correct.`,celebrate:false});
 for(const l of leagues)if(l.champions.some(r=>r.user_id===user.id))activity.push({id:`league-${l.id}-${hash(l.rows)}`,at:Object.values(e.snapshots).flat().filter(s=>s.status==='COMPLETED').map(s=>s.at).sort().at(-1)||l.created_at,text:`You are a champion of ${l.name}.`,celebrate:true});
 for(const hs of Object.values(e.snapshots))for(let i=1;i<hs.length;i++){const a=hs[i-1].rows.find(r=>r.user_id===user.id),b=hs[i].rows.find(r=>r.user_id===user.id);if(a&&b&&a.rank>b.rank)activity.push({id:`rank-${hs[i].id}`,at:hs[i].at,text:`${db.getMatchById(hs[i].match_id)?.title}: your rank improved by ${a.rank-b.rank} positions.`,celebrate:false});}
 return {user_id:user.id,name:user.full_name||'Fantasy manager',team_name:user.fantasy_team_name||'Fantasy XI',avatar_url:user.avatar_url,public_profile:e.preferences[user.id]?.public_profile===true,completed_matches:entries.length,total_points:round(points.reduce((a,b)=>a+b,0)),average:points.length?round(points.reduce((a,b)=>a+b,0)/points.length):null,records,badges,history,league_wins:leagueWins,streaks:{top10,participation,prediction,league:{current:Math.max(0,...ls.map(s=>s.current)),best:Math.max(0,...ls.map(s=>s.best))}},activity:own?activity.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)):[],pending_celebrations:own?activity.filter(a=>a.celebrate&&!e.seen[user.id]?.includes(a.id)).map(a=>a.id):[]};
}
function weekly(db,date=Date.now()){
 const start=new Date(date);start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));const end=new Date(+start+7*86400000),rows=new Map();let matches=0;
 for(const m of db.matches.filter(m=>m.status==='COMPLETED'&&Date.parse(m.match_date)>=+start&&Date.parse(m.match_date)<+end)){matches++;for(const r of ranked(db,m)){const x=rows.get(r.user_id)||{...r,points:0,matches:0};x.points=round(x.points+r.points);x.matches++;rows.set(r.user_id,x);}}
 let prev,rank;const rankings=[...rows.values()].sort((a,b)=>b.points-a.points||a.user_id-b.user_id).map((r,i)=>{if(prev!==r.points)rank=i+1;prev=r.points;return {...r,rank};});return {start:start.toISOString(),end:end.toISOString(),matches,closed:Date.now()>=+end,rankings,champions:rankings.filter(r=>r.rank===1&&r.points>0)};
}
module.exports={state,ranked,validTeams,recordMatch,withMovement,teamDetail,playerAnalytics,popularity,dreamTeam,profile,leagueView,weekly,hash};
