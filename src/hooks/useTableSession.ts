import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionService, EphemeralSessionResult } from '../lib/sessionService';
import { DineTable } from '../types';

interface UseTableSessionProps {
  tenantSlug: string;
  tableNumber: string;
  permanentQrToken: string | null;
  fallbackTable?: DineTable;
}

export interface UseTableSessionReturn {
  sessionToken: string | null;
  remainingSeconds: number;
  formattedTime: string;
  isExpiringSoon: boolean; // <= 2 mins
  isCritical: boolean; // <= 30 secs
  isExpired: boolean;
  isLoading: boolean;
  error: string | null;
  isTampered: boolean;
  toggleTamper: () => void;
  expireSession: () => void;
  renewSession: (freshToken?: string) => Promise<boolean>;
  clearSession: () => void;
}

export function useTableSession({
  tenantSlug,
  tableNumber,
  permanentQrToken,
  fallbackTable,
}: UseTableSessionProps): UseTableSessionReturn {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isTampered, setIsTampered] = useState<boolean>(false);

  const expiresAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize or fetch session
  const initSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Check local session cache
      const cached = sessionService.getLocalSession(tenantSlug, tableNumber);
      if (cached && cached.isValid && cached.sessionToken && cached.expiresAt) {
        const expiresAtMs = new Date(cached.expiresAt).getTime();
        const diffSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);

        if (diffSeconds > 0) {
          setSessionToken(cached.sessionToken);
          setRemainingSeconds(diffSeconds);
          expiresAtRef.current = expiresAtMs;
          setIsLoading(false);
          return;
        }
      }

      // 2. Issue fresh session if permanent QR token is available
      if (permanentQrToken) {
        const res = await sessionService.issueEphemeralSession(
          tenantSlug,
          tableNumber,
          permanentQrToken,
          fallbackTable
        );

        if (res.isValid && res.sessionToken && res.expiresAt) {
          const expiresAtMs = new Date(res.expiresAt).getTime();
          const diffSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
          setSessionToken(res.sessionToken);
          setRemainingSeconds(diffSeconds);
          expiresAtRef.current = expiresAtMs;
        } else {
          setError(res.message || res.error || 'Failed to authenticate table session.');
          setRemainingSeconds(0);
        }
      } else {
        setError('No table QR token detected. Please scan the QR code at your table.');
        setRemainingSeconds(0);
      }
    } catch (err: any) {
      setError(err.message || 'Session initialization error');
      setRemainingSeconds(0);
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug, tableNumber, permanentQrToken, fallbackTable]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Real-time ticking countdown every second
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!expiresAtRef.current) return;

      const diffSec = Math.floor((expiresAtRef.current - Date.now()) / 1000);
      if (diffSec <= 0) {
        setRemainingSeconds(0);
        setSessionToken(null);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setRemainingSeconds(diffSec);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionToken]);

  // Session renewal handshake
  const renewSession = useCallback(
    async (freshToken?: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      const tokenToUse = freshToken || permanentQrToken;

      if (!tokenToUse) {
        setError('Please enter or scan your physical table QR code to renew.');
        setIsLoading(false);
        return false;
      }

      try {
        const res = await sessionService.renewSession(
          tenantSlug,
          tableNumber,
          tokenToUse,
          sessionToken || undefined,
          fallbackTable
        );

        if (res.isValid && res.sessionToken && res.expiresAt) {
          const expiresAtMs = new Date(res.expiresAt).getTime();
          const diffSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
          setSessionToken(res.sessionToken);
          setRemainingSeconds(diffSeconds);
          expiresAtRef.current = expiresAtMs;
          return true;
        } else {
          setError(res.message || 'Renewal failed. Please re-scan table QR.');
          return false;
        }
      } catch (err: any) {
        setError(err.message || 'Could not renew session.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [tenantSlug, tableNumber, permanentQrToken, sessionToken, fallbackTable]
  );

  const clearSession = useCallback(() => {
    sessionService.clearLocalSession(tenantSlug, tableNumber);
    setSessionToken(null);
    setRemainingSeconds(0);
    expiresAtRef.current = null;
  }, [tenantSlug, tableNumber]);

  // Formatted mm:ss
  const minutes = Math.floor(Math.max(0, remainingSeconds) / 60);
  const seconds = Math.max(0, remainingSeconds) % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const expireSession = useCallback(() => {
    expiresAtRef.current = Date.now() - 1000;
    setRemainingSeconds(0);
  }, []);

  const toggleTamper = useCallback(() => {
    setIsTampered((prev) => !prev);
  }, []);

  const isExpired = remainingSeconds <= 0 && !isLoading;
  const isExpiringSoon = remainingSeconds > 0 && remainingSeconds <= 120; // 2 minutes
  const isCritical = remainingSeconds > 0 && remainingSeconds <= 30; // 30 seconds

  return {
    sessionToken,
    remainingSeconds,
    formattedTime,
    isExpiringSoon,
    isCritical,
    isExpired,
    isLoading,
    error,
    isTampered,
    toggleTamper,
    expireSession,
    renewSession,
    clearSession,
  };
}
