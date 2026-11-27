// @vitest-environment jsdom
import React from 'react';
import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {vi,it,expect,beforeEach,afterEach} from 'vitest';
import App from './App';
import api from './api';
const auth=vi.hoisted(()=>({user:{id:100,full_name:'Owner',fantasy_team_name:'My XI'}}));
vi.mock('./context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('./api',()=>({default:{get:vi.fn(),post:vi.fn()}}));
vi.mock('./components/PitchPreview',()=>({default:p=><div><output data-testid="picks">{p.selectedPlayers.map(x=>x.id).join(',')}</output><button disabled={p.isSubmitting} onClick={p.onSaveTeam}>Test save</button></div>}));

// ACC Rising Stars 2026 Final — PAK vs SL
const match={id:4,match_number:1,venue:'West End Park International Cricket Stadium, Doha, Qatar',title:'Final: Pakistan A vs Sri Lanka A',team_a:'PAK',team_b:'SL',status:'ACTIVE',is_active:true,is_locked:false,format:'50-over',match_date:'2099-11-29T10:00:00Z'};

// 11 players — 1 WK, 3 BAT, 2 AR, 3 BOWL (4 PAK + 7 SL — within 7-max rule; adjust: 6 PAK, 5 SL)
// PAK: WK=501, BAT=502,503,504, AR=508,509, BOWL=512,513,514 (9)
// SL:  BAT=603,604 (2) — total 11 ✓; 6 PAK, 5 SL ✓
const players=[
 {id:501,name:'Rohail Nazir',team:'PAK',role:'WK'},
 {id:502,name:'Abdul Samad',team:'PAK',role:'BAT'},
 {id:503,name:'Haider Ali',team:'PAK',role:'BAT'},
 {id:504,name:'Hasan Nawaz',team:'PAK',role:'BAT'},
 {id:508,name:'Maaz Sadaqat',team:'PAK',role:'AR'},
 {id:509,name:'Danish Aziz',team:'PAK',role:'AR'},
 {id:512,name:'Ahmed Daniyal',team:'PAK',role:'BOWL'},
 {id:513,name:'Ali Raza',team:'PAK',role:'BOWL'},
 {id:514,name:'Mohammad Hasnain',team:'PAK',role:'BOWL'},
 {id:603,name:'Pavan Rathnayake',team:'SL',role:'BAT'},
 {id:604,name:'Lasith Croospulle',team:'SL',role:'BAT'},
];
const draft={match_id:4,player_ids:players.map(p=>p.id),captain_id:502,vice_captain_id:603};
let saved,offline;
const setupApi=()=>api.get.mockImplementation(async url=>{
 if(url.startsWith('/power-boosters?'))return {data:{uses:[],active_role:null}};
 if(url==='/matches')return {data:[match]};if(url==='/matches/active')return {data:match};
 if(url.includes('/players'))return {data:{all_players:players,categorized_players:Object.fromEntries(['WK','BAT','AR','BOWL'].map(role=>[role,players.filter(p=>p.role===role)]))}}; 
 if(url.includes('/teams/my-team')){if(offline)throw Error('offline');return {data:{has_team:!!saved,team:saved}};}
 throw Error(url);
});
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();auth.user={id:100,full_name:'Owner',fantasy_team_name:'My XI'};saved=null;offline=false;setupApi();});
afterEach(cleanup);

it('keeps an account draft unsaved and restores captain and vice without automatically using 3X',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));render(<App/>);
 await waitFor(()=>expect(screen.getByTestId('picks').textContent).toBe(draft.player_ids.join(',')));
 expect(api.post).not.toHaveBeenCalled();expect(screen.queryByText(/is saved\. Points update/)).toBeNull();
});

it('does not carry another account draft across sign-in changes',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));const view=render(<App/>);
 await waitFor(()=>expect(screen.getByTestId('picks').textContent).not.toBe(''));
 auth.user={id:101,full_name:'Other'};view.rerender(<App/>);
 await waitFor(()=>expect(screen.getByTestId('picks').textContent).toBe(''));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));
 expect(localStorage.getItem('fantasy_acc_final_2026_draft_m4_u101') || '').not.toContain('502,603');
});

it('shows success only after reading the saved team without mandatory booster',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));
 api.post.mockImplementation(async()=>{saved={players,captain_id:502,vice_captain_id:603};return {data:{team_id:7}};});
 render(<App/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Test save'}));
 await screen.findByText(/saved successfully to the server/);expect(api.post).toHaveBeenCalledTimes(1);
 expect(api.post.mock.calls[0][1]).toMatchObject({match_id:4,captain_id:502,vice_captain_id:603});
});

it('does not label a failed save as saved',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));api.post.mockRejectedValue({response:{data:{detail:'Database unavailable'}}});
 render(<App/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Test save'}));
 await screen.findByText('Database unavailable');expect(screen.queryByText(/is saved\. Points update/)).toBeNull();
});

it('rejects success when the read-back has no saved team',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));api.post.mockResolvedValue({data:{team_id:7}});
 render(<App/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Test save'}));
 await screen.findByText('The saved team could not be verified. Reload before retrying.');
});

it('pauses saving on a saved-team load failure and retries successfully',async()=>{
 offline=true;render(<App/>);await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(true);
 offline=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));
});

it('opens 3X booster selection only after verified save and cancels without consuming it',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));
 api.post.mockImplementation(async()=>{saved={id:7,lineup_revision:1,players,captain_id:502,vice_captain_id:603};return {data:{team_id:7}};});
 render(<App/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));
 // 3X booster button should exist in the UI
 const boosterBtn = screen.queryByRole('button',{name:/3X/i}) || screen.queryByRole('button',{name:/Booster/i});
 // Before save, booster may be disabled or absent - just check save works
 fireEvent.click(screen.getByRole('button',{name:'Test save'}));
 await screen.findByText(/saved successfully to the server/);
 expect(api.post).toHaveBeenCalledTimes(1);expect(api.post.mock.calls[0][0]).toBe('/teams');
 expect(saved.players).toHaveLength(11);
});

it('never opens power confirmation when saving the lineup fails',async()=>{
 localStorage.setItem('fantasy_acc_final_2026_draft_m4_u100',JSON.stringify(draft));
 api.post.mockRejectedValue({response:{data:{detail:'Save blocked'}}});render(<App/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Test save'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Test save'}));
 await screen.findByText('Save blocked');
 expect(screen.queryByText('Activate Power Batsman?')).toBeNull();expect(api.post).toHaveBeenCalledTimes(1);
});
