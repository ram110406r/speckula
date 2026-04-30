import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

// ── primitives ───────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
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

// ── signals / insights ───────────────────────────────────────────────────────

type InsightCategory = "pain-point" | "opportunity" | "user-segment" | "pattern";

export interface ExportableInsight {
  category: string;
  title: string;
  description?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  "pain-point": "Pain Points",
  "opportunity": "Opportunities",
  "user-segment": "User Segments",
  "pattern": "Patterns",
};

const CATEGORY_ORDER: InsightCategory[] = ["pain-point", "opportunity", "user-segment", "pattern"];

function groupInsights(insights: ExportableInsight[]) {
  return CATEGORY_ORDER.reduce<Record<string, ExportableInsight[]>>((acc, cat) => {
    const items = insights.filter((i) => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});
}

export function generateInsightsMarkdown(insights: ExportableInsight[]): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const lines: string[] = [`# Product Intelligence Report`, ``, `*Generated ${date} · ${insights.length} signal${insights.length !== 1 ? "s" : ""}*`, ``];

  const grouped = groupInsights(insights);
  for (const cat of CATEGORY_ORDER) {
    const items = grouped[cat];
    if (!items) continue;
    lines.push(`## ${CATEGORY_LABELS[cat] ?? cat}`, ``);
    for (const item of items) {
      lines.push(`### ${item.title}`);
      if (item.description) lines.push(``, item.description);
      lines.push(``);
    }
  }
  return lines.join("\n");
}

export async function downloadInsightsDocx(insights: ExportableInsight[], filename: string) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const children: Paragraph[] = [
    new Paragraph({
      text: "Product Intelligence Report",
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${date} · ${insights.length} signal${insights.length !== 1 ? "s" : ""}`, italics: true, color: "888888", size: 20 })],
      spacing: { after: 400 },
    }),
  ];

  const grouped = groupInsights(insights);
  for (const cat of CATEGORY_ORDER) {
    const items = grouped[cat];
    if (!items) continue;

    children.push(
      new Paragraph({
        text: CATEGORY_LABELS[cat] ?? cat,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
      })
    );

    for (const item of items) {
      children.push(
        new Paragraph({
          text: item.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
        })
      );
      if (item.description) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: item.description, size: 22 })],
            spacing: { after: 160 },
          })
        );
      }
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${filename}.docx`);
}

// ── PRD ──────────────────────────────────────────────────────────────────────

function parsePRDMarkdown(md: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = md.split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      continue;
    }

    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    const bullet = line.match(/^[-*] (.+)/);
    const numbered = line.match(/^\d+\. (.+)/);

    if (h1) {
      paragraphs.push(new Paragraph({ text: h1[1], heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } }));
    } else if (h2) {
      paragraphs.push(new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
    } else if (h3) {
      paragraphs.push(new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 60 } }));
    } else if (bullet) {
      paragraphs.push(new Paragraph({ text: bullet[1], bullet: { level: 0 }, spacing: { after: 60 } }));
    } else if (numbered) {
      paragraphs.push(new Paragraph({ text: numbered[1], numbering: { reference: "default-numbering", level: 0 }, spacing: { after: 60 } }));
    } else {
      // Inline bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const runs = parts.map((p) => {
        const bold = p.match(/^\*\*(.+)\*\*$/);
        return bold ? new TextRun({ text: bold[1], bold: true, size: 22 }) : new TextRun({ text: p, size: 22 });
      });
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 120 } }));
    }
  }

  return paragraphs;
}

export async function downloadPRDDocx(title: string, content: string, filename: string) {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [new TextRun({ text: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), italics: true, color: "888888", size: 20 })],
      spacing: { after: 480 },
    }),
    ...parsePRDMarkdown(content),
  ];

  const doc = new Document({
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT }],
      }],
    },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${filename}.docx`);
}

// ── decisions ────────────────────────────────────────────────────────────────

export interface ExportableDecision {
  title: string;
  priority: string;
  score: number;
  justification: string;
  userStory?: string;
  tradeoffs?: string;
  impact: number;
  effort: number;
  confidence?: number;
  demand?: number;
  health?: string;
}

export function generateDecisionsMarkdown(decisions: ExportableDecision[]): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const lines: string[] = [
    `# Decision Log`,
    ``,
    `*Generated ${date} · ${decisions.length} decision${decisions.length !== 1 ? "s" : ""}*`,
    ``,
  ];
  for (const d of decisions) {
    lines.push(`## ${d.title}`);
    lines.push(``);
    lines.push(`**Priority:** ${d.priority} | **Score:** ${d.score}/100 | **Health:** ${d.health ?? "—"}`);
    lines.push(``);
    lines.push(`**Justification:** ${d.justification}`);
    if (d.userStory) { lines.push(``); lines.push(`**User Story:** ${d.userStory}`); }
    if (d.tradeoffs) { lines.push(``); lines.push(`**Trade-offs:** ${d.tradeoffs}`); }
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Impact | ${d.impact} |`);
    lines.push(`| Effort | ${d.effort} |`);
    if (d.confidence !== undefined) lines.push(`| Confidence | ${d.confidence} |`);
    if (d.demand !== undefined) lines.push(`| Demand | ${d.demand} |`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }
  return lines.join("\n");
}

// ── tasks CSV table (re-export shape helpers) ────────────────────────────────

export async function downloadTasksDocx(
  tasks: { title: string; status: string; priority: string; effort?: number | string; category?: string; description?: string }[],
  filename: string
) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Title", "Status", "Priority", "Effort", "Category"].map(
      (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })] })
    ),
  });

  const dataRows = tasks.map(
    (t) => new TableRow({
      children: [t.title, t.status, t.priority ?? "", String(t.effort ?? ""), t.category ?? ""].map(
        (v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })] })
      ),
    })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: "Execution Tasks", heading: HeadingLevel.TITLE, spacing: { after: 400 } }),
        table,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${filename}.docx`);
}
