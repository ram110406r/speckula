// Minimal Firestore REST API client for server-side route handlers.
// Uses a Firebase ID token (from the extension) as auth — scoped to that user.
// No firebase-admin required.

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { timestampValue: string };

type FirestoreFields = Record<string, FirestoreValue>;

function fsToJs(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fsToJs);
  if ("mapValue" in value) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      obj[k] = fsToJs(v);
    }
    return obj;
  }
  return null;
}

function fieldsToDoc(fields: FirestoreFields | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fsToJs(v);
  }
  return out;
}

export async function firestoreGet(
  path: string,
  idToken: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return fieldsToDoc(data.fields);
}

export async function firestoreSet(
  path: string,
  fields: Record<string, unknown>,
  idToken: string,
  merge = true
): Promise<boolean> {
  const fsFields: FirestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    fsFields[k] = jsToFs(v);
  }

  const updateMask = merge
    ? `?updateMask.fieldPaths=${Object.keys(fields).join("&updateMask.fieldPaths=")}`
    : "";

  const res = await fetch(`${BASE_URL}/${path}${updateMask}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: fsFields }),
  });
  return res.ok;
}

function jsToFs(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(jsToFs) } };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = jsToFs(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}
