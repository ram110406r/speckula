"use client";

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { Sparkles, Wand2, Lightbulb, Zap, Loader2 } from "lucide-react";

import { useAuth } from '@/lib/firebase/AuthProvider';
import { saveDocument, getDocument } from '@/lib/firebase/db';
import { useAppStore } from '@/store/useAppStore';
import { extractInsightsAction, processEditorAction } from '@/lib/ai/actions';

export function TipTapEditor() {
  const [mounted, setMounted] = React.useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);
  const { user } = useAuth();
  const { currentDocId, setIsSaving, documents, setActiveContext, pendingInsertion, setPendingInsertion } = useAppStore();
  const lastExtractedHashRef = React.useRef<string | null>(null);
  const extractTimerRef = React.useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Disable default heading to use our own extension
      }),
      Heading.configure({
        levels: [1, 2, 3]
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return 'Document Title...';
          }
          return 'Start typing your product thoughts...';
        },
      }),
      BubbleMenuExtension.configure({
        element: mounted ? document.querySelector('.bubble-menu') as HTMLElement : undefined,
      }),
    ],
    immediatelyRender: false,
    content: ``,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none w-full min-h-[500px] leading-[1.6] caret-primary font-sans',
      },
    },
  });

  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const handleAiAction = async (action: 'improve' | 'expand' | 'challenge') => {
    if (!editor || !user || isAiProcessing) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    if (!selectedText.trim()) return;

    setIsAiProcessing(true);
    try {
      const result = await processEditorAction(user.uid, selectedText, action);
      
      // Replace selection with original text + result if it's "expand" or "challenge", 
      // or just replace if it's "improve"
      if (action === 'improve') {
        editor.chain().focus().insertContentAt({ from, to }, result).run();
      } else {
        // For expand/challenge, we append it after the selection
        editor.chain().focus().insertContentAt(to, `\n\n> **AI ${action.toUpperCase()}:** ${result}\n\n`).run();
      }
    } catch (error) {
      console.error("AI Action failed:", error);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Load content when currentDocId changes
  React.useEffect(() => {
    if (!editor || !user || !currentDocId) return;

    const loadContent = async () => {
      setIsLoadingContent(true);
      try {
        const doc = await getDocument(user.uid, currentDocId);
        if (doc) {
          editor.commands.setContent(doc.content || "");
          lastExtractedHashRef.current = doc.lastInsightExtractionHash ?? null;
        } else {
          editor.commands.setContent("");
          lastExtractedHashRef.current = null;
        }
        setActiveContext(editor.getText().trim());
      } catch (error) {
        console.error("Error loading document:", error);
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [currentDocId, editor, user, setActiveContext]);

  React.useEffect(() => {
    if (!editor) return;

    const updateContext = () => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to).trim();
      setActiveContext(selectedText || editor.getText().trim());
    };

    updateContext();
    editor.on("update", updateContext);
    editor.on("selectionUpdate", updateContext);

    return () => {
      editor.off("update", updateContext);
      editor.off("selectionUpdate", updateContext);
    };
  }, [editor, setActiveContext]);

  React.useEffect(() => {
    if (!editor || !pendingInsertion) return;

    editor.chain().focus().insertContent(`\n\n${pendingInsertion}\n\n`).run();
    setPendingInsertion(null);
  }, [editor, pendingInsertion, setPendingInsertion]);

  React.useEffect(() => {
    if (!editor || !user || !currentDocId || isLoadingContent) return;

    const contentText = editor.getText().trim();
    if (contentText.length < 120) return;

    const currentHash = contentText;
    if (lastExtractedHashRef.current === currentHash) return;

    if (extractTimerRef.current) {
      window.clearTimeout(extractTimerRef.current);
    }

    extractTimerRef.current = window.setTimeout(async () => {
      setIsAutoExtracting(true);
      try {
        await extractInsightsAction(user.uid, editor.getJSON());
        await saveDocument(user.uid, currentDocId, {
          lastInsightExtractionHash: currentHash,
        });
        lastExtractedHashRef.current = currentHash;
      } catch (error) {
        console.error("Auto insight extraction failed:", error);
      } finally {
        setIsAutoExtracting(false);
      }
    }, 4000);

    return () => {
      if (extractTimerRef.current) {
        window.clearTimeout(extractTimerRef.current);
      }
    };
  }, [editor?.state.doc, editor, user, currentDocId, isLoadingContent]);

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
      {isAutoExtracting && (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1.5 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="label-system text-[11px] text-primary">Extracting insights</span>
        </div>
      )}

      {isLoadingContent && (
        <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Loading...</span>
          </div>
        </div>
      )}

      {editor && (
        <BubbleMenu editor={editor}>
          <div className="flex items-center gap-1 bg-sidebar border border-border shadow-xl rounded-lg p-1 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => handleAiAction('improve')}
              disabled={isAiProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 label-system text-[11px] hover:bg-primary/10 hover:text-primary rounded-md transition-all disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {isAiProcessing ? "Thinking..." : "Improve"}
            </button>
            <div className="w-px h-3 bg-border/60 mx-0.5" />
            <button
              onClick={() => handleAiAction('expand')}
              disabled={isAiProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 label-system text-[11px] hover:bg-primary/10 hover:text-primary rounded-md transition-all disabled:opacity-50"
            >
              <Wand2 className="h-3 w-3" />
              Expand
            </button>
            <button
              onClick={() => handleAiAction('challenge')}
              disabled={isAiProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 label-system text-[11px] hover:bg-primary/10 hover:text-primary rounded-md transition-all disabled:opacity-50"
            >
              <Lightbulb className="h-3 w-3" />
              Challenge
            </button>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="h-full w-full" />
    </div>
  );
}

