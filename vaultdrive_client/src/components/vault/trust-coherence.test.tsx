import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccessPanel } from './AccessPanel';
import { TrustRail } from './TrustRail';
import { FileSecurityTimeline } from './FileSecurityTimeline';
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { localStorage.clear(); localStorage.setItem('token', 'fixture-token'); vi.restoreAllMocks(); });
it('never reports owner-only success after a rejected revoke', async () => {
  const summary = { entries: [{ kind: 'direct', label: 'Recipient', since: '2026-09-16', state: 'active' }] };
  const fetchMock = vi.fn().mockResolvedValueOnce(response(summary)).mockResolvedValueOnce(response({}, 503));
  vi.stubGlobal('fetch', fetchMock);
  render(<AccessPanel fileId="file" filename="test.txt" onClose={() => {}} />);
  await screen.findByText('Recipient');
  await userEvent.click(screen.getByRole('button', { name: /revoke .*access/i }));
  await userEvent.click(screen.getByRole('button', { name: /^revoke now$/i }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not confirmed/i));
  expect(screen.queryByText(/back under owner-only|Done, safe/i)).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('does not count owner or intake as an external read route', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: {
    file_id: 'file', owner_label: 'Owner', origin: 'secure_drop', access_state: 'owner_only',
    entries: [{ kind: 'owner', label: 'Owner', since: '2026-09-16', state: 'active' }, { kind: 'secure_drop', label: 'Delivery', since: '2026-09-16', state: 'active' }],
  } })));
  render(<TrustRail fileId="file" />);
  expect(await screen.findByText(/No external read routes are listed/i)).toBeInTheDocument();
  expect(screen.queryByText(/2 active route/i)).not.toBeInTheDocument();
});
it('empty history is not proof of owner-only access', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: [] })));
  render(<FileSecurityTimeline fileId="file" />);
  expect(await screen.findByText(/No recorded events were returned/i)).toBeInTheDocument();
  expect(screen.queryByText(/only you|no external access has occurred/i)).not.toBeInTheDocument();
});
it('failed trust data offers retry without claiming protection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 503)));
  render(<TrustRail fileId="file" />);
  expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  expect(screen.queryByText(/remains encrypted and under your control/i)).not.toBeInTheDocument();
});

it('separates confirmed revocation from a failed access refresh', async () => {
  const summary = { entries: [{ kind: 'direct', label: 'Recipient', since: '2026-09-16', state: 'active' }] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(summary)).mockResolvedValueOnce(response({ success: true })).mockResolvedValueOnce(response({}, 503)));
  render(<AccessPanel fileId="file" filename="test.txt" onClose={() => {}} />);
  await screen.findByText('Recipient');
  await userEvent.click(screen.getByRole('button', { name: /revoke .*access/i }));
  await userEvent.click(screen.getByRole('button', { name: /^revoke now$/i }));
  expect(await screen.findByRole('status')).toHaveTextContent(/closed.*latest access list could not be refreshed/i);
  expect(screen.queryByText(/Review the refreshed access list/)).not.toBeInTheDocument();
});
it('labels the active count separately from closed recorded routes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ entries: [{ kind: 'share_link', label: 'Old file link', since: '2026-09-16', state: 'revoked' }] })));
  render(<AccessPanel fileId="file" filename="test.txt" onClose={() => {}} />);
  expect(await screen.findByText('Old file link')).toBeInTheDocument();
  expect(screen.getByText('0 active external read routes')).toBeInTheDocument();
});
it('does not present a link creation time as a precise revocation time', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: [{ id: 'closed', event_type: 'revoked', label: 'Public link revoked', at: '2026-01-01T00:00:00Z', tone: 'warn' }] })));
  render(<FileSecurityTimeline fileId="file" />);
  expect(await screen.findByText(/Closure time is unavailable in this snapshot/)).toBeInTheDocument();
  expect(document.querySelector('time[datetime="2026-01-01T00:00:00Z"]')).not.toBeInTheDocument();
});

it('treats malformed access entries as unavailable rather than zero active routes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ entries: [null] })));
  render(<AccessPanel fileId="file" filename="test.txt" onClose={() => {}} />);
  expect(await screen.findByTestId('data-state-error')).toBeInTheDocument();
  expect(screen.queryByText('0 active external read routes')).not.toBeInTheDocument();
});
