'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        document.cookie = `mission_token=${data.token}; path=/; max-age=86400`;
        router.push('/dashboard');
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Logo / Avatar */}
        <div style={avatarContainerStyle}>
          <div style={avatarStyle}>
            <span style={{ fontSize: '48px' }}>🕶️</span>
          </div>
          <h1 style={titleStyle}>Mr. Anderson</h1>
          <p style={subtitleStyle}>Mission Control</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={formStyle}>
          <input
            type="password"
            placeholder="Enter access code"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoFocus
          />
          
          {error && <p style={errorStyle}>{error}</p>}
          
          <button 
            type="submit" 
            style={loading ? buttonDisabledStyle : buttonStyle}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Enter Mission Control'}
          </button>
        </form>

        {/* Footer */}
        <p style={footerStyle}>
          🔒 Secure AI Agent Interface
        </p>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-primary)',
  padding: '20px',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: '24px',
  padding: '48px',
  maxWidth: '400px',
  width: '100%',
  border: '1px solid var(--border-subtle)',
};

const avatarContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '32px',
};

const avatarStyle: React.CSSProperties = {
  width: '100px',
  height: '100px',
  borderRadius: '50%',
  background: 'var(--gradient-1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 16px',
  boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)',
  animation: 'float 3s ease-in-out infinite',
};

const titleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 4px',
  background: 'var(--gradient-1)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  margin: 0,
  fontSize: '14px',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  background: 'var(--bg-primary)',
  border: '2px solid var(--border-subtle)',
  borderRadius: '12px',
  color: 'var(--text-primary)',
  fontSize: '16px',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'var(--gradient-1)',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'transform 0.2s',
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
};

const errorStyle: React.CSSProperties = {
  color: 'var(--accent-red)',
  fontSize: '14px',
  textAlign: 'center',
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  marginTop: '24px',
  textAlign: 'center',
  color: 'var(--text-tertiary)',
  fontSize: '12px',
  margin: '24px 0 0',
};
