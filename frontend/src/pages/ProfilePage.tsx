import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AdminAccessData {
  totalAdmins: number;
  grantedAdmins: { member_id: string; name: string }[];
  eligibleMembers: { member_id: string; name: string }[];
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [adminAccess, setAdminAccess] = useState<AdminAccessData | null>(null);
  const [grantSelection, setGrantSelection] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      client.get('/auth/admin-access').then((res) => setAdminAccess(res.data.data));
    }
  }, [isAdmin]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/auth/change-password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Could not change password.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function reloadAdminAccess() {
    const res = await client.get('/auth/admin-access');
    setAdminAccess(res.data.data);
  }

  async function handleGrant() {
    setAccessError(null);
    if (!grantSelection) {
      setAccessError('Please select a member first.');
      return;
    }
    try {
      await client.post('/auth/admin-access/grant', { memberId: grantSelection });
      setGrantSelection('');
      reloadAdminAccess();
    } catch (err: any) {
      setAccessError(err?.response?.data?.message || 'Could not grant admin access.');
    }
  }

  async function handleRevoke(memberId: string) {
    setAccessError(null);
    try {
      await client.post('/auth/admin-access/revoke', { memberId });
      reloadAdminAccess();
    } catch (err: any) {
      setAccessError(err?.response?.data?.message || 'Could not revoke admin access.');
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {isAdmin ? (
        <div className="ledger-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-gold text-navy flex items-center justify-center font-bold shrink-0">A</span>
            <h3 className="font-bold text-lg">Admin</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <div className="text-xs font-semibold text-ink-muted mb-1">Login ID</div>
              <div className="text-ink-muted font-tabular">XXXX XXXX XXXX</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-muted mb-1">Account Type</div>
              <div>System Administrator</div>
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-4 pt-3 border-t border-line">
            This is the system administrator account — it isn't linked to any member or Aadhaar record.
          </p>
        </div>
      ) : (
        <div className="ledger-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-gold text-navy flex items-center justify-center font-bold shrink-0">
              {initials(user?.name || 'Member')}
            </span>
            <h3 className="font-bold text-lg">{user?.name}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <div className="text-xs font-semibold text-ink-muted mb-1">Mobile Number</div>
              <div className="font-tabular">{user?.phone}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-muted mb-1">Account Type</div>
              <div>Member</div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && adminAccess && (
        <div className="ledger-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Admin Access</h3>
            <span className="text-xs bg-gold/20 text-gold-dim px-2.5 py-1 rounded-full font-medium">
              {adminAccess.totalAdmins} admin{adminAccess.totalAdmins !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            Grant another member admin access so they can manage the system if you're unavailable. Only members with an Aadhaar on file can be made admin.
          </p>
          <ul className="space-y-2 mb-4">
            <li className="flex justify-between text-sm border-b border-line pb-2">
              <span>Admin</span>
              <span className="text-xs text-ink-muted">System Account</span>
            </li>
            {adminAccess.grantedAdmins.map((a) => (
              <li key={a.member_id} className="flex justify-between items-center text-sm border-b border-line pb-2">
                <span>{a.name}</span>
                <button
                  onClick={() => handleRevoke(a.member_id)}
                  className="text-xs text-danger bg-danger/10 px-2.5 py-1 rounded-md cursor-pointer hover:bg-danger/20 transition-colors"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          {accessError && <p className="text-sm text-danger mb-2">{accessError}</p>}
          <div className="flex gap-2">
            <select
              value={grantSelection}
              onChange={(e) => setGrantSelection(e.target.value)}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm"
              disabled={adminAccess.eligibleMembers.length === 0}
            >
              <option value="" disabled>
                {adminAccess.eligibleMembers.length ? 'Select name' : 'No eligible members (need Aadhaar on file)'}
              </option>
              {adminAccess.eligibleMembers.map((m) => (
                <option key={m.member_id} value={m.member_id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleGrant}
              disabled={adminAccess.eligibleMembers.length === 0}
              className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Grant Admin Access
            </button>
          </div>
        </div>
      )}

      <div className="ledger-card p-5">
        <h3 className="font-medium mb-4">Change password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            required
          />
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-light transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
