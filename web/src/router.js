import { useEffect, useState } from 'react';

// A tiny router: three pages (/, /c/:id, /cabinet) and /admin need nothing more.
export function navigate(path, { replace = false } = {}) {
  if (path === window.location.pathname) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new Event('ac:navigate'));
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener('ac:navigate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('ac:navigate', update);
    };
  }, []);
  return path;
}

// onClick for <a href>: keep ctrl/cmd-click opening a new tab.
export const linkTo = (to, after) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(to);
  after?.();
};
