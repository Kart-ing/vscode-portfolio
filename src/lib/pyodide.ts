/**
 * pyodide.ts — Framework-agnostic singleton loader + runner for Pyodide
 * (CPython compiled to WebAssembly).
 *
 * This module loads Pyodide from the jsDelivr CDN exactly ONCE per page and
 * exposes a tiny API to run Python with captured stdout/stderr. It deliberately
 * does NOT import React so it can be reused anywhere (terminal, REPL, tests).
 *
 * Public API:
 *   - type PyStatus
 *   - getPyStatus(): PyStatus
 *   - loadPyodideOnce(onProgress?): Promise<PyodideInterface>
 *   - runPython(code, opts?): Promise<{ ok, output, error? }>
 */

// Pinned Pyodide version. Bump deliberately — the WASM payload is large and
// version skew between the script and indexURL will break loading.
const PYODIDE_VERSION = 'v0.26.2';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`;

// Pyodide ships no bundled types in this project, so `any` is acceptable for the
// instance itself. We keep our own function signatures strongly typed below.
type PyodideInterface = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type PyStatus = 'idle' | 'loading' | 'ready' | 'error';

declare global {
  interface Window {
    // Injected by the Pyodide CDN <script>. Optional until the script loads.
    loadPyodide?: (cfg?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton state.
// ---------------------------------------------------------------------------

let status: PyStatus = 'idle';
let pyodideInstance: PyodideInterface | null = null;
// The in-flight load promise. Cached so concurrent callers share one load.
let loadPromise: Promise<PyodideInterface> | null = null;
// The in-flight CDN script-injection promise (separate from Pyodide init).
let scriptPromise: Promise<void> | null = null;

/** Current loader status. Cheap synchronous read for UIs. */
export function getPyStatus(): PyStatus {
  return status;
}

// ---------------------------------------------------------------------------
// Dynamic <script> injection helper.
// ---------------------------------------------------------------------------

/**
 * Inject a <script src> into <head> and resolve when it has loaded.
 * Reuses an existing tag (and a single in-flight promise) so it never
 * double-injects. SSR-guarded by callers.
 */
function injectScript(src: string): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    // If window.loadPyodide already exists, the script is effectively present.
    if (window.loadPyodide) {
      resolve();
      return;
    }

    // Reuse an existing tag if a previous attempt already added one.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === 'true' || window.loadPyodide) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error(`Failed to load script: ${src}`)),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      // Allow a future retry by clearing the cached promise.
      scriptPromise = null;
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// ---------------------------------------------------------------------------
// Loader.
// ---------------------------------------------------------------------------

/**
 * Load Pyodide exactly once. Subsequent calls return the cached instance (or
 * the in-flight promise). Injects the CDN script on first call only.
 *
 * @param onProgress optional human-readable progress messages for a UI.
 */
export function loadPyodideOnce(
  onProgress?: (msg: string) => void,
): Promise<PyodideInterface> {
  // SSR guard — there is no window/document on the server.
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Pyodide can only be loaded in the browser.'),
    );
  }

  // Already booted.
  if (pyodideInstance) return Promise.resolve(pyodideInstance);
  // Boot in progress — share the same promise.
  if (loadPromise) return loadPromise;

  status = 'loading';

  loadPromise = (async () => {
    try {
      onProgress?.('Fetching Pyodide runtime from CDN…');
      await injectScript(PYODIDE_SCRIPT_URL);

      if (typeof window.loadPyodide !== 'function') {
        throw new Error('window.loadPyodide is unavailable after script load.');
      }

      onProgress?.('Booting CPython (WebAssembly)…');
      const instance = await window.loadPyodide({ indexURL: PYODIDE_INDEX_URL });

      pyodideInstance = instance;
      status = 'ready';
      onProgress?.('Python ready.');
      return instance;
    } catch (err) {
      status = 'error';
      // Reset so a later attempt can retry from scratch.
      loadPromise = null;
      throw err instanceof Error ? err : new Error(String(err));
    }
  })();

  return loadPromise;
}

// ---------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------

export interface RunPythonOptions {
  onStdout?: (s: string) => void;
  onStderr?: (s: string) => void;
}

export interface RunPythonResult {
  ok: boolean;
  output: string;
  error?: string;
}

/**
 * Run a Python source string. Ensures Pyodide is loaded first.
 *
 * stdout/stderr are redirected and captured: every batched write is forwarded
 * to the optional handlers AND accumulated into `output`, so callers that pass
 * no handlers still receive the full text in the result.
 */
export async function runPython(
  code: string,
  opts: RunPythonOptions = {},
): Promise<RunPythonResult> {
  let pyodide: PyodideInterface;
  try {
    pyodide = await loadPyodideOnce();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, output: '', error: `Failed to load Python: ${error}` };
  }

  let output = '';

  // Pyodide ≥0.23 stream API. Batched callbacks receive chunks of text.
  pyodide.setStdout({
    batched: (s: string) => {
      output += s;
      opts.onStdout?.(s);
    },
  });
  pyodide.setStderr({
    batched: (s: string) => {
      output += s;
      opts.onStderr?.(s);
    },
  });

  try {
    await pyodide.runPythonAsync(code);
    return { ok: true, output };
  } catch (err) {
    // Pyodide raises a PythonError whose message already contains the formatted
    // Python traceback. Surface it verbatim.
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, output, error };
  } finally {
    // Restore default streams so we don't leak our closures into later runs.
    pyodide.setStdout({});
    pyodide.setStderr({});
  }
}
