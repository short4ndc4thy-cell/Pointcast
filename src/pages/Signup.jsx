import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      await signUp(email, password, username);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Create Account</h1>
        <p className="text-sm text-gray-500">Start with 1,000 points. Predict wisely.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 text-sm text-accent-red">
            {error}
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Username</label>
          <input
            type="text"
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email</label>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Password</label>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating…' : 'Create Account'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-blue hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
