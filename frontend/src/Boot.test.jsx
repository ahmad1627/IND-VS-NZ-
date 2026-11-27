// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import App from './App';
import {AuthProvider} from './context/AuthContext';
import api from './api';
vi.mock('./api',()=>({default:{get:vi.fn(),post:vi.fn()},clearPendingReads:vi.fn()}));
afterEach(cleanup);
it('boots the actual component tree with no saved team',async()=>{
 api.get.mockImplementation(async url=>{if(url==='/matches')return {data:[{id:1,title:'AUS vs ENG',team_a:'AUS',team_b:'ENG',match_date:'2099-11-21T00:00:00Z',is_active:true,status:'ACTIVE'}]};if(url.includes('/players'))return {data:{all_players:[],categorized_players:{WK:[],BAT:[],AR:[],BOWL:[]}}};return {data:{}};});
 render(<AuthProvider><App/></AuthProvider>);
 expect(await screen.findByText('Explore Fantasy Hub')).toBeTruthy();
 expect(screen.getByText('Build your XI')).toBeTruthy();
 fireEvent.click(screen.getByText('Explore Fantasy Hub'));
 expect(await screen.findByText('Sign in to explore your fantasy career, insights and challenges.')).toBeTruthy();
});
