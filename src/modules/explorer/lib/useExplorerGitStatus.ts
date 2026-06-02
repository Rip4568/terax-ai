import { useEffect, useRef, useState } from "react";
import { native } from "@/modules/ai/lib/native";
import type { GitStatusSnapshot } from "@/modules/ai/lib/native";

export type GitDecorationKind = "U" | "A" | "M" | "D" | "R";

const SEVERITY: Record<GitDecorationKind, number> = {
  U: 5,
  D: 4,
  M: 3,
  R: 2,
  A: 1,
};

function decorationForFile(
  indexStatus: string,
  worktreeStatus: string,
  untracked: boolean,
): GitDecorationKind {
  if (untracked) return "U";
  const combined = indexStatus + worktreeStatus;
  if (combined.includes("D")) return "D";
  if (combined.includes("R")) return "R";
  if (combined.includes("A")) return "A";
  return "M";
}

function buildMap(
  snapshots: GitStatusSnapshot[],
  rootPath: string,
): ReadonlyMap<string, GitDecorationKind> {
  const map = new Map<string, GitDecorationKind>();

  const set = (absPath: string, kind: GitDecorationKind) => {
    const existing = map.get(absPath);
    if (!existing || SEVERITY[kind] > SEVERITY[existing]) {
      map.set(absPath, kind);
    }
  };

  for (const snapshot of snapshots) {
    const repoRoot = snapshot.repoRoot.endsWith("/")
      ? snapshot.repoRoot.slice(0, -1)
      : snapshot.repoRoot;

    for (const file of snapshot.changedFiles) {
      const absPath = `${repoRoot}/${file.path}`;
      const kind = decorationForFile(
        file.indexStatus,
        file.worktreeStatus,
        file.untracked,
      );
      set(absPath, kind);

      // Propagate to all ancestor directories up to (and including) rootPath.
      let dir = absPath.slice(0, absPath.lastIndexOf("/"));
      while (dir.length >= rootPath.length) {
        set(dir, kind);
        if (dir === rootPath) break;
        const next = dir.slice(0, dir.lastIndexOf("/"));
        if (next === dir) break;
        dir = next;
      }
    }
  }

  return map;
}

async function fetchSnapshots(
  rootPath: string,
): Promise<GitStatusSnapshot[]> {
  const top = await native.gitPanelSnapshot(rootPath);
  if (top.status) {
    return [top.status];
  }

  // No repo at root: scan one level of subdirectories.
  let subdirs: string[] = [];
  try {
    const entries = await native.readDir(rootPath);
    subdirs = entries
      .filter((e) => e.kind === "dir")
      .map((e) => `${rootPath}/${e.name}`);
  } catch {
    return [];
  }

  if (subdirs.length === 0) return [];

  const results = await Promise.allSettled(
    subdirs.map((dir) => native.gitPanelSnapshot(dir)),
  );

  // Deduplicate by repoRoot so we don't double-count.
  const seen = new Set<string>();
  const snapshots: GitStatusSnapshot[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.status) {
      const snap = result.value.status;
      if (!seen.has(snap.repoRoot)) {
        seen.add(snap.repoRoot);
        snapshots.push(snap);
      }
    }
  }
  return snapshots;
}

const THROTTLE_MS = 2000;
const INTERVAL_MS = 30_000;

export function useExplorerGitStatus(
  rootPath: string | null,
): ReadonlyMap<string, GitDecorationKind> {
  const [decorations, setDecorations] = useState<
    ReadonlyMap<string, GitDecorationKind>
  >(new Map());

  const lastFetchRef = useRef<number>(0);
  const rootPathRef = useRef(rootPath);
  rootPathRef.current = rootPath;

  useEffect(() => {
    if (!rootPath) {
      setDecorations(new Map());
      return;
    }

    let cancelled = false;

    const run = async () => {
      const now = Date.now();
      if (now - lastFetchRef.current < THROTTLE_MS) return;
      lastFetchRef.current = now;

      try {
        const snapshots = await fetchSnapshots(rootPath);
        if (!cancelled) {
          setDecorations(buildMap(snapshots, rootPath));
        }
      } catch {
        if (!cancelled) setDecorations(new Map());
      }
    };

    const handleFocus = () => void run();

    void run();
    window.addEventListener("focus", handleFocus);
    const timer = setInterval(() => void run(), INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      clearInterval(timer);
    };
  }, [rootPath]);

  return decorations;
}
