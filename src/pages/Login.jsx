import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
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
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500">Sign in to your PointCast account</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 text-sm text-accent-red">
            {error}
          </div>
        )}

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
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          No account?{' '}
          <Link to="/signup" className="text-accent-blue hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
