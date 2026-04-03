import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Activity, Loader2 } from 'lucide-react';

export default function SignUp() {
  const { user, signUpWithEmail } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" />;
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    setError('');
    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-rose-500 p-4 rounded-full">
              <Activity className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="mt-2 text-zinc-400">Join Pulse to connect with others.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignUp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional"
              className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-full text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          Already have an account? <Link to="/login" className="text-rose-500 hover:text-rose-400 font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
