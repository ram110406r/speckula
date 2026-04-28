import { auth } from "@/lib/firebase/config";

export interface URLImportResult {
  title: string | null;
  text: string;
  sourceUrl: string;
  charCount: number;
}

export interface PDFImportResult {
  text: string;
  charCount: number;
  pageCount: number;
}

export class ImportError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ImportError";
    this.status = status;
  }
}

interface BackendEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function getAuthToken(forceRefresh = false): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new ImportError("Authentication required.", 401);
  }
  return currentUser.getIdToken(forceRefresh);
}

async function unwrap<T>(response: Response): Promise<T> {
  const raw = await response.text().catch(() => "");
  let envelope: BackendEnvelope<T> | null = null;
  try {
    envelope = raw ? (JSON.parse(raw) as BackendEnvelope<T>) : null;
  } catch {
    envelope = null;
  }

  if (!response.ok || !envelope?.ok || envelope.data === undefined) {
    const message =
      envelope?.error ||
      (raw && raw.length < 300 ? raw : `Import call failed (${response.status})`);
    throw new ImportError(message, response.status);
  }
  return envelope.data;
}

// Run an authed fetch that retries once on 401 with a force-refreshed token.
// Stale tokens (cross-tab revocations, expired-near-boundary) are common
// enough that a single retry is the right tradeoff between robustness and
// the cost of a refresh call.
async function authedFetchWithRetry(
  url: string,
  init: RequestInit,
  buildBody: () => BodyInit | undefined
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getAuthToken(attempt > 0);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers, body: buildBody() });
    if (response.status === 401 && attempt === 0) {
      // Drain the body so the connection can be released, then retry with
      // a freshly minted token.
      await response.text().catch(() => undefined);
      continue;
    }
    return response;
  }
  // Should be unreachable, but TypeScript needs an exit.
  throw new ImportError("Auth retry exhausted.", 401);
}

export async function importFromURL(url: string): Promise<URLImportResult> {
  const response = await authedFetchWithRetry(
    "/api/import/url",
    { method: "POST", headers: { "Content-Type": "application/json" } },
    () => JSON.stringify({ url })
  );
  return unwrap<URLImportResult>(response);
}

export async function importFromPDF(file: File): Promise<PDFImportResult> {
  // FormData must be rebuilt per attempt — once a Body has been consumed
  // by fetch, it can't be re-used.
  const buildForm = (): BodyInit => {
    const form = new FormData();
    form.append("file", file, file.name);
    return form;
  };
  const response = await authedFetchWithRetry(
    "/api/import/file",
    { method: "POST" },
    buildForm
  );
  return unwrap<PDFImportResult>(response);
}
