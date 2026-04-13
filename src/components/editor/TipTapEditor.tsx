"use client";

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

import { useAuth } from '@/lib/firebase/AuthProvider';
import { saveDocument, getDocument } from '@/lib/firebase/db';
import { useAppStore } from '@/store/useAppStore';

export function TipTapEditor() {
  const [mounted, setMounted] = React.useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const { user } = useAuth();
  const { currentDocId, setIsSaving, documents } = useAppStore();

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
        class: 'tiptap focus:outline-none w-full min-h-[500px] leading-[1.6] caret-primary',
      },
    },
  });

  // Load content when currentDocId changes
  React.useEffect(() => {
    if (!editor || !user || !currentDocId) return;

    const loadContent = async () => {
      setIsLoadingContent(true);
      try {
        const doc = await getDocument(user.uid, currentDocId);
        if (doc) {
          editor.commands.setContent(doc.content || "");
        } else {
          editor.commands.setContent("");
        }
      } catch (error) {
        console.error("Error loading document:", error);
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [currentDocId, editor, user]);

  // Debounced auto-save logic
  React.useEffect(() => {
    if (!editor || !user || !currentDocId || isLoadingContent) return;

    const handler = setTimeout(async () => {
      setIsSaving(true);
      try {
        const currentDoc = documents.find(d => d.id === currentDocId);
        await saveDocument(user.uid, currentDocId, {
          content: editor.getJSON(),
          title: currentDoc?.title || "Untitled Document"
        });
      } catch (error) {
        console.error("Failed to auto-save:", error);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(handler);
  }, [editor?.state.doc, user, currentDocId, setIsSaving, isLoadingContent, documents]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative h-full w-full">
      {isLoadingContent && (
        <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Loading...</span>
          </div>
        </div>
      )}
      <EditorContent editor={editor} className="h-full w-full" />
    </div>
  );
}

