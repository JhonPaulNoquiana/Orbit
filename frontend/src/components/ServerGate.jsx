import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { checkHealth } from '../services/api.js';

const MAX_ATTEMPTS = 24;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function ServerGate({ children }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt(0);
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      for (let currentAttempt = 1; currentAttempt <= MAX_ATTEMPTS; currentAttempt += 1) {
        if (cancelled) return;
        setAttempt(currentAttempt);

        try {
          await checkHealth();
          if (!cancelled) setReady(true);
          return;
        } catch {
          if (currentAttempt === MAX_ATTEMPTS) {
            if (!cancelled) setFailed(true);
            return;
          }
          await wait(Math.min(1500 + currentAttempt * 250, 5000));
        }
      }
    }

    connect();
    window.addEventListener('online', retry);
    return () => {
      cancelled = true;
      window.removeEventListener('online', retry);
    };
  }, [retry, retryKey]);

  if (ready) return children;

  return (
    <main className="startup-screen" aria-live="polite" aria-busy={!failed}>
      <div className="startup-glow startup-glow-one" />
      <div className="startup-glow startup-glow-two" />

      <section className="startup-card">
        <div className={`startup-orbit ${failed ? 'is-paused' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 120 120" role="img">
            <circle className="startup-orbit-track" cx="60" cy="60" r="47" />
            <circle className="startup-orbit-dash" cx="60" cy="60" r="47" />
            <circle className="startup-orbit-planet" cx="60" cy="13" r="7" />
            <path className="startup-orbit-mark" d="M46 40h28a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V46a6 6 0 0 1 6-6Zm4 10v20h20V50H50Z" />
          </svg>
        </div>

        <div className="startup-copy">
          <span className="startup-eyebrow">ORBIT WORKSPACE</span>
          <h1>{failed ? 'The server is taking longer than expected' : 'Getting your workspace ready'}</h1>
          <p>
            {failed
              ? 'Check your connection, then try again. Your boards and cards are safe.'
              : attempt < 3
                ? 'Connecting securely to your workspace…'
                : 'The server was resting and is waking up. This can take about a minute.'}
          </p>
        </div>

        {failed ? (
          <button className="startup-retry" type="button" onClick={retry}>
            <RefreshCw size={17} aria-hidden="true" />
            Try again
          </button>
        ) : (
          <div className="startup-progress" aria-label="Connecting to server">
            <span />
            <span />
            <span />
          </div>
        )}

        <div className="startup-status">
          {failed ? <WifiOff size={14} aria-hidden="true" /> : <span className="startup-status-dot" />}
          <span>{failed ? 'Unable to connect' : 'Connecting to Orbit'}</span>
        </div>
      </section>
    </main>
  );
}
