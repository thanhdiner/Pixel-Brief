import { create } from 'zustand';
import { Annotation, ToolType } from './types';

interface State {
  annotations: Annotation[];
  selectedId: string | null;
  activeTool: ToolType;
  strokeColor: string;
  strokeWidth: number;
  visible: boolean;
  overlayOpen: boolean;
  sidebarOpen: boolean;
  isCapturing: boolean;
  history: Annotation[][];
  historyIndex: number;
}

interface Actions {
  setOverlayOpen: (open: boolean) => void;
  toggleOverlay: () => void;
  setSidebarOpen: (open: boolean) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (ann: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setVisible: (visible: boolean) => void;
  setIsCapturing: (capturing: boolean) => void;
}

const getStorageKey = () => {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `pixelbrief:${origin}:${pathname}`;
};

const saveToStorage = (annotations: Annotation[]) => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const key = getStorageKey();
    chrome.storage.local.set({ [key]: annotations });
  }
};

export const useStore = create<State & Actions>((set, get) => ({
  annotations: [],
  selectedId: null,
  activeTool: 'select',
  strokeColor: '#ef4444', // Red (Tailwind red-500)
  strokeWidth: 4,
  visible: true,
  overlayOpen: false,
  sidebarOpen: false,
  isCapturing: false,
  history: [[]],
  historyIndex: 0,

  setOverlayOpen: (open) => {
    set({ overlayOpen: open });
    if (!open) {
      set({ activeTool: 'select', selectedId: null });
    }
  },
  
  toggleOverlay: () => {
    const nextOpen = !get().overlayOpen;
    set({ overlayOpen: nextOpen });
    if (nextOpen) {
      set({ visible: true });
    } else {
      set({ activeTool: 'select', selectedId: null });
    }
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setIsCapturing: (capturing) => set({ isCapturing: capturing }),

  setAnnotations: (annotations) => {
    set({
      annotations,
      history: [annotations],
      historyIndex: 0
    });
  },

  addAnnotation: (ann) => {
    const { annotations, history, historyIndex } = get();
    const cleanHistory = history.slice(0, historyIndex + 1);
    const nextAnnotations = [...annotations, ann];
    
    set({
      annotations: nextAnnotations,
      history: [...cleanHistory, nextAnnotations],
      historyIndex: cleanHistory.length,
      selectedId: ann.id // Automatically select newly created annotations (except freehand/arrows if desired, but good for editing notes)
    });
    
    saveToStorage(nextAnnotations);
  },

  updateAnnotation: (id, updates) => {
    const { annotations, history, historyIndex } = get();
    const nextAnnotations = annotations.map((ann) =>
      ann.id === id ? { ...ann, ...updates } : ann
    );
    const cleanHistory = history.slice(0, historyIndex + 1);
    
    set({
      annotations: nextAnnotations,
      history: [...cleanHistory, nextAnnotations],
      historyIndex: cleanHistory.length
    });
    
    saveToStorage(nextAnnotations);
  },

  deleteAnnotation: (id) => {
    const { annotations, history, historyIndex, selectedId } = get();
    const nextAnnotations = annotations.filter((ann) => ann.id !== id);
    const cleanHistory = history.slice(0, historyIndex + 1);
    
    set({
      annotations: nextAnnotations,
      history: [...cleanHistory, nextAnnotations],
      historyIndex: cleanHistory.length,
      selectedId: selectedId === id ? null : selectedId
    });
    
    saveToStorage(nextAnnotations);
  },

  clearAll: () => {
    const { history, historyIndex } = get();
    const cleanHistory = history.slice(0, historyIndex + 1);
    const nextAnnotations: Annotation[] = [];
    
    set({
      annotations: nextAnnotations,
      history: [...cleanHistory, nextAnnotations],
      historyIndex: cleanHistory.length,
      selectedId: null
    });
    
    saveToStorage(nextAnnotations);
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      const nextAnnotations = history[nextIndex];
      set({
        annotations: nextAnnotations,
        historyIndex: nextIndex,
        selectedId: null
      });
      saveToStorage(nextAnnotations);
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextAnnotations = history[nextIndex];
      set({
        annotations: nextAnnotations,
        historyIndex: nextIndex,
        selectedId: null
      });
      saveToStorage(nextAnnotations);
    }
  },

  setSelectedId: (id) => set({ selectedId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setVisible: (visible) => set({ visible })
}));
