import React, { useState, useEffect, useRef } from 'react';
import { 
  MousePointer, 
  Square, 
  Circle, 
  ArrowUpRight, 
  Pencil, 
  MapPin, 
  Type, 
  Undo2, 
  Redo2, 
  Trash2, 
  Eraser, 
  Eye, 
  EyeOff, 
  PanelRight, 
  X, 
  GripVertical,
  ChevronDown,
  MoreHorizontal,
  Copy,
  Archive,
  Download,
  Upload,
  RotateCcw
} from 'lucide-react';
import { useStore } from '../store';
import { ColorPicker } from './ColorPicker';
import { ToolType } from '../types';
import { generateMarkdownPrompt, drawAnnotationsOnCanvas, createZipBundle } from '../utils/export';

export const FloatingToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    visible,
    setVisible,
    selectedId,
    setSelectedId,
    deleteAnnotation,
    clearAll,
    undo,
    redo,
    sidebarOpen,
    setSidebarOpen,
    toggleOverlay,
    annotations,
    setAnnotations,
    setIsCapturing
  } = useStore();

  // Viewport width state for responsiveness
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = windowWidth < 520;

  // Position state for dragging
  const getInitialPosition = () => {
    const width = window.innerWidth;
    const toolbarWidth = window.innerWidth < 520 ? 340 : 480;
    return { x: Math.max(12, width / 2 - toolbarWidth / 2), y: 20 };
  };

  const [position, setPosition] = useState(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Popovers toggle states
  const [shapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const [stylePopoverOpen, setStylePopoverOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [compactDropdownOpen, setCompactDropdownOpen] = useState(false);

  // Track the last active shape tool ('rect' or 'ellipse')
  const [lastShapeTool, setLastShapeTool] = useState<Extract<ToolType, 'rect' | 'ellipse'>>('rect');
  
  // Track the last active drawing tool for compact mode (excluding select)
  const [lastDrawingTool, setLastDrawingTool] = useState<Extract<ToolType, 'rect' | 'ellipse' | 'arrow' | 'pen' | 'pin' | 'text'>>('rect');

  // Secondary CTA States
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync lastDrawingTool and lastShapeTool with activeTool if activeTool is not select
  useEffect(() => {
    if (activeTool !== 'select') {
      setLastDrawingTool(activeTool);
      if (activeTool === 'rect' || activeTool === 'ellipse') {
        setLastShapeTool(activeTool);
      }
    }
  }, [activeTool]);

  // Handle position adjustments when resizing or switching mode
  useEffect(() => {
    setPosition((prev) => {
      const toolbarWidth = isCompact ? 340 : 480;
      const maxLimitX = window.innerWidth - toolbarWidth - 12;
      const maxLimitY = window.innerHeight - 80;
      
      const newX = Math.max(12, Math.min(maxLimitX, prev.x));
      const newY = Math.max(12, Math.min(maxLimitY, prev.y));
      
      return { x: newX, y: newY };
    });
  }, [windowWidth, isCompact]);

  // Click away listener to close popovers/dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.composedPath()[0] as Node)) {
        setShapeDropdownOpen(false);
        setStylePopoverOpen(false);
        setMoreMenuOpen(false);
        setCompactDropdownOpen(false);
      }
    };
    
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input (considering Shadow DOM composed path)
      const target = e.composedPath()[0] as HTMLElement;
      const isTyping = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.hasAttribute('contenteditable') ||
        target.isContentEditable
      );
      
      if (isTyping) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Escape key: close open popovers first, then deselect, then close overlay
      if (e.key === 'Escape') {
        if (shapeDropdownOpen || stylePopoverOpen || moreMenuOpen || compactDropdownOpen) {
          setShapeDropdownOpen(false);
          setStylePopoverOpen(false);
          setMoreMenuOpen(false);
          setCompactDropdownOpen(false);
          e.preventDefault();
          e.stopPropagation();
        } else if (selectedId) {
          setSelectedId(null);
          e.preventDefault();
          e.stopPropagation();
        } else if (activeTool !== 'select') {
          setActiveTool('select');
          e.preventDefault();
          e.stopPropagation();
        } else {
          toggleOverlay();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // Backspace / Delete: delete selected annotation
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        deleteAnnotation(selectedId);
        e.preventDefault();
        return;
      }

      // Undo / Redo
      if (cmdCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
        return;
      }

      // Standard tool hotkeys
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'r':
          setActiveTool('rect');
          break;
        case 'o':
          setActiveTool('ellipse');
          break;
        case 'a':
          setActiveTool('arrow');
          break;
        case 'p':
          setActiveTool('pen');
          break;
        case 'n':
          setActiveTool('pin');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'h':
          setVisible(!visible);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedId, 
    visible, 
    deleteAnnotation, 
    undo, 
    redo, 
    setActiveTool, 
    setVisible, 
    toggleOverlay,
    activeTool,
    setSelectedId,
    shapeDropdownOpen, 
    stylePopoverOpen, 
    moreMenuOpen, 
    compactDropdownOpen
  ]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragStartOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const toolbarWidth = isCompact ? 340 : 480;
      const newX = Math.max(10, Math.min(window.innerWidth - toolbarWidth - 10, e.clientX - dragStartOffset.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragStartOffset.current.y));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isCompact]);

  // Actions implementations copied/adapted from SidePanel
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
    setMoreMenuOpen(false);
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
    setMoreMenuOpen(false);
    
    // Store original sidebar state
    const originalSidebar = sidebarOpen;
    setSidebarOpen(false);

    // Give DOM time to hide sidebar overlay
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      const response = await new Promise<{ success: boolean; dataUrl?: string; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_SCREENSHOT' }, (res) => {
          resolve(res);
        });
      });

      setIsCapturing(false);
      if (originalSidebar) {
        setSidebarOpen(true);
      }

      if (!response || !response.success || !response.dataUrl) {
        throw new Error(response?.error || 'Failed to capture page screenshot. Make sure you are on a standard web page.');
      }

      const mergedDataUrl = await drawAnnotationsOnCanvas(
        response.dataUrl,
        annotations,
        window.scrollX,
        window.scrollY
      );

      const zipBlob = await createZipBundle(annotations, mergedDataUrl);

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

  const selectShapeTool = (tool: 'rect' | 'ellipse') => {
    setActiveTool(tool);
    setLastShapeTool(tool);
    setLastDrawingTool(tool);
    setShapeDropdownOpen(false);
  };

  const getToolInfo = (tool: ToolType) => {
    switch (tool) {
      case 'rect': return { icon: Square, label: 'Rectangle (R)' };
      case 'ellipse': return { icon: Circle, label: 'Ellipse (O)' };
      case 'arrow': return { icon: ArrowUpRight, label: 'Arrow (A)' };
      case 'pen': return { icon: Pencil, label: 'Freehand Pen (P)' };
      case 'pin': return { icon: MapPin, label: 'Comment Pin (N)' };
      case 'text': return { icon: Type, label: 'Text Label (T)' };
      default: return { icon: Square, label: 'Rectangle (R)' };
    }
  };

  // SVG shape icon for dropdown button in normal mode
  const ShapeIcon = lastShapeTool === 'rect' ? Square : Circle;
  const isShapeActive = activeTool === 'rect' || activeTool === 'ellipse';

  return (
    <div
      ref={toolbarRef}
      style={{ top: `${position.y}px`, left: `${position.x}px`, maxWidth: 'calc(100vw - 24px)' }}
      onMouseDown={handleMouseDown}
      className="fixed flex items-center bg-[var(--bg-glass)] text-[var(--text-primary)] rounded-[12px] shadow-lg border border-[var(--border-subtle)] p-1.5 z-[2147483647] select-none pointer-events-auto transition-all duration-200 hover:shadow-xl backdrop-blur-[20px] saturate-[1.2] flex-nowrap overflow-visible"
    >
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJson}
        accept=".json"
        className="hidden"
      />

      {/* Drag Handle */}
      <div className="drag-handle cursor-grab active:cursor-grabbing px-1.5 text-zinc-400 hover:text-zinc-600 flex-shrink-0">
        <GripVertical size={16} />
      </div>

      {/* Tools Group */}
      <div className="flex items-center space-x-0.5 border-r border-[var(--border-subtle)] pr-1.5 mr-1.5 flex-shrink-0">
        {/* Select Tool */}
        <button
          title="Select/Move (V)"
          onClick={() => setActiveTool('select')}
          className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
            activeTool === 'select' 
              ? 'bg-[var(--accent)] text-white shadow-sm' 
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MousePointer size={16} />
        </button>

        {isCompact ? (
          /* Compact Tools Dropdown */
          <div className="relative">
            <button
              title={`Drawing Tools (${getToolInfo(lastDrawingTool).label})`}
              onClick={() => setCompactDropdownOpen(!compactDropdownOpen)}
              className={`w-[46px] h-[36px] flex items-center justify-center space-x-1 rounded-[8px] transition-all duration-150 ${
                activeTool !== 'select'
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {React.createElement(getToolInfo(activeTool !== 'select' ? activeTool : lastDrawingTool).icon, { size: 16 })}
              <ChevronDown size={10} className="opacity-60" />
            </button>
            
            {compactDropdownOpen && (
              <div className="absolute top-[100%] mt-2 left-0 bg-[var(--bg-glass-strong)] border border-[var(--border-medium)] rounded-[12px] p-[5px] z-[2147483647] shadow-[var(--shadow-popover)] min-w-[190px] flex flex-col space-y-0.5 animate-in fade-in duration-100 backdrop-blur-[12px]">
                {(['rect', 'ellipse', 'arrow', 'pen', 'pin', 'text'] as ToolType[]).map((tool) => {
                  const info = getToolInfo(tool);
                  const isSelected = activeTool === tool;
                  
                  // Get shortcut letter
                  let shortcut = '';
                  if (tool === 'rect') shortcut = 'R';
                  else if (tool === 'ellipse') shortcut = 'O';
                  else if (tool === 'arrow') shortcut = 'A';
                  else if (tool === 'pen') shortcut = 'P';
                  else if (tool === 'pin') shortcut = 'N';
                  else if (tool === 'text') shortcut = 'T';

                  return (
                    <button
                      key={tool}
                      onClick={() => {
                        setActiveTool(tool);
                        setLastDrawingTool(tool as Extract<ToolType, 'rect' | 'ellipse' | 'arrow' | 'pen' | 'pin' | 'text'>);
                        if (tool === 'rect' || tool === 'ellipse') {
                          setLastShapeTool(tool);
                        }
                        setCompactDropdownOpen(false);
                      }}
                      className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left transition-colors duration-150 ${
                        isSelected
                          ? 'bg-[var(--bg-control-pressed)] text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {React.createElement(info.icon, { 
                        size: 16, 
                        className: isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]' 
                      })}
                      <span>{info.label.split(' (')[0]}</span>
                      {shortcut && (
                        <span className="text-[var(--text-tertiary)] text-[12px] ml-auto font-normal">{shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Normal Tools Layout */
          <>
            {/* Shape Dropdown Trigger */}
            <div className="relative">
              <button
                title="Shapes (R / O)"
                onClick={() => setShapeDropdownOpen(!shapeDropdownOpen)}
                className={`w-[46px] h-[36px] flex items-center justify-center space-x-1 rounded-[8px] transition-all duration-150 ${
                  isShapeActive 
                    ? 'bg-[var(--accent)] text-white shadow-sm' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {React.createElement(ShapeIcon, { size: 16 })}
                <ChevronDown size={10} className="opacity-60" />
              </button>
              
              {shapeDropdownOpen && (
                <div className="absolute top-[100%] mt-2 left-0 bg-[var(--bg-glass-strong)] border border-[var(--border-medium)] rounded-[12px] p-[5px] z-[2147483647] shadow-[var(--shadow-popover)] min-w-[190px] flex flex-col space-y-0.5 animate-in fade-in duration-100 backdrop-blur-[12px]">
                  <button
                    onClick={() => selectShapeTool('rect')}
                    className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left transition-colors duration-150 ${
                      activeTool === 'rect'
                        ? 'bg-[var(--bg-control-pressed)] text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Square size={16} className={activeTool === 'rect' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} />
                    <span>Rectangle</span>
                    <span className="text-[var(--text-tertiary)] text-[12px] ml-auto font-normal">R</span>
                  </button>
                  <button
                    onClick={() => selectShapeTool('ellipse')}
                    className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left transition-colors duration-150 ${
                      activeTool === 'ellipse'
                        ? 'bg-[var(--bg-control-pressed)] text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Circle size={16} className={activeTool === 'ellipse' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} />
                    <span>Ellipse</span>
                    <span className="text-[var(--text-tertiary)] text-[12px] ml-auto font-normal">O</span>
                  </button>
                </div>
              )}
            </div>

            {/* Arrow */}
            <button
              title="Arrow (A)"
              onClick={() => setActiveTool('arrow')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'arrow' 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowUpRight size={16} />
            </button>

            {/* Pen */}
            <button
              title="Freehand Pen (P)"
              onClick={() => setActiveTool('pen')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'pen' 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Pencil size={16} />
            </button>

            {/* Pin */}
            <button
              title="Comment Pin (N)"
              onClick={() => setActiveTool('pin')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'pin' 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <MapPin size={16} />
            </button>

            {/* Text */}
            <button
              title="Text Label (T)"
              onClick={() => setActiveTool('text')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'text' 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Type size={16} />
            </button>
          </>
        )}
      </div>

      {/* Style Popover Button */}
      <div className="relative border-r border-[var(--border-subtle)] pr-1.5 mr-1.5 flex-shrink-0">
        <button
          title="Annotation Styles"
          onClick={() => setStylePopoverOpen(!stylePopoverOpen)}
          className={`h-[36px] px-2 flex items-center justify-center space-x-1.5 rounded-[8px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.4)] hover:bg-[var(--bg-control-hover)] text-[var(--text-secondary)] transition-all duration-150 ${
            stylePopoverOpen ? 'border-[var(--border-medium)] bg-[var(--bg-glass-strong)] text-[var(--text-primary)]' : ''
          }`}
        >
          <span
            className="w-4 h-4 rounded-full border border-[rgba(0,0,0,0.12)] flex-shrink-0"
            style={{ backgroundColor: strokeColor }}
          />
          {!isCompact && (
            <span className="text-[10px] text-[var(--text-secondary)] font-mono font-bold">{strokeWidth}px</span>
          )}
          <ChevronDown size={10} className="opacity-60" />
        </button>

        {stylePopoverOpen && (
          <div className="absolute top-[100%] mt-2 left-[50%] -translate-x-[50%] bg-[var(--bg-glass-strong)] border border-[var(--border-medium)] rounded-[12px] p-3 space-y-3.5 z-[2147483647] shadow-[var(--shadow-popover)] w-[280px] max-w-[calc(100vw-24px)] overflow-hidden flex flex-col animate-in fade-in duration-100 backdrop-blur-[12px]">
            <div>
              <span className="text-[13px] font-semibold text-[var(--text-primary)] block mb-2 text-left">Color</span>
              <ColorPicker selectedColor={strokeColor} onChangeColor={setStrokeColor} />
            </div>
            
            <div className="border-t border-[var(--border-subtle)] pt-3">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] block mb-2 text-left">Stroke Width</span>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-secondary)] font-mono w-4 font-bold">{strokeWidth}</span>
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-3 flex justify-end">
              <button
                onClick={() => {
                  setStrokeColor('#ef4444');
                  setStrokeWidth(4);
                }}
                className="flex items-center space-x-1 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-control)] border border-[var(--border-subtle)] rounded-[7px] transition-colors duration-150 cursor-pointer"
              >
                <RotateCcw size={12} className="text-[var(--text-secondary)]" />
                <span>Reset Style</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions & More Group */}
      <div className="flex items-center space-x-0.5 flex-shrink-0">
        {/* Undo */}
        <button
          title="Undo (Ctrl+Z)"
          onClick={undo}
          className="w-[36px] h-[36px] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] rounded-[8px] transition-colors duration-150"
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button
          title="Redo (Ctrl+Shift+Z)"
          onClick={redo}
          className="w-[36px] h-[36px] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] rounded-[8px] transition-colors duration-150"
        >
          <Redo2 size={16} />
        </button>

        {/* Delete Selected (only if selectedId exists) */}
        {selectedId && (
          <button
            title="Delete Selected (Backspace)"
            onClick={() => deleteAnnotation(selectedId)}
            className="w-[36px] h-[36px] flex items-center justify-center text-[var(--danger)] hover:bg-red-500/10 rounded-[8px] transition-colors duration-150"
          >
            <Trash2 size={16} />
          </button>
        )}

        {/* More Menu Dropdown */}
        <div className="relative">
          <button
            title="More Actions"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
              moreMenuOpen
                ? 'bg-[var(--bg-control-pressed)] text-[var(--text-primary)] border border-[var(--border-medium)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MoreHorizontal size={16} />
          </button>

          {moreMenuOpen && (
            <div className="absolute top-[100%] mt-2 right-0 bg-[var(--bg-glass-strong)] border border-[var(--border-medium)] rounded-[12px] p-[5px] z-[2147483647] shadow-[var(--shadow-popover)] min-w-[240px] flex flex-col animate-in fade-in duration-100 backdrop-blur-[12px]">
              {/* Hide / Show Annotations */}
              <button
                onClick={() => {
                  setVisible(!visible);
                  setMoreMenuOpen(false);
                }}
                className="h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] transition-colors duration-150"
              >
                {visible ? (
                  <EyeOff size={16} className="text-[var(--text-secondary)]" />
                ) : (
                  <Eye size={16} className="text-[var(--text-secondary)]" />
                )}
                <span>{visible ? 'Hide Annotations' : 'Show Annotations'}</span>
                <span className="text-[var(--text-tertiary)] text-[12px] ml-auto font-normal">H</span>
              </button>
              
              {/* Clear All */}
              <button
                onClick={() => {
                  clearAll();
                  setMoreMenuOpen(false);
                }}
                className="h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left text-[var(--danger)] hover:bg-red-500/10 transition-colors duration-150"
              >
                <Eraser size={16} className="text-[var(--danger)]" />
                <span>Clear All</span>
              </button>

              <div className="h-[1px] bg-[var(--border-subtle)] my-1.5 mx-1" />

              {/* Copy AI Prompt */}
              <button
                onClick={handleCopyPrompt}
                disabled={annotations.length === 0}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[var(--accent)] ${
                  annotations.length === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                <Copy size={16} className="text-[var(--accent)]" />
                <span>{copied ? 'Copied Prompt!' : 'Copy AI Prompt'}</span>
              </button>

              {/* Export Bundle */}
              <button
                onClick={handleExportBundle}
                disabled={annotations.length === 0 || isExporting}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[var(--accent)] ${
                  (annotations.length === 0 || isExporting)
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                {isExporting ? (
                  <span className="w-[16px] h-[16px] border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0"></span>
                ) : (
                  <Archive size={16} className="text-[var(--accent)]" />
                )}
                <span>{isExporting ? 'Exporting...' : 'Export Bundle (ZIP)'}</span>
              </button>

              <div className="h-[1px] bg-[var(--border-subtle)] my-1.5 mx-1" />

              {/* Download prompt.md */}
              <button
                onClick={handleDownloadPrompt}
                disabled={annotations.length === 0}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[var(--accent)] ${
                  annotations.length === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                <Download size={16} className="text-[var(--accent)]" />
                <span>Download prompt.md</span>
              </button>

              {/* Export annotations.json */}
              <button
                onClick={handleExportJson}
                disabled={annotations.length === 0}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[var(--accent)] ${
                  annotations.length === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                <Download size={16} className="text-[var(--accent)]" />
                <span>Export annotations.json</span>
              </button>

              {/* Import JSON */}
              <button
                onClick={handleImportJsonClick}
                className="h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left text-[var(--accent)] hover:bg-[rgba(0,102,204,0.06)] cursor-pointer transition-colors duration-150"
              >
                <Upload size={16} className="text-[var(--accent)]" />
                <span>Import JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-[20px] w-[1px] bg-[var(--border-subtle)] mx-1 flex-shrink-0" />

        {/* Sidebar Toggle */}
        <button
          title="Toggle Sidebar List"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 relative flex-shrink-0 ${
            sidebarOpen 
              ? 'text-[var(--accent)] bg-[rgba(0,102,204,0.08)] hover:bg-[rgba(0,102,204,0.14)]' 
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <PanelRight size={16} />
          {annotations.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          )}
        </button>

        {/* Close Overlay */}
        <button
          title="Close Overlay"
          onClick={toggleOverlay}
          className="w-[36px] h-[36px] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-control-hover)] hover:text-[var(--text-primary)] rounded-[8px] transition-colors duration-150 ml-0.5 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
