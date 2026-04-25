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
  const envelope = (await response.json().catch(() => null)) as BackendEnvelope<T> | null;
  if (!response.ok || !envelope?.ok || envelope.data === undefined) {
    const message = envelope?.error || `Import call failed (${response.status})`;
    throw new ImportError(message, response.status);
  }
  return envelope.data;
}

export async function importFromURL(url: string): Promise<URLImportResult> {
  const token = await getAuthToken();
  const response = await fetch("/api/import/url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
  return unwrap<URLImportResult>(response);
}

export async function importFromPDF(file: File): Promise<PDFImportResult> {
  const token = await getAuthToken();
  const form = new FormData();
  form.append("file", file, file.name);

  const response = await fetch("/api/import/file", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  return unwrap<PDFImportResult>(response);
}
