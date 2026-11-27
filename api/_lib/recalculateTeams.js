const {calculateTeamPoints}=require('./scoringEngine');
module.exports=function recalculateTeams(db,matchId){
 const stats=db.getPlayerMatchStats(matchId);
 if(!stats.length)return;
 const points=Object.fromEntries(stats.map(s=>[s.player_id,s.fantasy_points||0]));
 const teams=db.getFantasyTeamsByMatch(matchId);
 for(const t of teams){
  const selected=Object.fromEntries(t.player_ids.map(id=>[id,points[id]||0]));
  const roles=Object.fromEntries(t.player_ids.map(id=>[id,db.getPlayerForMatch(id,matchId)?.role]));
  t.total_points=calculateTeamPoints(selected,t.captain_id,t.vice_captain_id,t.booster_id,t.power_booster_role,roles).totalPoints;
 }
 teams.sort((a,b)=>b.total_points-a.total_points||a.id-b.id);
 let last,rank;teams.forEach((t,i)=>{if(last!==t.total_points)rank=i+1;t.rank=rank;last=t.total_points;});
};
