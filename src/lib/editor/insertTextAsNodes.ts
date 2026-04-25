import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";

interface InsertOptions {
  prependTitle?: string;
}

export function insertTextAsNodes(editor: Editor, text: string, options?: InsertOptions): void {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);

  const paragraphNodes: JSONContent[] = lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  }));

  const nodes: JSONContent[] = [];
  if (options?.prependTitle && options.prependTitle.trim().length > 0) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: options.prependTitle.trim() }],
    });
  }
  nodes.push(...paragraphNodes);

  if (nodes.length === 0) return;

  editor.chain().focus().insertContent(nodes).run();
}
