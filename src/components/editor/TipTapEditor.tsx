"use client";

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { Sparkles, Wand2, Lightbulb, Loader2 } from "lucide-react";

import { useAuth } from '@/lib/firebase/AuthProvider';
import { saveDocument, getDocument } from '@/lib/firebase/db';
import { useAppStore } from '@/store/useAppStore';
import {
  extractInsightsAction,
  processEditorAction,
  type InlineLearningProfile,
  type InlineSuggestionPayload,
} from '@/lib/ai/actions';
import { triggerAISuggestion, cancelAISuggestionTrigger } from '@/lib/ai/aiTrigger';
import { prioritizeSteps } from '@/lib/ai/priorityEngine';
import { InlineSuggestion } from './InlineSuggestion';
import { TemplatePicker } from './TemplatePicker';
import type { BuildcaseTemplate } from '@/lib/templates';
import { EditorDropOverlay } from './EditorDropOverlay';
import { useFileDropImport } from '@/hooks/useFileDropImport';
import { insertTextAsNodes } from '@/lib/editor/insertTextAsNodes';

const INLINE_AI_LEARNING_KEY = "buildcase-inline-ai-learning-v1";

interface InlineLearningState {
  acceptedSuggestions: string[];
  dismissedSuggestions: string[];
}

export function TipTapEditor() {
  const [mounted, setMounted] = React.useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);
  const [isInlineThinking, setIsInlineThinking] = useState(false);
  const [inlineSuggestion, setInlineSuggestion] = useState<InlineSuggestionPayload | null>(null);
  const [inlinePosition, setInlinePosition] = useState({ x: 16, y: 96 });
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { user } = useAuth();
  const { currentDocId, setIsSaving, documents, setActiveContext, pendingInsertion, setPendingInsertion, newDocumentId, clearNewDocumentFlag, pendingImport, setPendingImport } = useAppStore();
  const lastExtractedHashRef = React.useRef<string | null>(null);
  const extractTimerRef = React.useRef<number | null>(null);
  const editorContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dropZoneRef = React.useRef<HTMLDivElement | null>(null);
  const dismissedInlineHashRef = React.useRef("");
  const activeInlineHashRef = React.useRef("");
  const learningRef = React.useRef<InlineLearningState>({ acceptedSuggestions: [], dismissedSuggestions: [] });
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
          return 'What are you trying to solve today?';
        },
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

  const { isDragging, errorMessage, isImporting, dismissError } = useFileDropImport({
    editor,
    containerRef: dropZoneRef,
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(INLINE_AI_LEARNING_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<InlineLearningState>;
      learningRef.current = {
        acceptedSuggestions: Array.isArray(parsed.acceptedSuggestions)
          ? parsed.acceptedSuggestions.filter((item): item is string => typeof item === "string").slice(-30)
          : [],
        dismissedSuggestions: Array.isArray(parsed.dismissedSuggestions)
          ? parsed.dismissedSuggestions.filter((item): item is string => typeof item === "string").slice(-30)
          : [],
      };
    } catch (error) {
      console.error("Failed to load inline AI learning state:", error);
    }
  }, []);

  const persistLearningState = React.useCallback((nextState: InlineLearningState) => {
    learningRef.current = nextState;
    try {
      window.localStorage.setItem(INLINE_AI_LEARNING_KEY, JSON.stringify(nextState));
    } catch (error) {
      console.error("Failed to persist inline AI learning state:", error);
    }
  }, []);

  const getLearningProfile = React.useCallback((): InlineLearningProfile => {
    const current = learningRef.current;
    return {
      accepted: current.acceptedSuggestions.slice(-5),
      dismissed: current.dismissedSuggestions.slice(-5),
    };
  }, []);

  const dismissInlineSuggestion = React.useCallback(() => {
    if (activeInlineHashRef.current) {
      dismissedInlineHashRef.current = activeInlineHashRef.current;
    }

    if (inlineSuggestion?.suggestions?.[0]) {
      const current = learningRef.current;
      persistLearningState({
        acceptedSuggestions: current.acceptedSuggestions,
        dismissedSuggestions: [...current.dismissedSuggestions, inlineSuggestion.suggestions[0]].slice(-30),
      });
    }

    setInlineSuggestion(null);
    setIsInlineThinking(false);
  }, [inlineSuggestion, persistLearningState]);

  const acceptInlineSuggestion = React.useCallback(() => {
    if (!editor || !inlineSuggestion) return;

    const suggestionText = (inlineSuggestion.suggestions ?? inlineSuggestion.next_steps)[0];
    if (!suggestionText) return;

    const replacement = inlineSuggestion.stage === "problem" || inlineSuggestion.stage === "metrics"
      ? `${suggestionText}.`
      : suggestionText;

    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      editor.chain().focus().insertContentAt({ from, to }, replacement).run();
    } else {
      editor.chain().focus().insertContentAt(from, `${replacement} `).run();
    }

    const current = learningRef.current;
    persistLearningState({
      acceptedSuggestions: [...current.acceptedSuggestions, suggestionText].slice(-30),
      dismissedSuggestions: current.dismissedSuggestions,
    });

    dismissInlineSuggestion();
  }, [editor, inlineSuggestion, dismissInlineSuggestion, persistLearningState]);

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
      editor.commands.setContent("");
      setInlineSuggestion(null);
      setIsInlineThinking(false);
      activeInlineHashRef.current = "";
      dismissedInlineHashRef.current = "";
      setActiveContext("");
      setIsLoadingContent(true);
      try {
        const doc = await getDocument(user.uid, currentDocId);
        if (doc) {
          try {
            editor.commands.setContent(doc.content || "");
          } catch (contentError) {
            // Malformed Firestore content shouldn't wedge the editor — fall back to empty.
            console.error("Invalid TipTap content in Firestore:", contentError);
            editor.commands.setContent("");
          }
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
    if (!editor || !currentDocId || isLoadingContent) return;
    if (newDocumentId !== currentDocId) return;
    if (!editor.isEmpty) return;
    setShowTemplatePicker(true);
  }, [editor, currentDocId, isLoadingContent, newDocumentId]);

  const handleTemplateSelect = React.useCallback(
    (template: BuildcaseTemplate) => {
      if (editor && template.id !== "blank") {
        editor.commands.setContent(template.content);
        editor.commands.focus("start");
      }
      setShowTemplatePicker(false);
      if (currentDocId) clearNewDocumentFlag(currentDocId);
    },
    [editor, currentDocId, clearNewDocumentFlag]
  );

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
    if (!editor || !user || !currentDocId || isLoadingContent) return;

    const updateInlinePosition = () => {
      if (!editorContainerRef.current) return;

      try {
        const containerRect = editorContainerRef.current.getBoundingClientRect();
        const coords = editor.view.coordsAtPos(editor.state.selection.from);

        const nextX = Math.max(12, Math.min(coords.left - containerRect.left, containerRect.width - 340));
        const nextY = Math.max(64, Math.min(coords.bottom - containerRect.top + 8, containerRect.height - 120));
        setInlinePosition({ x: nextX, y: nextY });
      } catch {
        setInlinePosition((prev) => prev);
      }
    };

    const requestInlineSuggestion = () => {
      const fullText = editor.getText();
      const cursorOffset = editor.state.doc.textBetween(0, editor.state.selection.from, "\n", "\n").length;

      updateInlinePosition();

      triggerAISuggestion({
        text: fullText,
        cursorPos: cursorOffset,
        learning: getLearningProfile(),
        onStart: () => setIsInlineThinking(true),
        onSuggestion: (result) => {
          if (!result) {
            setInlineSuggestion(null);
            setIsInlineThinking(false);
            return;
          }

          if (result.contextHash === dismissedInlineHashRef.current) {
            setInlineSuggestion(null);
            setIsInlineThinking(false);
            return;
          }

          setIsInlineThinking(false);
          activeInlineHashRef.current = result.contextHash;
          const prioritized = prioritizeSteps(result.suggestion.next_steps);
          setInlineSuggestion({
            stage: result.suggestion.stage,
            next_steps: [...prioritized.high_priority, ...prioritized.medium],
          });
        },
        onError: (error) => {
          console.error("Inline suggestion failed:", error);
          setIsInlineThinking(false);
        },
      });
    };

    requestInlineSuggestion();
    editor.on("update", requestInlineSuggestion);
    editor.on("selectionUpdate", requestInlineSuggestion);

    return () => {
      cancelAISuggestionTrigger();
      editor.off("update", requestInlineSuggestion);
      editor.off("selectionUpdate", requestInlineSuggestion);
    };
  }, [editor, user, currentDocId, isLoadingContent, getLearningProfile]);

  React.useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (inlineSuggestion || isInlineThinking)) {
        event.preventDefault();
        dismissInlineSuggestion();
        return;
      }

      if (event.key === "Tab" && inlineSuggestion) {
        event.preventDefault();
        acceptInlineSuggestion();
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown);

    return () => {
      editor.view.dom.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, inlineSuggestion, isInlineThinking, dismissInlineSuggestion, acceptInlineSuggestion]);

  React.useEffect(() => {
    if (!editor || !pendingInsertion) return;

    editor.chain().focus().insertContent(`\n\n${pendingInsertion}\n\n`).run();
    setPendingInsertion(null);
  }, [editor, pendingInsertion, setPendingInsertion]);

  React.useEffect(() => {
    if (!editor || !pendingImport) return;

    insertTextAsNodes(editor, pendingImport.text, {
      prependTitle: pendingImport.title ?? undefined,
    });
    setPendingImport(null);
  }, [editor, pendingImport, setPendingImport]);

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
      if (!isMountedRef.current) return;
      setIsAutoExtracting(true);
      try {
        await extractInsightsAction(user.uid, editor.getJSON(), currentDocId);
        if (!isMountedRef.current) return;
        await saveDocument(user.uid, currentDocId, {
          lastInsightExtractionHash: currentHash,
        });
        lastExtractedHashRef.current = currentHash;
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error("Auto insight extraction failed:", error);
      } finally {
        if (isMountedRef.current) setIsAutoExtracting(false);
      }
    }, 4000);

    return () => {
      if (extractTimerRef.current) {
        window.clearTimeout(extractTimerRef.current);
      }
    };
  }, [editor, user, currentDocId, isLoadingContent]);

  // Debounced auto-save logic
  React.useEffect(() => {
    if (!editor || !user || !currentDocId || isLoadingContent) return;

    const handler = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setIsSaving(true);
      try {
        const currentDoc = documents.find(d => d.id === currentDocId);
        await saveDocument(user.uid, currentDocId, {
          content: editor.getJSON(),
          title: currentDoc?.title || "Untitled Document"
        });
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error("Failed to auto-save:", error);
      } finally {
        setTimeout(() => {
          if (isMountedRef.current) setIsSaving(false);
        }, 800);
      }
    }, 2000);

    return () => clearTimeout(handler);
  }, [editor, user, currentDocId, setIsSaving, isLoadingContent, documents]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div ref={editorContainerRef} className="relative h-full w-full">
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

      <InlineSuggestion
        suggestion={inlineSuggestion}
        loading={isInlineThinking}
        position={inlinePosition}
        onAccept={acceptInlineSuggestion}
        onDismiss={dismissInlineSuggestion}
      />

      <div ref={dropZoneRef} className="relative h-full w-full">
        <EditorDropOverlay visible={isDragging} />
        {isImporting && !isDragging && (
          <div className="pointer-events-none absolute right-3 top-3 z-40 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Importing…
          </div>
        )}
        <EditorContent editor={editor} className="h-full w-full" />
      </div>

      {errorMessage && (
        <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-md">
          <button type="button" onClick={dismissError} className="font-medium">{errorMessage}</button>
        </div>
      )}

      <TemplatePicker open={showTemplatePicker} onSelect={handleTemplateSelect} />
    </div>
  );
}

