import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TipTapEditor } from './TipTapEditor';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/lib/firebase/AuthProvider';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/lib/firebase/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => null),
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: () => ({}) },
}));

vi.mock('@tiptap/extension-heading', () => ({
  default: { configure: () => ({}) },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: { configure: () => ({}) },
}));

vi.mock('@/hooks/useFileDropImport', () => ({
  useFileDropImport: () => ({
    isDragging: false,
    errorMessage: '',
    isImporting: false,
    dismissError: vi.fn(),
  }),
}));

vi.mock('@/lib/firebase/db', () => ({
  saveDocument: vi.fn(),
  getDocument: vi.fn(),
}));

vi.mock('@/lib/ai/actions', () => ({
  extractInsightsAction: vi.fn(),
  processEditorAction: vi.fn(),
}));

vi.mock('@/lib/ai/aiTrigger', () => ({
  triggerAISuggestion: vi.fn(),
  cancelAISuggestionTrigger: vi.fn(),
}));

vi.mock('@/lib/ai/priorityEngine', () => ({
  prioritizeSteps: vi.fn(() => ({ high_priority: [], medium: [], low: [] })),
}));

vi.mock('@/lib/editor/insertTextAsNodes', () => ({
  insertTextAsNodes: vi.fn(),
}));

vi.mock('./InlineSuggestion', () => ({
  InlineSuggestion: () => <div data-testid="inline-suggestion" />,
}));

vi.mock('./TemplatePicker', () => ({
  TemplatePicker: () => <div data-testid="template-picker" />,
}));

vi.mock('./EditorDropOverlay', () => ({
  EditorDropOverlay: () => <div data-testid="drop-overlay" />,
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseAuth = vi.mocked(useAuth);

describe('TipTapEditor', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseAppStore.mockReturnValue({
      currentDocId: null,
      setIsSaving: vi.fn(),
      setActiveContext: vi.fn(),
      pendingInsertion: null,
      setPendingInsertion: vi.fn(),
      newDocumentId: null,
      clearNewDocumentFlag: vi.fn(),
      pendingImport: null,
      setPendingImport: vi.fn(),
    });
  });

  it('renders the editor shell after mount', async () => {
    render(<TipTapEditor />);
    expect(await screen.findByTestId('editor-content')).toBeInTheDocument();
    expect(screen.getByTestId('drop-overlay')).toBeInTheDocument();
  });
});
