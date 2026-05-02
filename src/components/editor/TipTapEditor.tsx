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
import type { SpeckulaTemplate } from '@/lib/templates';
import { EditorDropOverlay } from './EditorDropOverlay';
import { useFileDropImport } from '@/hooks/useFileDropImport';
import { insertTextAsNodes } from '@/lib/editor/insertTextAsNodes';
import { EditorToolbar } from './EditorToolbar';

const INLINE_AI_LEARNING_KEY = "Speckula-inline-ai-learning-v1";

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
  const { currentDocId, setIsSaving, setActiveContext, pendingInsertion, setPendingInsertion, newDocumentId, clearNewDocumentFlag, pendingImport, setPendingImport } = useAppStore();
  const lastExtractedHashRef = React.useRef<string | null>(null);
  const extractTimerRef = React.useRef<number | null>(null);
  const editorContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dropZoneRef = React.useRef<HTMLDivElement | null>(null);
  const dismissedInlineHashRef = React.useRef("");
  const activeInlineHashRef = React.useRef("");
  const learningRef = React.useRef<InlineLearningState>({ acceptedSuggestions: [], dismissedSuggestions: [] });
  const isMountedRef = React.useRef(true);
  // True while loadContent() is programmatically replacing editor content.
  // Auto-save must ignore `update` events during this window — otherwise the
  // setContent("") that clears the OLD doc fires the still-attached listener
  // and flushes an empty document back to Firestore on cleanup.
  const isLoadingContentRef = React.useRef(false);

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

    // Prefer `suggestions` (free-form completions) over `next_steps`
    // (questions / planning prompts). We fall back to next_steps only
    // when there is no completion available.
    const candidates = inlineSuggestion.suggestions?.length
      ? inlineSuggestion.suggestions
      : inlineSuggestion.next_steps;
    const suggestionText = candidates[0];
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
      // Guard the auto-save listener BEFORE any setContent call so the OLD
      // doc's effect (still subscribed until React reruns) doesn't see this
      // clear as a user edit and flush empty content on cleanup.
      isLoadingContentRef.current = true;
      setIsLoadingContent(true);
      editor.commands.setContent("");
      setInlineSuggestion(null);
      setIsInlineThinking(false);
      activeInlineHashRef.current = "";
      dismissedInlineHashRef.current = "";
      setActiveContext("");
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
        isLoadingContentRef.current = false;
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
    (template: SpeckulaTemplate) => {
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
        sessionKey: currentDocId,
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
      cancelAISuggestionTrigger(currentDocId);
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
        // Don't hijack Tab when the cursor is inside a list — ProseMirror
        // uses Tab/Shift-Tab there for indent/outdent and stealing it
        // breaks list editing.
        if (
          editor.isActive("bulletList") ||
          editor.isActive("orderedList") ||
          editor.isActive("taskList")
        ) {
          return;
        }
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
    // Wait until the editor is mounted AND any in-flight loadContent() has
    // settled — otherwise we can insert into a doc whose content is about
    // to be replaced.
    if (!editor || !pendingInsertion || isLoadingContent) return;

    editor.chain().focus().insertContent(`\n\n${pendingInsertion}\n\n`).run();
    setPendingInsertion(null);
  }, [editor, pendingInsertion, setPendingInsertion, isLoadingContent]);

  React.useEffect(() => {
    if (!editor || !pendingImport || !currentDocId || isLoadingContent) return;

    insertTextAsNodes(editor, pendingImport.text, {
      prependTitle: pendingImport.title ?? undefined,
    });
    setPendingImport(null);
  }, [editor, pendingImport, setPendingImport, currentDocId, isLoadingContent]);

  React.useEffect(() => {
    if (!editor || !user || !currentDocId || isLoadingContent) return;

    const contentText = editor.getText().trim();
    if (contentText.length < 120) return;

    // FNV-1a 32-bit hash; we only need a stable short fingerprint, not crypto.
    let h = 0x811c9dc5;
    for (let i = 0; i < contentText.length; i += 1) {
      h ^= contentText.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const currentHash = `${(h >>> 0).toString(16)}:${contentText.length}`;
    if (lastExtractedHashRef.current === currentHash) return;

    // Local timer captured by this effect run. The cleanup clears it
    // exclusively, avoiding the singleton-ref clobber pattern where a
    // newer render would race-clear an older render's pending timer.
    let timer: number | null = window.setTimeout(async () => {
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
    extractTimerRef.current = timer;

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
  }, [editor, user, currentDocId, isLoadingContent]);

  // Debounced auto-save: triggers on editor edits, and flushes on unmount /
  // doc-switch so view changes don't drop unsaved content.
  //
  // Doc-switch race fix: we capture a snapshot of the editor JSON on every
  // user-driven update into `pendingContentRef`, keyed by the docId at the
  // moment of the update. The cleanup flush reads that snapshot — never
  // `editor.getJSON()` directly — because by cleanup time the editor's
  // current content may already belong to the next doc.
  React.useEffect(() => {
    if (!editor || !user || !currentDocId || isLoadingContent) return;

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let saving = false;
    // The most recent user-edited content snapshot for THIS doc. null means
    // no unsaved edits since this effect started.
    let pendingSnapshot: { docId: string; content: object; title: string } | null = null;

    const flush = async () => {
      if (!pendingSnapshot || saving) return;
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;
      saving = true;
      if (isMountedRef.current) setIsSaving(true);
      try {
        await saveDocument(user.uid, snapshot.docId, {
          content: snapshot.content,
          title: snapshot.title,
        });
      } catch (error) {
        console.error("Failed to auto-save:", error);
        // Reinstate the snapshot so the next flush retries.
        pendingSnapshot = snapshot;
      } finally {
        saving = false;
        setTimeout(() => {
          if (isMountedRef.current) setIsSaving(false);
        }, 800);
      }
    };

    const onUpdate = () => {
      // Programmatic content swaps during doc-switch fire `update` too — those
      // are not user edits and must not mark the doc dirty.
      if (isLoadingContentRef.current) return;
      const latestDocs = useAppStore.getState().documents;
      const currentDoc = latestDocs.find(d => d.id === currentDocId);
      pendingSnapshot = {
        docId: currentDocId,
        content: editor.getJSON(),
        title: currentDoc?.title || "Untitled Document",
      };
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 2000);
    };

    editor.on("update", onUpdate);

    return () => {
      editor.off("update", onUpdate);
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      // Flush any pending edits captured for THIS doc before unmount/doc-switch.
      // Fire-and-forget; the Firestore SDK queues the write internally so it
      // survives unmount.
      if (pendingSnapshot) void flush();
    };
  }, [editor, user, currentDocId, setIsSaving, isLoadingContent]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div ref={editorContainerRef} className="relative h-full w-full">
      {isAutoExtracting && (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-primary/20 bg-card px-3 py-1.5 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="label-system text-[11px] text-primary">Extracting insights</span>
        </div>
      )}

      {isLoadingContent && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
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

      <EditorToolbar editor={editor} />

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

      {/* Word count footer */}
      {editor && (() => {
        const text = editor.state.doc.textContent;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const mins = Math.max(1, Math.ceil(words / 200));
        return (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-4 px-6 py-1.5 bg-card/60 border-t border-border/40 text-[10px] text-muted-foreground/50 font-mono pointer-events-none">
            <span>{words.toLocaleString()} words</span>
            <span>{chars.toLocaleString()} chars</span>
            <span>{mins} min read</span>
          </div>
        );
      })()}

      <TemplatePicker open={showTemplatePicker} onSelect={handleTemplateSelect} />
    </div>
  );
}

