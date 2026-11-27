// @vitest-environment jsdom
import React, {Profiler} from 'react';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {vi,it,expect,beforeEach,afterEach} from 'vitest';
import App from './App';
import api from './api';
const auth=vi.hoisted(()=>({user:null}));
vi.mock('./context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('./api',()=>({default:{get:vi.fn(),post:vi.fn()}}));
vi.mock('./components/Navbar',()=>({default:p=><button onClick={()=>p.setActiveTab('leaderboard')}>Open standings</button>}));
vi.mock('./components/Leaderboard',()=>({default:p=><><button onClick={()=>p.onInspectTeam(1)}>Manager one</button><button onClick={()=>p.onInspectTeam(2)}>Manager two</button></>}));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let requests;
const details=id=>({data:{team_id:id,fantasy_team_name:`Team ${id}`,full_name:`Owner ${id}`,total_points:0,rank:2,match:{id:1,title:'Fixture 1'},categorized_players:{WK:[],BAT:[],AR:[],BOWL:[]}}});
beforeEach(()=>{auth.user=null;requests=[];vi.resetAllMocks();localStorage.clear();api.get.mockImplementation((url,config)=>{
 if(url==='/matches')return Promise.resolve({data:[]});
 if(url.startsWith('/leaderboard/team/')){const d=deferred();requests.push({url,config,...d});return d.promise;}
 return Promise.resolve({data:{}});
});});
afterEach(cleanup);
async function setup(){const view=render(<App/>);fireEvent.click(screen.getByText('Open standings'));await screen.findByText('Manager one');return view;}
it('opens before network completion, coalesces repeated clicks, and discards obsolete manager responses',async()=>{
 await setup();fireEvent.click(screen.getByText('Manager one'));
 expect(screen.getByText('Loading fantasy lineup details...')).toBeTruthy();
 fireEvent.click(screen.getByText('Manager one'));expect(requests.length).toBe(1);
 fireEvent.click(screen.getByText('Manager two'));expect(requests[0].config.signal.aborted).toBe(true);
 await act(async()=>requests[1].resolve(details(2)));await screen.findByText('Team 2');
 await act(async()=>requests[0].resolve(details(1)));expect(screen.queryByText('Team 1')).toBeNull();
});
it('closes and cancels private requests on account change',async()=>{
 const view=await setup();fireEvent.click(screen.getByText('Manager one'));auth.user={id:101};view.rerender(<App/>);
 expect(requests[0].config.signal.aborted).toBe(true);await act(async()=>requests[0].resolve(details(1)));expect(screen.queryByText('Team 1')).toBeNull();
});
it('cancels on close and allows a failed request to retry',async()=>{
 await setup();fireEvent.click(screen.getByText('Manager one'));fireEvent.click(screen.getByLabelText('Close lineup'));expect(requests[0].config.signal.aborted).toBe(true);
 fireEvent.click(screen.getByText('Manager one'));await act(async()=>requests[1].reject(Error('offline')));await screen.findByText('Could not load lineup preview. Please retry.');
 fireEvent.click(screen.getByText('Manager one'));await act(async()=>requests[2].resolve(details(1)));await screen.findByText('Team 1');
});
it('refreshes visible team details after a correction event',async()=>{
 await setup();fireEvent.click(screen.getByText('Manager one'));await act(async()=>requests[0].resolve(details(1)));await screen.findByText('Team 1');
 fireEvent(window,new Event('fantasy-data-changed'));expect(screen.getByText('Loading fantasy lineup details...')).toBeTruthy();
 const corrected=details(1);corrected.data.full_name='Corrected manager';await act(async()=>requests[1].resolve(corrected));await screen.findByText('Corrected manager');
});
it('records React commit and click-to-loading DOM timings (jsdom, not paint)',async()=>{
 const commits=[];render(<Profiler id="app" onRender={(id,phase,actual)=>commits.push(actual)}><App/></Profiler>);
 fireEvent.click(screen.getByText('Open standings'));await screen.findByText('Manager one');
 const start=performance.now();fireEvent.click(screen.getByText('Manager one'));expect(screen.getByText('Loading fantasy lineup details...')).toBeTruthy();
 console.log(JSON.stringify({click_to_loading_dom_ms:+(performance.now()-start).toFixed(2),react_commit_actual_ms:commits.map(n=>+n.toFixed(2))}));
});
