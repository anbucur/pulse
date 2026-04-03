import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Activity, Loader2 } from 'lucide-react';

export default function Login() {
  const { user, signInWithEmail, signUpWithEmail, checkProfileStatus } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const randomNum = Math.floor(Math.random() * 100000);
      const demoEmail = `demo${randomNum}@pulse.app`;
      const demoPassword = 'DemoPassword123!';

      const names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Quinn"];
      const intents = ["Right Now", "Dates", "Chat", "Networking"];
      const roles = ["Top", "Versatile", "Bottom", "Side"];

      const randomName = names[Math.floor(Math.random() * names.length)] + " " + randomNum.toString().slice(0, 2);
      const randomIntent = intents[Math.floor(Math.random() * intents.length)];
      const randomRole = roles[Math.floor(Math.random() * roles.length)];
      const randomAge = Math.floor(Math.random() * 20) + 20;

      const result = await signUpWithEmail(demoEmail, demoPassword, randomName);

      // Update profile with demo data
      const token = localStorage.getItem('token');
      await fetch('/api/profiles/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          age: randomAge,
          sexual_role: [randomRole],
          intent: [randomIntent],
          bio: `Hey! I'm a demo user generated for testing. I'm looking for ${randomIntent}.`,
          lat: 37.7749 + (Math.random() * 0.1 - 0.05),
          lng: -122.4194 + (Math.random() * 0.1 - 0.05),
          tags: ['Demo'],
          interests: ['Testing', 'Demo'],
          display_name: randomName,
        }),
      });

      await checkProfileStatus(result.user.id);
    } catch (err: any) {
      setError('Failed to create demo account: ' + err.message);
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
          <h1 className="text-4xl font-bold text-white tracking-tight">Pulse</h1>
          <p className="mt-2 text-zinc-400">The intent-driven geosocial network.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
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
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-zinc-400">Password</label>
              <Link to="/forgot-password" className="text-xs text-rose-500 hover:text-rose-400">Forgot password?</Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-zinc-800 border-zinc-700 text-white px-3 py-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-full text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-zinc-900 text-zinc-500">Or</span>
          </div>
        </div>

        <button
          onClick={handleDemoLogin}
          disabled={loading}
          type="button"
          className="w-full flex items-center justify-center px-4 py-3 border border-rose-500/50 text-base font-medium rounded-full text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
        >
          Try Demo Mode (Mock User)
        </button>

        <p className="text-center text-sm text-zinc-400">
          Don't have an account? <Link to="/signup" className="text-rose-500 hover:text-rose-400 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
