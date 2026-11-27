"""Read-only fantasy suggestions. No database, external API, or credentials."""
from http.server import BaseHTTPRequestHandler
import json, os, sys
from collections import Counter

ROLES = ('WK', 'BAT', 'AR', 'BOWL')
MINIMUM = (1, 3, 1, 3)
MAXIMUM = (4, 6, 4, 6)
# Partial, publicly reported tournament aggregate data. Values are observations,
# not forecasts; missing observations must never be interpreted as zero.
# (name, team): (runs, wickets); completed matches through 26 Nov, excluding semifinal 2.
FORM = {
    ('Lasith Croospulle','SL'): (260,None), ('Nishan Madushka','SL'): (203,None),
    ('Pavan Rathnayake','SL'): (156,None), ('Sineth Jayawardena','SL'): (147,None),
    ('Maaz Sadaqat','PAK'): (125,None), ('Hasan Nawaz','PAK'): (114,None),
    ('Wanuja Sahan','SL'): (None,7), ('Sufyan Moqim','PAK'): (None,7),
    ('Ali Raza','PAK'): (None,6), ('Ravindu Fernando','SL'): (None,6),
}
SOURCES = ['https://www.cricbuzz.com/cricket-series/13402/acc-mens-asia-cup-rising-stars-2026/stats',
           'https://www.cricbuzz.com/special-content/wicket-zone/13402/acc-mens-asia-cup-rising-stars-2026',
           'https://www.mrcricketuae.com/asia-cup-rising-stars/stats/most-wickets/']

def eligible(raw):
    if not isinstance(raw, list) or not 1 <= len(raw) <= 60:
        raise ValueError('Supply 1–60 public squad players.')
    result = {}; names=set()
    for p in raw:
        if not isinstance(p,dict): raise ValueError('Invalid player.')
        i, name, team, role = (p.get(k) for k in ('id','name','team','role'))
        if type(i) is not int or not 1 <= i <= 2147483647 or i in result or not isinstance(name,str) or not 1<=len(name)<=100 or team not in ('PAK','SL') or role not in ROLES:
            raise ValueError('Invalid or duplicate squad player.')
        if (name,team) in names: raise ValueError('Duplicate squad name.')
        names.add((name,team))
        if p.get('active') is False or p.get('availability_status') == 'OUT': continue
        # Prefer confirmed XI, but do not infer unconfirmed players are OUT.
        runs,wickets=FORM.get((name,team),(None,None)); matches=3 if team=='PAK' else 4
        # A transparent heuristic: partial run and wicket evidence normalized by
        # team games; shrink toward a neutral role prior where data is missing.
        # Not a fantasy-points estimate, not trained ML.
        score=20 + (5 if role=='AR' else 0)
        if runs is not None: score += min(65, runs/matches)
        if wickets is not None: score += min(65, 25*wickets/matches)
        if p.get('playing_xi_confirmed') is True: score+=10
        notes=[]
        if runs is not None: notes.append(f'{runs} tournament runs in snapshot')
        if wickets is not None: notes.append(f'{wickets} tournament wickets in snapshot')
        if p.get('playing_xi_confirmed') is True: notes.append('confirmed playing XI')
        if not notes: notes.append('role-based pick; performance data unavailable')
        result[i]={'id':i,'name':name,'team':team,'role':role,'score':round(score,3),'evidence':'; '.join(notes),'form_available':runs is not None or wickets is not None}
    return result

def valid(ids,pool):
    if len(ids)!=11 or len(set(ids))!=11 or any(i not in pool for i in ids): return False
    rc=Counter(pool[i]['role'] for i in ids); tc=Counter(pool[i]['team'] for i in ids)
    return all(MINIMUM[j]<=rc[r]<=MAXIMUM[j] for j,r in enumerate(ROLES)) and all(1<=tc[t]<=7 for t in ('PAK','SL'))

def best_xi(pool):
    # Dynamic programming across role/team counts (bounded by existing limits).
    # For each state keep the highest-scoring partial team; no combinations explosion.
    states={(0,0,0,0,0):(0,())}
    for i,p in sorted(pool.items()):
        ri=ROLES.index(p['role']); a=int(p['team']=='PAK'); nxt=dict(states)
        for state,(score,ids) in states.items():
            total=sum(state[:4]); ac=state[4]+a
            if total>=11 or state[ri]>=MAXIMUM[ri] or ac>7 or total+1-ac>7: continue
            c=list(state);c[ri]+=1;c[4]=ac; key=tuple(c)
            candidate=(score+p['score'],ids+(i,))
            if key not in nxt or candidate[0]>nxt[key][0]: nxt[key]=candidate
        states=nxt
    legal=[v for v in states.values() if valid(v[1],pool)]
    return list(max(legal,key=lambda v:v[0])[1]) if legal else []

def advise(body):
    if not isinstance(body,dict): raise ValueError('JSON object required.')
    pool=eligible(body.get('players'))
    selected=body.get('selected_ids',[])
    if not isinstance(selected,list) or len(selected)>11 or any(type(i) is not int for i in selected) or len(set(selected))!=len(selected): raise ValueError('Invalid draft.')
    if any(i not in pool for i in selected): raise ValueError('Draft contains unavailable players. Refresh the squad.')
    xi=best_xi(pool)
    ranked=lambda ids: sorted((pool[i] for i in ids),key=lambda p:(-p['score'],p['id']))
    draft_valid=valid(selected,pool)
    fixed=body.get('reserved_booster_id')
    if fixed is not None and (type(fixed) is not int or fixed not in selected): raise ValueError('Reserved 3X target must remain in your XI.')
    def leadership(ids, fixed=None):
        if not valid(ids,pool): return None
        r=ranked([i for i in ids if i!=fixed]); triple=fixed if fixed is not None else r.pop(0)['id']
        return {'booster_id':triple,'captain_id':r[0]['id'],'vice_captain_id':r[1]['id']}
    picks={role:[p for p in ranked(pool) if p['role']==role][:3] for role in ROLES}
    # Return only display evidence, not an invented points forecast.
    return {'method':'Partial form + role-based optimization (not a trained prediction)', 'snapshot':'Completed matches through 26 November 2026; partial leading-player tables; semifinal 2 not included.', 'sources':SOURCES,'coverage':sum(p['form_available'] for p in pool.values()),'eligible_count':len(pool),'players':ranked(pool),'suggested_xi':xi,'suggested_leadership':leadership(xi),'draft_leadership':leadership(selected,fixed),'draft_valid':draft_valid,'picks':picks}

class handler(BaseHTTPRequestHandler):
    def respond(self,status,body):
        self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps(body).encode())
    def do_POST(self):
        if os.environ.get('AI_ENABLED','true').lower()!='true': return self.respond(503,{'detail':'AI assistant is disabled.'})
        try:
            n=int(self.headers.get('Content-Length','0'))
            if not 0<n<=32768: return self.respond(413,{'detail':'Invalid request size.'})
            self.respond(200,advise(json.loads(self.rfile.read(n))))
        except (ValueError,TypeError,KeyError,UnicodeError): self.respond(400,{'detail':'Invalid squad or draft. Refresh and try again.'})
    def do_GET(self): self.respond(405,{'detail':'Use POST.'})

if __name__=='__main__':
    try: print(json.dumps(advise(json.load(sys.stdin))))
    except (ValueError,TypeError,KeyError): print(json.dumps({'detail':'Invalid squad or draft. Refresh and try again.'}));sys.exit(2)
