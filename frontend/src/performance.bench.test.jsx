// @vitest-environment jsdom
// Controlled latency + React Profiler. DOM timing in jsdom is NOT browser paint.
import React,{Profiler} from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {vi,it,afterEach} from 'vitest';
import App from './App';
import api from './api';
vi.mock('./context/AuthContext',()=>({useAuth:()=>({user:null})}));
vi.mock('./api',()=>({default:{get:vi.fn(),post:vi.fn()}}));
vi.mock('./components/Navbar',()=>({default:p=><button onClick={()=>p.setActiveTab('leaderboard')}>Benchmark standings</button>}));
vi.mock('./components/Leaderboard',()=>({default:p=><button onClick={()=>p.onInspectTeam(1)}>Benchmark manager</button>}));
afterEach(cleanup);
it('measures click feedback and repeated requests under fixed 100ms API latency',async()=>{
 let requests=0;const commits=[];
 api.get.mockImplementation(url=>{
  if(url==='/matches')return Promise.resolve({data:[]});
  if(url.startsWith('/leaderboard/team/')){requests++;return new Promise(resolve=>setTimeout(()=>resolve({data:{team_id:1,fantasy_team_name:'Benchmark XI',full_name:'Manager',rank:2,total_points:0,match:{id:1,title:'Fixture'},categorized_players:{WK:[],BAT:[],AR:[],BOWL:[]}}}),100));}
  return Promise.resolve({data:{}});
 });
 render(<Profiler id="app" onRender={(id,phase,actual)=>commits.push(actual)}><App/></Profiler>);
 fireEvent.click(screen.getByText('Benchmark standings'));await screen.findByText('Benchmark manager');
 const start=performance.now(), mark=commits.length;
 fireEvent.click(screen.getByText('Benchmark manager'));
 const immediate=!!screen.queryByText('Loading fantasy lineup details...');
 const immediateMs=performance.now()-start;
 fireEvent.click(screen.getByText('Benchmark manager'));fireEvent.click(screen.getByText('Benchmark manager'));
 await screen.findByText('Benchmark XI');
 const ready=performance.now()-start;
 console.log('PERFORMANCE '+JSON.stringify({api_delay_ms:100,click_to_feedback_dom_ms:+(immediate?immediateMs:ready).toFixed(2),click_to_team_dom_ms:+ready.toFixed(2),requests_for_three_clicks:requests,react_actual_duration_ms:+commits.slice(mark).reduce((a,b)=>a+b,0).toFixed(2)}));
});
