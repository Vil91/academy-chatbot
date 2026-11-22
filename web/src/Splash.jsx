import { useEffect, useState } from 'react';

const KEY = 'ac_splash_done';

export default function Splash() {
  const [phase, setPhase] = useState(() => {
    try {
      if (sessionStorage.getItem(KEY)) return 'gone';
    } catch {
      /* ignore */
    }
    return 'show';
  });

  useEffect(() => {
    if (phase === 'gone') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const exitDelay = reduced ? 220 : 1450;
    const doneDelay = reduced ? 420 : 1920;

    const t1 = setTimeout(() => setPhase('exit'), exitDelay);
    const t2 = setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, '1');
      } catch {
        /* ignore */
      }
      setPhase('gone');
    }, doneDelay);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase === 'gone']);

  if (phase === 'gone') return null;

  const skip = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setPhase('exit');
    setTimeout(() => setPhase('gone'), 320);
  };

  return (
    <div
      className={`splash ${phase === 'exit' ? 'splash-exit' : ''}`}
      onClick={skip}
      role="status"
      aria-label="Loading Picsart Academy Concierge"
    >
      <div className="splash-grid" aria-hidden="true" />
      <div className="splash-orb splash-orb-magenta" aria-hidden="true" />
      <div className="splash-orb splash-orb-aqua" aria-hidden="true" />

      <div className="splash-center">
        <div className="splash-emblem">
          <span className="splash-ring splash-ring-outer" aria-hidden="true" />
          <span className="splash-ring splash-ring-inner" aria-hidden="true" />
          <img
            className="splash-cube"
            src="/brand/cube-256.png"
            alt="Picsart Academy"
            width="104"
            height="98"
          />
        </div>

        <div className="splash-brand">
          <div className="splash-word">
            <span className="splash-word-main">PICSART</span>
            <span className="splash-word-sub">ACADEMY</span>
          </div>
          <span className="splash-tag">CONCIERGE · AI ASSISTANT</span>
        </div>

        <div className="splash-bar" aria-hidden="true">
          <span className="splash-bar-fill" />
        </div>
      </div>
    </div>
  );
}
