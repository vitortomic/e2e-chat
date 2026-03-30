import { useState } from 'react';
import { registerUserWithSignal, loginUserWithSignal } from '../services/signalAuthService';

interface AuthProps {
  onAuthenticated: (userId: string, username: string) => void;
}

export function Auth({ onAuthenticated }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        // Login with Signal Protocol
        const result = await loginUserWithSignal(username, password);

        if (!result.hasKeys) {
          setError('No encryption keys found. Please register again.');
          setLoading(false);
          return;
        }

        onAuthenticated(result.userId, result.username);
      } else {
        // Register with Signal Protocol
        const result = await registerUserWithSignal(username, password);
        onAuthenticated(result.userId, result.username);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔐 E2E Encrypted Chat</h1>
        <p style={styles.subtitle}>
          {isLogin ? 'Welcome back!' : 'Create your account'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            required
            autoComplete="username"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={8}
          />

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
          }}
          style={styles.switchButton}
        >
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
        </button>

        <div style={styles.info}>
          <p><strong>Security Features:</strong></p>
          <ul>
            <li>End-to-end encryption using Signal Protocol</li>
            <li>Private keys stored locally in IndexedDB</li>
            <li>Server never sees your plaintext messages</li>
            <li>Forward & future secrecy with Double Ratchet</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '28px',
    textAlign: 'center' as const,
    color: '#333',
  },
  subtitle: {
    margin: '0 0 30px 0',
    textAlign: 'center' as const,
    color: '#666',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  button: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  switchButton: {
    marginTop: '15px',
    padding: '10px',
    background: 'none',
    border: 'none',
    color: '#667eea',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    padding: '10px',
    background: '#fee',
    color: '#c33',
    borderRadius: '6px',
    fontSize: '14px',
  },
  info: {
    marginTop: '30px',
    padding: '20px',
    background: '#f5f5f5',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#666',
  },
};
