'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetchSession, type AuthSessionState, type OrgSelection } from '@/lib/client/auth';

const STORAGE_KEY = 'denta-org-selection';

/** Owns the verified auth state and the selected org/branch. The session cookie stays authoritative. */
export function useAuthSession() {
  const [auth, setAuth] = useState<AuthSessionState | null>(null);
  const [selection, setSelection] = useState<OrgSelection | null>(null);

  useEffect(() => {
    let active = true;
    void fetchSession()
      .then((next) => {
        if (!active) return;
        setAuth(next);
        if (next.authenticated && next.contexts.length > 0) {
          setSelection(firstValid(next, readStored()));
        }
      })
      .catch(() => {
        if (active) setAuth({ authenticated: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAuthChange = useCallback((next: AuthSessionState, nextSelection: OrgSelection | null) => {
    setAuth(next);
    const valid =
      next.authenticated && nextSelection ? firstValid(next, nextSelection) : null;
    setSelection(valid);
    try {
      if (valid) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Persistence is best-effort; the session cookie remains authoritative.
    }
  }, []);

  return { auth, selection, handleAuthChange };
}

function readStored(): OrgSelection | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrgSelection>;
    if (typeof parsed.tenantId === 'string' && typeof parsed.branchId === 'string')
      return { tenantId: parsed.tenantId, branchId: parsed.branchId };
    return null;
  } catch {
    return null;
  }
}

function firstValid(auth: AuthSessionState, preferred: OrgSelection | null): OrgSelection {
  if (!auth.authenticated) throw new Error('Sin sesión para seleccionar sede.');
  const valid = auth.contexts.find(
    (c) => c.tenantId === preferred?.tenantId && c.branchId === preferred?.branchId,
  );
  const first = valid ?? auth.contexts[0];
  return { tenantId: first.tenantId, branchId: first.branchId };
}
