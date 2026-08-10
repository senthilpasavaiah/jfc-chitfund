import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Mode = 'member' | 'admin';
type MemberStep = 'aadhaar' | 'create-password' | 'enter-password';

export default function LoginPage() {
  const { checkAadhaar, setPasswordAadhaar, loginAadhaar, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('member');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Member (Aadhaar) flow state
  const [memberStep, setMemberStep] = useState<MemberStep>('aadhaar');
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [memberName, setMemberName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [memberPassword, setMemberPassword] = useState('');

  // Admin flow state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  function resetMemberFlow() {
    setMemberStep('aadhaar');
    setAadhaarLast4('');
    setMemberName('');
    setNewPassword('');
    setConfirmPassword('');
    setMemberPassword('');
    setError(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    resetMemberFlow();
    setAdminUsername('');
    setAdminPassword('');
  }

  async function handleAadhaarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(aadhaarLast4)) {
      setError('Please enter the last 4 digits of your Aadhaar number.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await checkAadhaar(aadhaarLast4);
      setMemberName(result.memberName);
      setMemberStep(result.needsPasswordSetup ? 'create-password' : 'enter-password');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not verify these details.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    setSubmitting(true);
    try {
      await setPasswordAadhaar(aadhaarLast4, newPassword);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not set your password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnterPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAadhaar(aadhaarLast4, memberPassword);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Incorrect password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAdmin(adminUsername, adminPassword);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/jfc-logo.png" alt="Jolly Friends Club logo" className="w-16 h-16 object-contain mx-auto mb-3" />
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">Jolly Friends Club</div>
          <h1 className="text-3xl text-white mt-2 font-bold">Chit Fund Ledger</h1>
          <p className="text-white/50 text-sm mt-1">Secure Access Portal</p>
        </div>

        <div className="ledger-card p-8">
          {/* Mode tabs */}
          <div className="flex rounded-lg border border-line mb-6 overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => switchMode('member')}
              className={`flex-1 py-2 transition-colors ${mode === 'member' ? 'bg-navy text-white' : 'bg-paper text-ink-muted'}`}
            >
              Member
            </button>
            <button
              type="button"
              onClick={() => switchMode('admin')}
              className={`flex-1 py-2 transition-colors ${mode === 'admin' ? 'bg-navy text-white' : 'bg-paper text-ink-muted'}`}
            >
              Admin
            </button>
          </div>

          {mode === 'member' && memberStep === 'aadhaar' && (
            <form onSubmit={handleAadhaarSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">Last 4 digits of Aadhaar</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={aadhaarLast4}
                  onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="XXXX"
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-center text-lg tracking-[0.4em] font-tabular font-semibold focus:outline-none focus:ring-2 focus:ring-gold"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {submitting ? 'Checking…' : 'Continue'}
              </button>
            </form>
          )}

          {mode === 'member' && memberStep === 'create-password' && (
            <form onSubmit={handleCreatePassword} className="space-y-5">
              <p className="text-sm font-medium text-ink">Welcome, {memberName}</p>
              <p className="text-xs text-ink-muted -mt-3">First-time login — please create a password for your account.</p>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-gold text-navy py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Set Password & Login'}
              </button>
              <button type="button" onClick={resetMemberFlow} className="w-full text-xs text-ink-muted hover:underline">
                &larr; Back
              </button>
            </form>
          )}

          {mode === 'member' && memberStep === 'enter-password' && (
            <form onSubmit={handleEnterPassword} className="space-y-5">
              <p className="text-sm font-medium text-ink">Welcome back, {memberName}</p>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">Password</label>
                <input
                  type="password"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Login'}
              </button>
              <button type="button" onClick={resetMemberFlow} className="w-full text-xs text-ink-muted hover:underline">
                &larr; Not you? Go back
              </button>
            </form>
          )}

          {mode === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">Admin username</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Admin"
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-white/50 text-xs mt-6">© 2026 Jolly Friends Club — Secure Access Portal</p>
      </div>
    </div>
  );
}
