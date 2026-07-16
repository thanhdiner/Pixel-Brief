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
  RotateCcw,
  ChevronsLeft,
  ChevronsRight
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
  const [isCollapsed, setIsCollapsed] = useState(false);
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
      switch (e.key) {
        case '1':
          setActiveTool('select');
          break;
        case '2':
          setActiveTool('rect');
          break;
        case '3':
          setActiveTool('ellipse');
          break;
        case '4':
          setActiveTool('arrow');
          break;
        case '5':
          setActiveTool('pen');
          break;
        case '6':
          setActiveTool('pin');
          break;
        case '7':
          setActiveTool('text');
          break;
        case 'h':
        case 'H':
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
    if (isCollapsed || (e.target as HTMLElement).closest('.drag-handle')) {
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
      
      const toolbarWidth = isCollapsed ? 42 : (isCompact ? 340 : 480);
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
  }, [isDragging, isCompact, isCollapsed]);

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
      case 'select': return { icon: MousePointer, label: 'Select/Move (1)' };
      case 'rect': return { icon: Square, label: 'Rectangle (2)' };
      case 'ellipse': return { icon: Circle, label: 'Ellipse (3)' };
      case 'arrow': return { icon: ArrowUpRight, label: 'Arrow (4)' };
      case 'pen': return { icon: Pencil, label: 'Freehand Pen (5)' };
      case 'pin': return { icon: MapPin, label: 'Comment Pin (6)' };
      case 'text': return { icon: Type, label: 'Text Label (7)' };
      default: return { icon: Square, label: 'Rectangle (2)' };
    }
  };

  // SVG shape icon for dropdown button in normal mode
  const ShapeIcon = lastShapeTool === 'rect' ? Square : Circle;
  const isShapeActive = activeTool === 'rect' || activeTool === 'ellipse';

  if (isCollapsed) {
    return (
      <div
        ref={toolbarRef}
        style={{ top: `${position.y}px`, left: `${position.x}px` }}
        onMouseDown={handleMouseDown}
        className="fixed flex items-center justify-center bg-[rgba(255,255,255,0.72)] text-[#1d1d1f] w-[42px] h-[42px] rounded-full shadow-lg border border-[rgba(0,0,0,0.08)] z-[2147483647] select-none pointer-events-auto cursor-grab active:cursor-grabbing hover:bg-[rgba(255,255,255,0.85)] hover:scale-105 active:scale-95 transition-all duration-150 backdrop-blur-[20px] saturate-[1.2]"
        title="Drag to move. Click to expand toolbar."
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(false);
          }}
          className="w-full h-full flex items-center justify-center text-[#515154] hover:text-[#1d1d1f] rounded-full"
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={toolbarRef}
      style={{ top: `${position.y}px`, left: `${position.x}px`, maxWidth: 'calc(100vw - 24px)' }}
      onMouseDown={handleMouseDown}
      className="fixed flex items-center bg-[rgba(255,255,255,0.72)] text-[#1d1d1f] rounded-[12px] shadow-lg border border-[rgba(0,0,0,0.08)] p-1.5 z-[2147483647] select-none pointer-events-auto transition-all duration-200 hover:shadow-xl backdrop-blur-[20px] saturate-[1.2] flex-nowrap overflow-visible"
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

      {/* Collapse Button */}
      <button
        title="Collapse Toolbar"
        onClick={() => setIsCollapsed(true)}
        className="w-[28px] h-[28px] flex items-center justify-center text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f] rounded-[6px] transition-colors duration-150 mr-1 flex-shrink-0"
      >
        <ChevronsLeft size={16} />
      </button>

      {/* Tools Group */}
      <div className="flex items-center space-x-0.5 border-r border-[rgba(0,0,0,0.08)] pr-1.5 mr-1.5 flex-shrink-0">
        {/* Select Tool */}
        <button
          title="Select/Move (1)"
          onClick={() => setActiveTool('select')}
          className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
            activeTool === 'select' 
              ? 'bg-[#0066cc] text-white shadow-sm' 
              : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
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
                  ? 'bg-[#0066cc] text-white shadow-sm' 
                  : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
              }`}
            >
              {React.createElement(getToolInfo(activeTool !== 'select' ? activeTool : lastDrawingTool).icon, { size: 16 })}
              <ChevronDown size={10} className="opacity-60" />
            </button>
            
            {compactDropdownOpen && (
              <div className="absolute top-[100%] mt-2 left-0 bg-[rgba(255,255,255,0.88)] border border-[rgba(0,0,0,0.12)] rounded-[12px] p-[5px] z-[2147483647] shadow-[0_4px_14px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.04)] min-w-[190px] flex flex-col space-y-0.5 animate-in fade-in duration-100 backdrop-blur-[12px]">
                {(['rect', 'ellipse', 'arrow', 'pen', 'pin', 'text'] as ToolType[]).map((tool) => {
                  const info = getToolInfo(tool);
                  const isSelected = activeTool === tool;
                  
                  // Get shortcut number
                  let shortcut = '';
                  if (tool === 'select') shortcut = '1';
                  else if (tool === 'rect') shortcut = '2';
                  else if (tool === 'ellipse') shortcut = '3';
                  else if (tool === 'arrow') shortcut = '4';
                  else if (tool === 'pen') shortcut = '5';
                  else if (tool === 'pin') shortcut = '6';
                  else if (tool === 'text') shortcut = '7';

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
                          ? 'bg-[rgba(0,0,0,0.08)] text-[#1d1d1f] font-semibold'
                          : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {React.createElement(info.icon, { 
                        size: 16, 
                        className: isSelected ? 'text-[#1d1d1f]' : 'text-[#515154]' 
                      })}
                      <span>{info.label.split(' (')[0]}</span>
                      {shortcut && (
                        <span className="text-[#86868b] text-[12px] ml-auto font-normal">{shortcut}</span>
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
                title="Shapes (2 / 3)"
                onClick={() => setShapeDropdownOpen(!shapeDropdownOpen)}
                className={`w-[46px] h-[36px] flex items-center justify-center space-x-1 rounded-[8px] transition-all duration-150 ${
                  isShapeActive 
                    ? 'bg-[#0066cc] text-white shadow-sm' 
                    : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
                }`}
              >
                {React.createElement(ShapeIcon, { size: 16 })}
                <ChevronDown size={10} className="opacity-60" />
              </button>
              
              {shapeDropdownOpen && (
                <div className="absolute top-[100%] mt-2 left-0 bg-[rgba(255,255,255,0.88)] border border-[rgba(0,0,0,0.12)] rounded-[12px] p-[5px] z-[2147483647] shadow-[0_4px_14px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.04)] min-w-[190px] flex flex-col space-y-0.5 animate-in fade-in duration-100 backdrop-blur-[12px]">
                  <button
                    onClick={() => selectShapeTool('rect')}
                    className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left transition-colors duration-150 ${
                      activeTool === 'rect'
                        ? 'bg-[rgba(0,0,0,0.08)] text-[#1d1d1f] font-semibold'
                        : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Square size={16} className={activeTool === 'rect' ? 'text-[#1d1d1f]' : 'text-[#515154]'} />
                    <span>Rectangle</span>
                    <span className="text-[#86868b] text-[12px] ml-auto font-normal">2</span>
                  </button>
                  <button
                    onClick={() => selectShapeTool('ellipse')}
                    className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left transition-colors duration-150 ${
                      activeTool === 'ellipse'
                        ? 'bg-[rgba(0,0,0,0.08)] text-[#1d1d1f] font-semibold'
                        : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Circle size={16} className={activeTool === 'ellipse' ? 'text-[#1d1d1f]' : 'text-[#515154]'} />
                    <span>Ellipse</span>
                    <span className="text-[#86868b] text-[12px] ml-auto font-normal">3</span>
                  </button>
                </div>
              )}
            </div>

            {/* Arrow */}
            <button
              title="Arrow (4)"
              onClick={() => setActiveTool('arrow')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'arrow' 
                  ? 'bg-[#0066cc] text-white shadow-sm' 
                  : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
              }`}
            >
              <ArrowUpRight size={16} />
            </button>

            {/* Pen */}
            <button
              title="Freehand Pen (5)"
              onClick={() => setActiveTool('pen')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'pen' 
                  ? 'bg-[#0066cc] text-white shadow-sm' 
                  : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
              }`}
            >
              <Pencil size={16} />
            </button>

            {/* Pin */}
            <button
              title="Comment Pin (6)"
              onClick={() => setActiveTool('pin')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'pin' 
                  ? 'bg-[#0066cc] text-white shadow-sm' 
                  : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
              }`}
            >
              <MapPin size={16} />
            </button>

            {/* Text */}
            <button
              title="Text Label (7)"
              onClick={() => setActiveTool('text')}
              className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 ${
                activeTool === 'text' 
                  ? 'bg-[#0066cc] text-white shadow-sm' 
                  : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
              }`}
            >
              <Type size={16} />
            </button>
          </>
        )}
      </div>

      {/* Style Popover Button */}
      <div className="relative border-r border-[rgba(0,0,0,0.08)] pr-1.5 mr-1.5 flex-shrink-0">
        <button
          title="Annotation Styles"
          onClick={() => setStylePopoverOpen(!stylePopoverOpen)}
          className={`h-[36px] px-2 flex items-center justify-center space-x-1.5 rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.4)] hover:bg-[rgba(0,0,0,0.05)] text-[#515154] transition-all duration-150 ${
            stylePopoverOpen ? 'border-[rgba(0,0,0,0.12)] bg-[rgba(255,255,255,0.88)] text-[#1d1d1f]' : ''
          }`}
        >
          <span
            className="w-4 h-4 rounded-full border border-[rgba(0,0,0,0.12)] flex-shrink-0"
            style={{ backgroundColor: strokeColor }}
          />
          {!isCompact && (
            <span className="text-[10px] text-[#515154] font-mono font-bold">{strokeWidth}px</span>
          )}
          <ChevronDown size={10} className="opacity-60" />
        </button>

        {stylePopoverOpen && (
          <div className="absolute top-[100%] mt-2 left-[50%] -translate-x-[50%] bg-[rgba(255,255,255,0.88)] border border-[rgba(0,0,0,0.12)] rounded-[12px] p-3 space-y-3.5 z-[2147483647] shadow-[0_4px_14px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.04)] w-[280px] max-w-[calc(100vw-24px)] overflow-hidden flex flex-col animate-in fade-in duration-100 backdrop-blur-[12px]">
            <div>
              <span className="text-[13px] font-semibold text-[#1d1d1f] block mb-2 text-left">Color</span>
              <ColorPicker selectedColor={strokeColor} onChangeColor={setStrokeColor} />
            </div>
            
            <div className="border-t border-[rgba(0,0,0,0.08)] pt-3">
              <span className="text-[13px] font-semibold text-[#1d1d1f] block mb-2 text-left">Stroke Width</span>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
                />
                <span className="text-xs text-[#515154] font-mono w-4 font-bold">{strokeWidth}</span>
              </div>
            </div>

            <div className="border-t border-[rgba(0,0,0,0.08)] pt-3 flex justify-end">
              <button
                onClick={() => {
                  setStrokeColor('#ef4444');
                  setStrokeWidth(4);
                }}
                className="flex items-center space-x-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#515154] hover:text-[#1d1d1f] bg-[rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.08)] rounded-[7px] transition-colors duration-150 cursor-pointer"
              >
                <RotateCcw size={12} className="text-[#515154]" />
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
          className="w-[36px] h-[36px] flex items-center justify-center text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f] rounded-[8px] transition-colors duration-150"
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button
          title="Redo (Ctrl+Shift+Z)"
          onClick={redo}
          className="w-[36px] h-[36px] flex items-center justify-center text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f] rounded-[8px] transition-colors duration-150"
        >
          <Redo2 size={16} />
        </button>

        {/* Delete Selected (only if selectedId exists) */}
        {selectedId && (
          <button
            title="Delete Selected (Backspace)"
            onClick={() => deleteAnnotation(selectedId)}
            className="w-[36px] h-[36px] flex items-center justify-center text-[#ff3b30] hover:bg-red-500/10 rounded-[8px] transition-colors duration-150"
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
                ? 'bg-[rgba(0,0,0,0.08)] text-[#1d1d1f] border border-[rgba(0,0,0,0.12)]'
                : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
            }`}
          >
            <MoreHorizontal size={16} />
          </button>

          {moreMenuOpen && (
            <div className="absolute top-[100%] mt-2 right-0 bg-[rgba(255,255,255,0.88)] border border-[rgba(0,0,0,0.12)] rounded-[12px] p-[5px] z-[2147483647] shadow-[0_4px_14px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.04)] min-w-[240px] flex flex-col animate-in fade-in duration-100 backdrop-blur-[12px]">
              {/* Hide / Show Annotations */}
              <button
                onClick={() => {
                  setVisible(!visible);
                  setMoreMenuOpen(false);
                }}
                className="h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f] transition-colors duration-150"
              >
                {visible ? (
                  <EyeOff size={16} className="text-[#515154]" />
                ) : (
                  <Eye size={16} className="text-[#515154]" />
                )}
                <span>{visible ? 'Hide Annotations' : 'Show Annotations'}</span>
                <span className="text-[#86868b] text-[12px] ml-auto font-normal">H</span>
              </button>
              
              {/* Clear All */}
              <button
                onClick={() => {
                  clearAll();
                  setMoreMenuOpen(false);
                }}
                className="h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none cursor-pointer w-full text-left text-[#ff3b30] hover:bg-red-500/10 transition-colors duration-150"
              >
                <Eraser size={16} className="text-[#ff3b30]" />
                <span>Clear All</span>
              </button>

              <div className="h-[1px] bg-[rgba(0,0,0,0.08)] my-1.5 mx-1" />

              {/* Copy AI Prompt */}
              <button
                onClick={handleCopyPrompt}
                disabled={annotations.length === 0}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[#0066cc] ${
                  annotations.length === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                <Copy size={16} className="text-[#0066cc]" />
                <span>{copied ? 'Copied Prompt!' : 'Copy AI Prompt'}</span>
              </button>

              {/* Export Bundle */}
              <button
                onClick={handleExportBundle}
                disabled={annotations.length === 0 || isExporting}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[#0066cc] ${
                  (annotations.length === 0 || isExporting)
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                {isExporting ? (
                  <span className="w-[16px] h-[16px] border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin flex-shrink-0"></span>
                ) : (
                  <Archive size={16} className="text-[#0066cc]" />
                )}
                <span>{isExporting ? 'Exporting...' : 'Export Bundle (ZIP)'}</span>
              </button>

              <div className="h-[1px] bg-[rgba(0,0,0,0.08)] my-1.5 mx-1" />

              {/* Download prompt.md */}
              <button
                onClick={handleDownloadPrompt}
                disabled={annotations.length === 0}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[#0066cc] ${
                  annotations.length === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                <Download size={16} className="text-[#0066cc]" />
                <span>Download prompt.md</span>
              </button>

              {/* Export annotations.json */}
              <button
                onClick={handleExportJson}
                disabled={annotations.length === 0}
                className={`h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left transition-colors duration-150 text-[#0066cc] ${
                  annotations.length === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-[rgba(0,102,204,0.06)] cursor-pointer'
                }`}
              >
                <Download size={16} className="text-[#0066cc]" />
                <span>Export annotations.json</span>
              </button>

              {/* Import JSON */}
              <button
                onClick={handleImportJsonClick}
                className="h-[36px] px-[10px] rounded-[7px] flex items-center gap-[10px] text-[13px] font-medium leading-none w-full text-left text-[#0066cc] hover:bg-[rgba(0,102,204,0.06)] cursor-pointer transition-colors duration-150"
              >
                <Upload size={16} className="text-[#0066cc]" />
                <span>Import JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-[20px] w-[1px] bg-[rgba(0,0,0,0.08)] mx-1 flex-shrink-0" />

        {/* Sidebar Toggle */}
        <button
          title="Toggle Sidebar List"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-all duration-150 relative flex-shrink-0 ${
            sidebarOpen 
              ? 'text-[#0066cc] bg-[rgba(0,102,204,0.08)] hover:bg-[rgba(0,102,204,0.14)]' 
              : 'text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f]'
          }`}
        >
          <PanelRight size={16} />
          {annotations.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-[#0066cc]" />
          )}
        </button>

        {/* Close Overlay */}
        <button
          title="Close Overlay"
          onClick={toggleOverlay}
          className="w-[36px] h-[36px] flex items-center justify-center text-[#515154] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#1d1d1f] rounded-[8px] transition-colors duration-150 ml-0.5 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
