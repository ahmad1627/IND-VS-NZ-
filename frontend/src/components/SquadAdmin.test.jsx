// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SquadAdmin from './SquadAdmin';
import api from '../api';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const makePlayers = () => Array.from({ length: 30 }, (_, index) => {
  const id = index === 0 ? 501 : 500 + index + 1;
  return {
    id,
    name: index === 0 ? 'Rohail Nazir' : `Test Player ${index + 1}`,
    team: index % 2 === 0 ? 'PAK' : 'SL',
    role: index === 0 ? 'WK' : 'BAT',
    match_eligibility: index === 0 ? [] : [1],
    availability_status: 'AVAILABLE',
    availability_note: null,
    external_player_id: null,
    verified_source: null
  };
});

const response = () => ({
  data: {
    players: makePlayers(),
    editable: true,
    revision: 0,
    matches: [{ id: 1, title: 'Final: Pakistan A vs Sri Lanka A' }],
    availability_editable: true,
    eligibility_editable: true,
    eligibility_locks: {}
  }
});

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue(response());
  api.post.mockResolvedValue({ data: { message: 'Squads saved.' } });
});
afterEach(() => cleanup());

it('allows an admin to tick eligibility boxes after a fantasy team already exists', async () => {
  const onUpdated = vi.fn();
  window.addEventListener('fantasy-squad-updated', onUpdated);
  render(<SquadAdmin />);
  fireEvent.click(screen.getByText('Manage Pakistan A / Sri Lanka A squads'));

  const m1 = await screen.findByLabelText('Rohail Nazir Match 1');
  expect(m1.disabled).toBe(false);
  expect(m1.checked).toBe(false);

  fireEvent.click(m1);
  expect(m1.checked).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Save squad / availability changes' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

  const submitted = api.post.mock.calls[0][1].players.find(player => player.id === 501);
  expect(submitted.match_eligibility).toEqual([1]);
  await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  window.removeEventListener('fantasy-squad-updated', onUpdated);
});

it('does not allow changing a completed or already-scored fixture', async () => {
  api.get.mockResolvedValue({
    data: {
      ...response().data,
      eligibility_locks: { 501: [1] }
    }
  });
  render(<SquadAdmin />);
  fireEvent.click(screen.getByText('Manage Pakistan A / Sri Lanka A squads'));
  const m1 = await screen.findByLabelText('Rohail Nazir Match 1');
  expect(m1.disabled).toBe(true);
});

it('adds a manual player without a client-assigned ID and supports search and cancel', async () => {
  render(<SquadAdmin />);
  fireEvent.click(screen.getByText('Manage Pakistan A / Sri Lanka A squads'));
  await screen.findByLabelText('Rohail Nazir Match 1');
  fireEvent.click(screen.getByRole('button', { name: 'Add New Player' }));
  fireEvent.change(screen.getByLabelText('New player name'), { target: { value: 'Ahmad Khan' } });
  fireEvent.change(screen.getByLabelText('Ahmad Khan role'), { target: { value: 'BOWL' } });
  fireEvent.click(screen.getByLabelText('Ahmad Khan Match 1'));
  fireEvent.click(screen.getByRole('button', { name: 'Save squad / availability changes' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const player = api.post.mock.calls[0][1].players.at(-1);
  expect(player.id).toBeUndefined();
  expect(player.role).toBe('BOWL');
  expect(player.match_eligibility).toEqual([1]);
  await waitFor(() => expect(screen.queryByLabelText('Ahmad Khan name')).toBeNull());
  fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'Rohail Nazir' } });
  expect(screen.queryByLabelText('Test Player 2 name')).toBeNull();
  fireEvent.change(screen.getByLabelText('Rohail Nazir role'), { target: { value: 'BAT' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Changes' }));
  expect(screen.getByLabelText('Rohail Nazir role').value).toBe('WK');
});
