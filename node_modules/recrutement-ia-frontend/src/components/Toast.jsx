import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_DISMISS_MS = 3500;
const EXIT_ANIM_MS = 250;

let idCounter = 0;

// Petit système de toasts autonome (sans dépendance externe).
// Usage : const { showToast, ToastViewport } = useToast();
//         showToast('success', 'Profil mis à jour avec succès !');
//         <ToastViewport /> quelque part dans le rendu du composant.
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, EXIT_ANIM_MS);
  }, []);

  const showToast = useCallback((type, msg) => {
    const id = ++idCounter;
    setToasts((current) => [...current, { id, type, msg, hiding: false }]);
    timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      Object.values(activeTimers).forEach(clearTimeout);
    };
  }, []);

  const ToastViewport = () => (
    <div className="toast-viewport">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}${t.hiding ? ' toast--hide' : ''}`} role="status">
          <span className="toast-icon">
            {t.type === 'success' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            )}
          </span>
          <span>{t.msg}</span>
          <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fermer">
            ×
          </button>
        </div>
      ))}
    </div>
  );

  return { showToast, ToastViewport };
}