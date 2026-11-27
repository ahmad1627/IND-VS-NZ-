// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { vi, it, expect, beforeEach, afterEach } from 'vitest';
import PowerBoosters from './PowerBoosters';
import api from '../api';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const inventory = { uses: [], active_role: null, team_id: 9, lineup_revision: 2 };
const saved = { role: '3X', teamId: 9, revision: 2, players: [
  { id: 501, name: 'Rohail Nazir', team: 'PAK', role: 'WK' },
  { id: 502, name: 'Abdul Samad', team: 'PAK', role: 'BAT' },
  { id: 603, name: 'Pavan Rathnayake', team: 'SL', role: 'BAT' },
  { id: 508, name: 'Maaz Sadaqat', team: 'PAK', role: 'AR' }
], captainId: 502, viceCaptainId: 603 };

const props = () => ({
  matchId: 1,
  userId: 100,
  scope: '100:1',
  locked: false,
  choice: '3X',
  onChoose: vi.fn(),
  onDismiss: vi.fn(),
  onStatus: vi.fn()
});

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: inventory });
});
afterEach(cleanup);

it('selects 3X booster without spending it or showing confirmation before saving', async () => {
  const p = props();
  render(<PowerBoosters {...p} choice={null} />);
  const button = screen.getByRole('button', { name: /3X Booster/ });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  expect(p.onChoose).toHaveBeenCalledWith('3X');
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('cancel after saving never sends an apply request', async () => {
  const p = props();
  render(<PowerBoosters {...p} saved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: 'SAVE TEAM WITHOUT BOOSTER' }));
  expect(p.onDismiss).toHaveBeenCalled();
  expect(p.onChoose).toHaveBeenCalledWith(null);
  expect(api.post).not.toHaveBeenCalled();
});

it('requires target selection for 3X and confirms with chosen player', async () => {
  const p = props();
  api.post.mockResolvedValue({ data: { ...inventory, active_role: '3X', active_player_id: 508, can_cancel: true, uses: [{ role: '3X', match_id: 1 }] } });
  render(<PowerBoosters {...p} saved={saved} />);
  const confirmBtn = screen.getByRole('button', { name: 'CONFIRM 3X BOOSTER' });
  expect(confirmBtn.disabled).toBe(true);

  fireEvent.change(screen.getByRole('combobox', { name: '3X target player' }), { target: { value: '508' } });
  expect(confirmBtn.disabled).toBe(false);
  fireEvent.click(confirmBtn);

  await waitFor(() => expect(p.onDismiss).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/power-boosters/apply', { match_id: 1, team_id: 9, lineup_revision: 2, role: '3X', player_id: 508 });
});

it('reconciles an applied booster after the response is lost', async () => {
  const p = props();
  api.get.mockResolvedValueOnce({ data: inventory }).mockResolvedValue({ data: { ...inventory, active_role: '3X', active_player_id: 508, can_cancel: true, uses: [{ role: '3X', match_id: 1 }] } });
  api.post.mockRejectedValue(Error('offline'));

  render(<PowerBoosters {...p} saved={saved} />);
  await waitFor(() => expect(p.onStatus).toHaveBeenCalled());
  fireEvent.change(screen.getByRole('combobox', { name: '3X target player' }), { target: { value: '508' } });
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 3X BOOSTER' }));
  await waitFor(() => expect(p.onDismiss).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).toBeNull();
});

it('does not falsely promise cancellation when confirmation is unknown', async () => {
  const p = props();
  api.get.mockResolvedValueOnce({ data: inventory }).mockRejectedValue(Error('offline'));
  api.post.mockRejectedValue(Error('offline'));

  render(<PowerBoosters {...p} saved={saved} />);
  await waitFor(() => expect(p.onStatus).toHaveBeenCalled());
  fireEvent.change(screen.getByRole('combobox', { name: '3X target player' }), { target: { value: '508' } });
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 3X BOOSTER' }));
  await screen.findByText(/Could not verify confirmation/);
  expect(screen.queryByText('SAVE TEAM WITHOUT BOOSTER')).toBeNull();
  expect(p.onDismiss).not.toHaveBeenCalled();
});

it('disables booster button when match is locked or booster is spent', async () => {
  api.get.mockResolvedValue({ data: { ...inventory, uses: [{ role: '3X', match_id: 1, consumed: true }] } });
  const p = props();
  const view = render(<PowerBoosters {...p} />);
  await waitFor(() => expect(p.onStatus).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: /3X Booster/ }).disabled).toBe(true);
  view.rerender(<PowerBoosters {...p} locked />);
  expect(screen.getByRole('button', { name: /3X Booster/ }).disabled).toBe(true);
});

it('prevents duplicate confirmations while a request is pending', async () => {
  api.post.mockReturnValue(new Promise(() => {}));
  render(<PowerBoosters {...props()} saved={saved} />);
  fireEvent.change(screen.getByRole('combobox', { name: '3X target player' }), { target: { value: '508' } });
  const button = screen.getByRole('button', { name: 'CONFIRM 3X BOOSTER' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'SAVE TEAM WITHOUT BOOSTER' }).disabled).toBe(true);
});

it('releases confirmed 3X booster before match lock', async () => {
  const p = props();
  api.get.mockResolvedValue({ data: { ...inventory, active_role: '3X', active_player_id: 508, can_cancel: true, uses: [{ role: '3X', match_id: 1, consumed: false, reservation_id: 'test-reservation' }] } });
  api.post.mockResolvedValue({ data: inventory });
  render(<PowerBoosters {...p} />);
  await screen.findByRole('button', { name: 'Cancel this booster' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel this booster' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, release booster' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/power-boosters/cancel', { match_id: 1, reservation_id: 'test-reservation' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /3X Booster/ }).disabled).toBe(false));
});

it('does not allow cancellation after match lock', async () => {
  const p = props();
  api.get.mockResolvedValue({ data: { ...inventory, active_role: '3X', can_cancel: false, uses: [{ role: '3X', match_id: 1, consumed: true }] } });
  render(<PowerBoosters {...p} />);
  await screen.findByText(/CONSUMED — locked for match/);
  expect(screen.queryByRole('button', { name: 'Cancel this booster' })).toBeNull();
});

it('hides cancellation immediately when a polled admin lock arrives', async () => {
  const p = props();
  api.get.mockResolvedValue({ data: { ...inventory, active_role: '3X', can_cancel: true, uses: [{ role: '3X', match_id: 1, consumed: false, reservation_id: 'test-reservation' }] } });
  const view = render(<PowerBoosters {...p} />);
  await screen.findByRole('button', { name: 'Cancel this booster' });
  view.rerender(<PowerBoosters {...p} locked />);
  expect(screen.queryByRole('button', { name: 'Cancel this booster' })).toBeNull();
  expect(screen.getByRole('button', { name: /3X Booster/ }).disabled).toBe(true);
});

it('does not infer permission to cancel when the server omits it', async () => {
  api.get.mockResolvedValue({ data: { ...inventory, active_role: '3X', uses: [{ role: '3X', match_id: 1 }] } });
  render(<PowerBoosters {...props()} />);
  await screen.findByText(/CONSUMED — locked for match/);
  expect(screen.queryByRole('button', { name: 'Cancel this booster' })).toBeNull();
});


it('preselects a recommended draft 3X target without automatically consuming it', async () => {
  render(<PowerBoosters {...props()} saved={{...saved, preferredPlayerId:508}} />);
  await waitFor(() => expect(screen.getByRole('combobox', { name:'3X target player' }).value).toBe('508'));
  expect(api.post).not.toHaveBeenCalled();
});
