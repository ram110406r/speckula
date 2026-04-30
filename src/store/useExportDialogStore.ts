import { create } from 'zustand';

export interface ExportFormat {
  value: string;
  label: string;
}

export interface ExportDialogConfig {
  defaultFilename: string;
  formats: ExportFormat[];
  onExport: (filename: string, format: string) => void | Promise<void>;
}

interface ExportDialogStore {
  config: ExportDialogConfig | null;
  open: (config: ExportDialogConfig) => void;
  close: () => void;
}

export const useExportDialogStore = create<ExportDialogStore>((set) => ({
  config: null,
  open: (config) => set({ config }),
  close: () => set({ config: null }),
}));

export const exportDialog = {
  open: (config: ExportDialogConfig) => useExportDialogStore.getState().open(config),
};
