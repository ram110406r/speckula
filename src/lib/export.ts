function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(content: string, filename: string) {
  downloadFile(content, `${filename}.md`, "text/markdown;charset=utf-8");
}

export function downloadText(content: string, filename: string) {
  downloadFile(content, `${filename}.txt`, "text/plain;charset=utf-8");
}

export function downloadJSON(data: unknown, filename: string) {
  downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, "application/json;charset=utf-8");
}

export function downloadCSV(rows: (string | number)[][], filename: string) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const content = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  downloadFile(content, `${filename}.csv`, "text/csv;charset=utf-8");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "export";
}
