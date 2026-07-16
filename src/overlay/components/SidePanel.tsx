import React, { useState, useRef } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  Trash2, 
  ArrowUpRight, 
  Square, 
  Circle, 
  Pencil, 
  MapPin, 
  Type, 
  Focus,
  Archive
} from 'lucide-react';
import { useStore } from '../store';
import { Annotation } from '../types';
import { generateMarkdownPrompt, drawAnnotationsOnCanvas, createZipBundle } from '../utils/export';

export const SidePanel: React.FC = () => {
  const {
    annotations,
    setAnnotations,
    selectedId,
    setSelectedId,
    deleteAnnotation,
    clearAll,
    sidebarOpen,
    setSidebarOpen,
    setIsCapturing
  } = useStore();

  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Focus and scroll to annotation center
  const handleFocusAnnotation = (ann: Annotation) => {
    setSelectedId(ann.id);
    
    // Find absolute center coordinate of the annotation
    let targetX = ann.x;
    let targetY = ann.y;
    
    if (ann.type === 'rect' || ann.type === 'ellipse' || ann.type === 'arrow') {
      targetX = ann.x + (ann.width || 0) / 2;
      targetY = ann.y + (ann.height || 0) / 2;
    }
    
    window.scrollTo({
      left: Math.max(0, targetX - window.innerWidth / 2),
      top: Math.max(0, targetY - window.innerHeight / 2),
      behavior: 'smooth'
    });
  };

  const handleCopyPrompt = () => {
    const prompt = generateMarkdownPrompt(annotations);
    navigator.clipboard.writeText(prompt)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy prompt: ', err);
      });
  };

  const handleDownloadPrompt = () => {
    const prompt = generateMarkdownPrompt(annotations);
    const blob = new Blob([prompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixelbrief_prompt_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(annotations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixelbrief_annotations_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Simple validation check (make sure elements have required fields)
          const isValid = parsed.every(item => item.id && item.type && typeof item.x === 'number' && typeof item.y === 'number');
          if (isValid) {
            setAnnotations(parsed);
            alert(`Imported ${parsed.length} annotations successfully!`);
          } else {
            alert('JSON does not match PixelBrief data structure.');
          }
        } else {
          alert('Invalid file format. JSON must contain an array of annotations.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const handleExportBundle = async () => {
    if (annotations.length === 0) {
      alert('Add some annotations first!');
      return;
    }
    
    setIsExporting(true);
    setIsCapturing(true);
    
    // Store original sidebar state
    const originalSidebar = sidebarOpen;
    setSidebarOpen(false);

    // Give DOM time to hide sidebar overlay
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      // Send capture message to background script
      const response = await new Promise<{ success: boolean; dataUrl?: string; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_SCREENSHOT' }, (res) => {
          resolve(res);
        });
      });

      // Restore UI state
      setIsCapturing(false);
      if (originalSidebar) {
        setSidebarOpen(true);
      }

      if (!response || !response.success || !response.dataUrl) {
        throw new Error(response?.error || 'Failed to capture page screenshot. Make sure you are on a standard web page.');
      }

      // Draw vector annotations on screenshot canvas
      const mergedDataUrl = await drawAnnotationsOnCanvas(
        response.dataUrl,
        annotations,
        window.scrollX,
        window.scrollY
      );

      // Generate ZIP blob
      const zipBlob = await createZipBundle(annotations, mergedDataUrl);

      // Trigger ZIP download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pixelbrief_bundle_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert('Error creating bundle: ' + (err as Error).message);
      setIsCapturing(false);
      if (originalSidebar) {
        setSidebarOpen(true);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getToolIcon = (type: string) => {
    switch (type) {
      case 'rect': return <Square size={16} className="text-blue-400" />;
      case 'ellipse': return <Circle size={16} className="text-indigo-400" />;
      case 'arrow': return <ArrowUpRight size={16} className="text-emerald-400" />;
      case 'pen': return <Pencil size={16} className="text-yellow-400" />;
      case 'pin': return <MapPin size={16} className="text-red-400" />;
      case 'text': return <Type size={16} className="text-purple-400" />;
      default: return null;
    }
  };

  const getToolName = (type: string) => {
    switch (type) {
      case 'rect': return 'Rectangle';
      case 'ellipse': return 'Ellipse';
      case 'arrow': return 'Arrow';
      case 'pen': return 'Freehand';
      case 'pin': return 'Pin';
      case 'text': return 'Text Label';
      default: return 'Annotation';
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-[460px] bg-[var(--bg-glass-strong)] text-[var(--text-primary)] border-l border-[var(--border-subtle)] flex flex-col z-[2147483645] pointer-events-auto backdrop-blur-[24px] saturate-[1.2] ${
        mounted ? 'transition-transform duration-300' : ''
      } ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ boxShadow: 'none' }}
    >
      {/* Header */}
      <div className="h-[52px] px-4 border-b border-[var(--border-subtle)] bg-transparent flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <svg width="16" height="16" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <defs>
              <linearGradient id="pb-side-grad" x1="48" y1="48" x2="48" y2="464" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#60A5FA" />
                <stop offset="100%" stop-color="#2563EB" />
              </linearGradient>
            </defs>
            <path d="M 158,68 L 68,68 L 68,158" stroke="url(#pb-side-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M 354,68 L 444,68 L 444,158" stroke="url(#pb-side-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M 68,354 L 68,444 L 158,444" stroke="url(#pb-side-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M 444,354 L 444,444 L 354,444" stroke="url(#pb-side-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="444" cy="68" r="36" fill="#F97316" />
            <path d="M 192,192 L 352,256 L 288,288 L 352,416 L 416,352 L 288,288 L 256,352 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">PixelBrief List</h2>
          <span className="bg-[var(--bg-control)] text-[var(--text-secondary)] text-[10px] font-semibold px-2 py-0.5 rounded-[4px] font-sans">
            {annotations.length}
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 hover:bg-[var(--bg-control-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md transition-all duration-150"
        >
          <X size={16} />
        </button>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto p-[14px] space-y-[12px] bg-transparent">
        {annotations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 px-6 text-center select-none bg-transparent">
            <div className="w-10 h-10 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center mb-4 bg-white/50">
              <svg width="18" height="18" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="pb-empty-grad" x1="48" y1="48" x2="48" y2="464" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#60A5FA" />
                    <stop offset="100%" stop-color="#2563EB" />
                  </linearGradient>
                </defs>
                <path d="M 158,68 L 68,68 L 68,158" stroke="url(#pb-empty-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 354,68 L 444,68 L 444,158" stroke="url(#pb-empty-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 68,354 L 68,444 L 158,444" stroke="url(#pb-empty-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 444,354 L 444,444 L 354,444" stroke="url(#pb-empty-grad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="444" cy="68" r="36" fill="#F97316" />
                <path d="M 192,192 L 352,256 L 288,288 L 352,416 L 416,352 L 288,288 L 256,352 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">No annotations yet</p>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-[300px] leading-relaxed mt-1.5">
              Select a drawing tool from the floating toolbar to place notes on the page.
            </p>
          </div>
        ) : (
          [...annotations]
            .sort((a, b) => {
              if (a.type === 'pin' && b.type === 'pin') return (a.number || 0) - (b.number || 0);
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            })
            .map((ann) => {
              const isSelected = selectedId === ann.id;
              return (
                <div
                  key={ann.id}
                  onClick={() => setSelectedId(ann.id)}
                  className={`p-3 rounded-[12px] border text-left transition-all duration-150 cursor-pointer ${
                    isSelected 
                      ? 'bg-white border-[var(--accent)] shadow-[0_2px_8px_rgba(0,102,204,0.06)]' 
                      : 'bg-[rgba(255,255,255,0.4)] border-[var(--border-subtle)] hover:bg-[rgba(255,255,255,0.65)] hover:border-[var(--border-medium)]'
                  }`}
                  style={isSelected ? { boxShadow: '0 0 0 1px rgba(0,102,204,0.08)' } : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getToolIcon(ann.type)}
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {getToolName(ann.type)} {ann.type === 'pin' && `#${ann.number}`}
                      </span>
                      {/* Color swatch dot */}
                      <span
                        className="w-[6px] h-[6px] rounded-full border border-[rgba(0,0,0,0.12)]"
                        style={{ backgroundColor: ann.color }}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        title="Focus and Center View"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFocusAnnotation(ann);
                        }}
                        className="p-1 hover:bg-[var(--bg-control-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded transition-colors"
                      >
                        <Focus size={13} />
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(ann.id);
                        }}
                        className="p-1 hover:bg-[var(--bg-control-hover)] text-[var(--text-secondary)] hover:text-[var(--danger)] rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Comment Editor */}
                  {ann.type === 'text' && (
                    <div className="text-xs text-[var(--text-primary)] font-medium px-[10px] py-[9px] bg-white rounded-[6px] border border-[var(--border-subtle)] select-all font-mono break-all leading-relaxed mb-2">
                      {ann.text}
                    </div>
                  )}
                  <textarea
                    value={ann.comment || ''}
                    placeholder="Add prompt notes or instructions..."
                    onClick={(e) => e.stopPropagation()} // Stop selection toggle
                    onKeyDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => useStore.getState().updateAnnotation(ann.id, { comment: e.target.value })}
                    className="w-full bg-white border border-[var(--border-subtle)] rounded-[6px] text-[var(--text-primary)] placeholder-[#6B7280] py-[9px] px-[10px] min-h-[44px] text-[12px] transition-all duration-150 resize-none outline-none hover:border-[var(--border-medium)] focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_rgba(0,102,204,0.08)] leading-relaxed"
                  />
                  
                  <div className="text-[11px] text-[var(--text-tertiary)] mt-[10px] flex justify-between items-center font-sans">
                    <span>
                      X: {Math.round(ann.x)}, Y: {Math.round(ann.y)}
                    </span>
                    <span>
                      {new Date(ann.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-transparent space-y-[10px] flex-shrink-0">
        {/* Copy AI Prompt CTA */}
        <button
          onClick={handleCopyPrompt}
          disabled={annotations.length === 0}
          className={`w-full h-[38px] flex items-center justify-center space-x-2 rounded-[6px] text-xs font-semibold text-white transition-all duration-150 active:scale-[0.98] border-none ${
            annotations.length === 0
              ? 'bg-[var(--bg-control)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
              : copied
                ? 'bg-[#34c759] hover:bg-[#2db04d] cursor-pointer'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] cursor-pointer shadow-sm'
          }`}
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied Prompt!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy AI Prompt</span>
            </>
          )}
        </button>

        {/* Export Bundle Secondary CTA */}
        <button
          onClick={handleExportBundle}
          disabled={annotations.length === 0 || isExporting}
          className={`w-full h-[36px] flex items-center justify-center space-x-2 rounded-[6px] text-xs font-semibold border transition-all duration-150 active:scale-[0.98] ${
            annotations.length === 0 || isExporting
              ? 'bg-[var(--bg-control)] border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
              : 'bg-[rgba(255,255,255,0.6)] border-[var(--border-subtle)] hover:bg-[var(--bg-control-hover)] text-[var(--text-primary)] cursor-pointer shadow-sm'
          }`}
        >
          {isExporting ? (
            <span className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></span>
              <span>Capturing viewport...</span>
            </span>
          ) : (
            <>
              <Archive size={14} />
              <span>Export Bundle (ZIP)</span>
            </>
          )}
        </button>

        {/* Import / Export / Clear Extra Section */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
          <button
            onClick={handleDownloadPrompt}
            disabled={annotations.length === 0}
            className="flex items-center justify-center space-x-1.5 h-[32px] bg-[rgba(255,255,255,0.6)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] rounded-[5px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={11} />
            <span>prompt.md</span>
          </button>
          
          <button
            onClick={handleExportJson}
            disabled={annotations.length === 0}
            className="flex items-center justify-center space-x-1.5 h-[32px] bg-[rgba(255,255,255,0.6)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] rounded-[5px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={11} />
            <span>annotations.json</span>
          </button>

          <button
            onClick={handleImportJsonClick}
            className="flex items-center justify-center space-x-1.5 h-[32px] bg-[rgba(255,255,255,0.6)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] rounded-[5px] transition-colors col-span-2"
          >
            <Upload size={11} />
            <span>Import JSON</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJson}
            accept=".json"
            className="hidden"
          />
        </div>

        {annotations.length > 0 && (
          <button
            onClick={clearAll}
            className="w-full text-center text-[10px] uppercase font-bold tracking-wider text-[var(--danger)] hover:text-red-600 py-2 transition-all duration-150"
          >
            Clear page annotations
          </button>
        )}
      </div>
    </div>
  );
};
