"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

export function TipTapEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return 'Document Title...';
          }
          return 'Start typing your product thoughts...';
        },
      }),
    ],
    content: ``,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none max-w-3xl mx-auto w-full min-h-[500px]',
      },
    },
  });

  return (
    <EditorContent editor={editor} className="h-full w-full" />
  );
}
