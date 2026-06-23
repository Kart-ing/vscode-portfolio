'use client';

/**
 * usePyodide — a thin React hook over the framework-agnostic pyodide.ts module.
 *
 * All the heavy lifting (CDN injection, singleton caching, stdout capture)
 * lives in `@/lib/pyodide`. This hook just mirrors the loader status into React
 * state and exposes typed `load` / `run` helpers a component can call.
 */

import { useState, useCallback } from 'react';
import {
  loadPyodideOnce,
  runPython,
  getPyStatus,
  type PyStatus,
  type RunPythonOptions,
  type RunPythonResult,
} from '@/lib/pyodide';

export interface UsePyodide {
  status: PyStatus;
  load: (onProgress?: (msg: string) => void) => Promise<void>;
  run: (
    code: string,
    handlers?: RunPythonOptions,
  ) => Promise<RunPythonResult>;
}

export function usePyodide(): UsePyodide {
  // Seed from the module singleton so a remount reflects an already-loaded
  // runtime instead of resetting to 'idle'.
  const [status, setStatus] = useState<PyStatus>(() => getPyStatus());

  const load = useCallback(
    async (onProgress?: (msg: string) => void): Promise<void> => {
      setStatus('loading');
      try {
        await loadPyodideOnce(onProgress);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        throw err;
      }
    },
    [],
  );

  const run = useCallback(
    async (
      code: string,
      handlers?: RunPythonOptions,
    ): Promise<RunPythonResult> => {
      // Reflect any load that runPython triggers internally.
      setStatus('loading');
      const result = await runPython(code, handlers);
      setStatus(getPyStatus());
      return result;
    },
    [],
  );

  return { status, load, run };
}
