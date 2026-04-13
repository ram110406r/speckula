"use client";

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

import { useAuth } from '@/lib/firebase/AuthProvider';
import { saveDocument } from '@/lib/firebase/db';
import { useAppStore } from '@/store/useAppStore';

export function TipTapEditor() {
  const [mounted, setMounted] = React.useState(false);
  const { user } = useAuth();
  const { currentDocId, setIsSaving } = useAppStore();

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
    immediatelyRender: false,
    content: ``,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none max-w-3xl mx-auto w-full min-h-[500px]',
      },
    },
    onUpdate: ({ editor }) => {
      // Logic handled in useEffect for debouncing
    }
  });

  // Debounced auto-save logic
  React.useEffect(() => {
    if (!editor || !user || !currentDocId) return;

    const handler = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveDocument(user.uid, currentDocId, {
          content: editor.getJSON(),
          title: "Untitled Document" // We'll extract this later
        });
      } catch (error) {
        console.error("Failed to auto-save:", error);
      } finally {
        setTimeout(() => setIsSaving(false), 1000); // Visual buffer
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(handler);
  }, [editor?.state.doc, user, currentDocId, setIsSaving]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <EditorContent editor={editor} className="h-full w-full" />
  );
}
