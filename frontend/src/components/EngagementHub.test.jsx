// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import EngagementHub from './EngagementHub';
import SmartValidator from './SmartValidator';
import api from '../api';
vi.mock('../api',()=>({default:{get:vi.fn(),post:vi.fn()}}));
vi.mock('../utils/fantasyAudio',()=>({playFantasySound:vi.fn()}));
const profile={name:'Manager',team_name:'Real XI',completed_matches:0,total_points:0,average:null,records:{best_rank:null},badges:[],history:[],streaks:{},activity:[],pending_celebrations:[],public_profile:false};
const overview={profile,match:{id:1,title:'AUS vs ENG',match_date:'2099-01-01T00:00:00Z',status:'ACTIVE',locked:false},server_time:new Date().toISOString(),managers:[],my_team:null,poll:{counts:{AUS:0,ENG:0},total:0,closed:false}};
afterEach(()=>{cleanup();vi.clearAllMocks();});
function start(){api.get.mockImplementation(async p=>({data:p.includes('overview')?overview:p.includes('players')?{players:[],popularity:{available:false,reason:'Hidden until lock',players:[]}}:p.includes('boosters')?{boosters:[]}:p.includes('weekly')?{start:new Date().toISOString(),end:new Date().toISOString(),matches:0,champions:[],rankings:[]}:p.includes('leagues')?{leagues:[]}:{dream:null}}));return render(<EngagementHub user={{id:1}} matchId={1}/>);}
describe('Fantasy hub',()=>{
 it('does not request private analytics for guests',()=>{render(<EngagementHub matchId={1} onSignIn={()=>{}}/>);expect(screen.getByText('Sign in')).toBeTruthy();expect(api.get).not.toHaveBeenCalled();});
 it('loads data and renders every feature with empty real history',async()=>{start();await screen.findByText('Real XI');for(const [group,tabs] of Object.entries({'My Performance':['Achievements','Rank history','Personal records','Winning streaks'],'Fantasy Insights':['Player analytics','Captain analyzer','Dream Team','Points breakdown','Player popularity','Differential players'],Challenges:['Head-to-head','Private leagues','Predictions','Weekly champion'],Activity:['Activity feed','Booster history','Share my XI','Match countdown']})){fireEvent.click(screen.getByRole('button',{name:group}));for(const tab of tabs){fireEvent.change(screen.getByLabelText('Explore'),{target:{value:tab}});await waitFor(()=>expect(screen.queryByText('Loading verified data…')).toBeNull());expect(screen.getByRole('heading',{name:tab})).toBeTruthy();}}});
 it('disables image export before official reveal',async()=>{start();await screen.findByText('Real XI');fireEvent.click(screen.getByRole('button',{name:'Activity',exact:true}));fireEvent.change(screen.getByLabelText('Explore'),{target:{value:'Share my XI'}});expect(screen.getByRole('button',{name:'Download fantasy XI image'}).disabled).toBe(true);});
 it('renders fetch failures with retry and recovers',async()=>{api.get.mockRejectedValueOnce({response:{data:{detail:'Database unavailable'}}});render(<EngagementHub user={{id:1}} matchId={1}/>);await screen.findByRole('alert');expect(screen.getByText(/Database unavailable/)).toBeTruthy();api.get.mockResolvedValue({data:overview});fireEvent.click(screen.getByRole('button',{name:'Retry loading'}));await screen.findByText('Real XI');});
 it('sends predictions to authenticated API',async()=>{start();api.post.mockResolvedValue({data:{}});await screen.findByText('Real XI');fireEvent.click(screen.getByRole('button',{name:'Challenges'}));fireEvent.change(screen.getByLabelText('Explore'),{target:{value:'Predictions'}});fireEvent.click(screen.getByRole('button',{name:/AUS · 0%/}));await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/engagement/predictions',{match_id:1,choice:'AUS'}));});
 it('shows server validator errors',async()=>{api.post.mockResolvedValue({data:{valid:false,errors:['Player is unavailable.']}});render(<SmartValidator match={{id:1}} players={[]} errors={[]} user={{id:1}}/>);fireEvent.click(screen.getByText('Check with server'));await screen.findByText('Player is unavailable.');});
});
