import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_START = 1000;
const DEFAULT_END = 9999;
const DEFAULT_TTL = 30_000;

export function useActivePorts(opts?: {
  start?: number;
  end?: number;
  cacheTtlMs?: number;
}) {
  const start = opts?.start ?? DEFAULT_START;
  const end = opts?.end ?? DEFAULT_END;
  const cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_TTL;

  const [ports, setPorts] = useState<number[]>([]);
  const [scanning, setScanning] = useState(false);
  const cacheRef = useRef<{ ports: number[]; ts: number } | null>(null);
  const genRef = useRef(0);

  const scan = useCallback(
    (force = false) => {
      if (
        !force &&
        cacheRef.current &&
        Date.now() - cacheRef.current.ts < cacheTtlMs
      ) {
        setPorts(cacheRef.current.ports);
        return;
      }
      const gen = ++genRef.current;
      setScanning(true);
      invoke<number[]>("net_scan_ports", { start, end })
        .then(async (tcpPorts) => {
          if (gen !== genRef.current) return;
          const httpPorts = await verifyHttp(tcpPorts);
          if (gen !== genRef.current) return;
          cacheRef.current = { ports: httpPorts, ts: Date.now() };
          setPorts(httpPorts);
        })
        .catch(() => {
          // scan failure is benign -- keep previous state
        })
        .finally(() => {
          if (gen === genRef.current) setScanning(false);
        });
    },
    [start, end, cacheTtlMs],
  );

  const refresh = useCallback(() => {
    scan(true);
  }, [scan]);

  const killPort = useCallback(
    async (port: number) => {
      await invoke("net_kill_port", { port }).catch(() => {});
      // Rescan after kill to remove the port from the active list
      scan(true);
    },
    [scan],
  );

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ports, scanning, scan, refresh, killPort };
}

async function verifyHttp(ports: number[]): Promise<number[]> {
  const results = await Promise.all(
    ports.map(async (port) => {
      const ok = await probePort(port);
      return ok ? port : null;
    }),
  );
  return results.filter((p): p is number => p !== null);
}

async function probePort(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    });
    return true;
  } catch {
    return false;
  }
}
