import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Annotation, Point } from '../types';
import { getArrowHeadPoints, getPointsBoundingBox } from '../utils/geometry';

export const AnnotationCanvas: React.FC = () => {
  const {
    annotations,
    activeTool,
    setActiveTool,
    strokeColor,
    strokeWidth,
    visible,
    selectedId,
    setSelectedId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation
  } = useStore();

  // Scroll offset tracking
  const [scroll, setScroll] = useState({ x: window.scrollX, y: window.scrollY });
  useEffect(() => {
    const handleScroll = () => {
      setScroll({ x: window.scrollX, y: window.scrollY });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Drawing States
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [tempRect, setTempRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Moving/Resizing States
  const [dragAction, setDragAction] = useState<{
    type: 'move' | 'resize-br' | 'arrow-start' | 'arrow-end';
    annId: string;
    startMouse: Point;
    origAnn: Annotation;
  } | null>(null);

  // Text Input State
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);

  // Convert client coords to document coords
  const getDocCoords = (e: React.MouseEvent | MouseEvent): Point => {
    return {
      x: e.clientX + window.scrollX,
      y: e.clientY + window.scrollY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only handle direct clicks on background, or ignore clicks if they're on controls
    if (activeTool === 'select') {
      // If clicking empty space on the SVG, clear selection
      if (e.target === svgRef.current) {
        setSelectedId(null);
      }
      return;
    }

    // Check if we are currently editing a text annotation, commit it if clicking elsewhere
    if (editingTextId) {
      commitText(editingTextId, textInputValue);
      return;
    }

    if (activeTool === 'text') {
      return;
    }

    const docPt = getDocCoords(e);
    setIsDrawing(true);
    setStartPoint(docPt);

    if (activeTool === 'pen') {
      setTempPoints([docPt]);
    } else if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'arrow') {
      setTempRect({ x: docPt.x, y: docPt.y, w: 0, h: 0 });
    } else if (activeTool === 'pin') {
      // Numbered pin drops immediately
      const pins = annotations.filter((a) => a.type === 'pin');
      const maxPin = pins.reduce((max, a) => (a.number && a.number > max ? a.number : max), 0);
      const nextPin = maxPin + 1;

      const newPin: Annotation = {
        id: crypto.randomUUID(),
        type: 'pin',
        pageUrl: window.location.href,
        pageTitle: document.title,
        createdAt: new Date().toISOString(),
        color: strokeColor,
        strokeWidth: 4, // Fixed strokeWidth for pin border
        x: docPt.x,
        y: docPt.y,
        number: nextPin,
        comment: ''
      };

      addAnnotation(newPin);
      setIsDrawing(false);
      // Automatically switch to select tool so they can comment
      setActiveTool('select');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !startPoint) return;
    const docPt = getDocCoords(e);

    if (activeTool === 'pen') {
      setTempPoints((prev) => [...prev, docPt]);
    } else if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'arrow') {
      setTempRect({
        x: Math.min(startPoint.x, docPt.x),
        y: Math.min(startPoint.y, docPt.y),
        w: docPt.x - startPoint.x,
        h: docPt.y - startPoint.y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'text') {
      const docPt = getDocCoords(e);
      const id = crypto.randomUUID();
      const annotation: Annotation = {
        id,
        type: 'text',
        pageUrl: window.location.href,
        pageTitle: document.title,
        createdAt: new Date().toISOString(),
        color: strokeColor,
        strokeWidth,
        x: docPt.x,
        y: docPt.y,
        text: '',
        comment: ''
      };

      addAnnotation(annotation);
      setEditingTextId(id);
      setSelectedId(id);
      setTextInputValue('');
      return;
    }

    if (!isDrawing || !startPoint) return;
    setIsDrawing(false);

    const docPt = getDocCoords(e);
    const id = crypto.randomUUID();

    if (activeTool === 'pen' && tempPoints.length > 1) {
      const bbox = getPointsBoundingBox(tempPoints);
      const newAnn: Annotation = {
        id,
        type: 'pen',
        pageUrl: window.location.href,
        pageTitle: document.title,
        createdAt: new Date().toISOString(),
        color: strokeColor,
        strokeWidth,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        points: tempPoints,
        comment: ''
      };
      addAnnotation(newAnn);
    } else if (activeTool === 'rect' || activeTool === 'ellipse') {
      const w = Math.abs(docPt.x - startPoint.x);
      const h = Math.abs(docPt.y - startPoint.y);
      const x = Math.min(startPoint.x, docPt.x);
      const y = Math.min(startPoint.y, docPt.y);

      // Only add if it has some dimension
      if (w > 5 && h > 5) {
        const newAnn: Annotation = {
          id,
          type: activeTool,
          pageUrl: window.location.href,
          pageTitle: document.title,
          createdAt: new Date().toISOString(),
          color: strokeColor,
          strokeWidth,
          x,
          y,
          width: w,
          height: h,
          comment: ''
        };
        addAnnotation(newAnn);
      }
    } else if (activeTool === 'arrow') {
      const w = docPt.x - startPoint.x;
      const h = docPt.y - startPoint.y;

      if (Math.abs(w) > 5 || Math.abs(h) > 5) {
        const newAnn: Annotation = {
          id,
          type: 'arrow',
          pageUrl: window.location.href,
          pageTitle: document.title,
          createdAt: new Date().toISOString(),
          color: strokeColor,
          strokeWidth,
          x: startPoint.x,
          y: startPoint.y,
          width: w,
          height: h,
          comment: ''
        };
        addAnnotation(newAnn);
      }
    }

    setStartPoint(null);
    setTempPoints([]);
    setTempRect(null);
    setActiveTool('select'); // Automatically revert to select tool after drawing
  };

  // Commit text changes
  const commitText = (annotationId: string, value: string) => {
    const text = value.trim();

    if (!text) {
      deleteAnnotation(annotationId);
      setEditingTextId(null);
      return;
    }

    updateAnnotation(annotationId, {
      text,
      updatedAt: new Date().toISOString(),
    });

    setEditingTextId(null);
  };

  // Drag select and move operations
  const handleShapeMouseDown = (e: React.MouseEvent, ann: Annotation, handleType: 'move' | 'resize-br' | 'arrow-start' | 'arrow-end' = 'move') => {
    if (activeTool !== 'select') return;
    
    e.stopPropagation();
    setSelectedId(ann.id);

    const docPt = getDocCoords(e);
    setDragAction({
      type: handleType,
      annId: ann.id,
      startMouse: docPt,
      origAnn: { ...ann }
    });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragAction) return;

      const docPt = {
        x: e.clientX + window.scrollX,
        y: e.clientY + window.scrollY
      };
      
      const dx = docPt.x - dragAction.startMouse.x;
      const dy = docPt.y - dragAction.startMouse.y;
      
      const { type, annId, origAnn } = dragAction;

      if (type === 'move') {
        if (origAnn.type === 'pen' && origAnn.points) {
          const nextPoints = origAnn.points.map((p) => ({
            x: p.x + dx,
            y: p.y + dy
          }));
          updateAnnotation(annId, {
            x: origAnn.x + dx,
            y: origAnn.y + dy,
            points: nextPoints
          });
        } else {
          updateAnnotation(annId, {
            x: origAnn.x + dx,
            y: origAnn.y + dy
          });
        }
      } else if (type === 'resize-br') {
        const nextW = Math.max(10, (origAnn.width || 0) + dx);
        const nextH = Math.max(10, (origAnn.height || 0) + dy);
        updateAnnotation(annId, {
          width: nextW,
          height: nextH
        });
      } else if (type === 'arrow-start') {
        // Start handle moved: x, y changes. width and height adjust to keep end point static
        const newX = origAnn.x + dx;
        const newY = origAnn.y + dy;
        const endX = origAnn.x + (origAnn.width || 0);
        const endY = origAnn.y + (origAnn.height || 0);
        
        updateAnnotation(annId, {
          x: newX,
          y: newY,
          width: endX - newX,
          height: endY - newY
        });
      } else if (type === 'arrow-end') {
        // End handle moved: width and height adjusts
        updateAnnotation(annId, {
          width: (origAnn.width || 0) + dx,
          height: (origAnn.height || 0) + dy
        });
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragAction) {
        setDragAction(null);
      }
    };

    if (dragAction) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragAction, updateAnnotation]);

  if (!visible) return null;

  return (
    <>
      <svg
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`fixed top-0 left-0 w-full h-full z-[2147483640] ${
          activeTool === 'select' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
        }`}
        style={{ background: 'transparent' }}
      >
        <g transform={`translate(${-scroll.x}, ${-scroll.y})`}>
          {annotations.map((ann) => {
            const isSelected = selectedId === ann.id;
            const strokeColorValue = ann.color;
            const strokeWidthValue = ann.strokeWidth;

            // Common styles for interactive SVGs when in select mode
            const interactiveProps = {
              onMouseDown: (e: React.MouseEvent) => handleShapeMouseDown(e, ann, 'move'),
              className: `transition-all duration-100 ${
                activeTool === 'select' ? 'cursor-move pointer-events-auto' : ''
              }`,
              style: isSelected ? { filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' } : undefined
            };

            return (
              <g key={ann.id}>
                {/* 1. Rectangle */}
                {ann.type === 'rect' && (
                  <>
                    <rect
                      x={ann.x}
                      y={ann.y}
                      width={ann.width}
                      height={ann.height}
                      fill="transparent"
                      stroke={strokeColorValue}
                      strokeWidth={strokeWidthValue}
                      {...interactiveProps}
                    />
                    {isSelected && activeTool === 'select' && (
                      <>
                        {/* Selected boundary box indicator */}
                        <rect
                          x={ann.x - 2}
                          y={ann.y - 2}
                          width={(ann.width || 0) + 4}
                          height={(ann.height || 0) + 4}
                          fill="transparent"
                          stroke="#3b82f6"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                          className="pointer-events-none"
                        />
                        {/* Bottom-right Resize Handle */}
                        <circle
                          cx={ann.x + (ann.width || 0)}
                          cy={ann.y + (ann.height || 0)}
                          r="6"
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="pointer-events-auto cursor-nwse-resize"
                          onMouseDown={(e) => handleShapeMouseDown(e, ann, 'resize-br')}
                        />
                      </>
                    )}
                  </>
                )}

                {/* 2. Ellipse */}
                {ann.type === 'ellipse' && (
                  <>
                    <ellipse
                      cx={ann.x + (ann.width || 0) / 2}
                      cy={ann.y + (ann.height || 0) / 2}
                      rx={(ann.width || 0) / 2}
                      ry={(ann.height || 0) / 2}
                      fill="transparent"
                      stroke={strokeColorValue}
                      strokeWidth={strokeWidthValue}
                      {...interactiveProps}
                    />
                    {isSelected && activeTool === 'select' && (
                      <>
                        <rect
                          x={ann.x - 2}
                          y={ann.y - 2}
                          width={(ann.width || 0) + 4}
                          height={(ann.height || 0) + 4}
                          fill="transparent"
                          stroke="#3b82f6"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                          className="pointer-events-none"
                        />
                        <circle
                          cx={ann.x + (ann.width || 0)}
                          cy={ann.y + (ann.height || 0)}
                          r="6"
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="pointer-events-auto cursor-nwse-resize"
                          onMouseDown={(e) => handleShapeMouseDown(e, ann, 'resize-br')}
                        />
                      </>
                    )}
                  </>
                )}

                {/* 3. Arrow */}
                {ann.type === 'arrow' && (
                  <>
                    {/* Main Arrow Line */}
                    <line
                      x1={ann.x}
                      y1={ann.y}
                      x2={ann.x + (ann.width || 0)}
                      y2={ann.y + (ann.height || 0)}
                      stroke={strokeColorValue}
                      strokeWidth={strokeWidthValue}
                      {...interactiveProps}
                    />
                    {/* Arrowhead */}
                    {(() => {
                      const arrowhead = getArrowHeadPoints(
                        ann.x,
                        ann.y,
                        ann.x + (ann.width || 0),
                        ann.y + (ann.height || 0),
                        Math.max(14, strokeWidthValue * 3.5)
                      );
                      return (
                        <polygon
                          points={`${ann.x + (ann.width || 0)},${ann.y + (ann.height || 0)} ${arrowhead.leftX},${arrowhead.leftY} ${arrowhead.rightX},${arrowhead.rightY}`}
                          fill={strokeColorValue}
                          {...interactiveProps}
                        />
                      );
                    })()}

                    {/* Resize Handles (Start & End points) */}
                    {isSelected && activeTool === 'select' && (
                      <>
                        {/* Start handle */}
                        <circle
                          cx={ann.x}
                          cy={ann.y}
                          r="6"
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="pointer-events-auto cursor-pointer"
                          onMouseDown={(e) => handleShapeMouseDown(e, ann, 'arrow-start')}
                        />
                        {/* End handle */}
                        <circle
                          cx={ann.x + (ann.width || 0)}
                          cy={ann.y + (ann.height || 0)}
                          r="6"
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="pointer-events-auto cursor-pointer"
                          onMouseDown={(e) => handleShapeMouseDown(e, ann, 'arrow-end')}
                        />
                      </>
                    )}
                  </>
                )}

                {/* 4. Freehand Pen */}
                {ann.type === 'pen' && ann.points && (
                  <>
                    <path
                      d={`M ${ann.points.map((p) => `${p.x} ${p.y}`).join(' L ')}`}
                      fill="transparent"
                      stroke={strokeColorValue}
                      strokeWidth={strokeWidthValue}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      {...interactiveProps}
                    />
                    {isSelected && activeTool === 'select' && (
                      // Draw a simple bounding box
                      <rect
                        x={ann.x - 4}
                        y={ann.y - 4}
                        width={(ann.width || 0) + 8}
                        height={(ann.height || 0) + 8}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                        className="pointer-events-none"
                      />
                    )}
                  </>
                )}

                {/* 5. Numbered Pin */}
                {ann.type === 'pin' && (
                  <>
                    {/* Base pin group */}
                    <g
                      {...interactiveProps}
                      transform={`translate(${ann.x}, ${ann.y})`}
                    >
                      <circle
                        cx="0"
                        cy="0"
                        r="16"
                        fill={strokeColorValue}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        className="transition-all hover:scale-110 active:scale-95"
                      />
                      <text
                        x="0"
                        y="0"
                        fill="#ffffff"
                        fontWeight="bold"
                        fontSize="14"
                        fontFamily="Arial, sans-serif"
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {ann.number}
                      </text>
                    </g>
                    {isSelected && activeTool === 'select' && (
                      <circle
                        cx={ann.x}
                        cy={ann.y}
                        r="20"
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                        className="pointer-events-none"
                      />
                    )}
                  </>
                )}

                {/* Text labels are rendered as HTML elements below */}
              </g>
            );
          })}

          {/* Render Active Temporary Drawings (Dashed outline / drag feedback) */}
          {isDrawing && tempRect && (
            <>
              {activeTool === 'rect' && (
                <rect
                  x={tempRect.x}
                  y={tempRect.y}
                  width={tempRect.w}
                  height={tempRect.h}
                  fill="transparent"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray="4,4"
                />
              )}
              {activeTool === 'ellipse' && (
                <ellipse
                  cx={tempRect.x + tempRect.w / 2}
                  cy={tempRect.y + tempRect.h / 2}
                  rx={Math.abs(tempRect.w / 2)}
                  ry={Math.abs(tempRect.h / 2)}
                  fill="transparent"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray="4,4"
                />
              )}
              {activeTool === 'arrow' && (
                <>
                  <line
                    x1={startPoint?.x}
                    y1={startPoint?.y}
                    x2={startPoint!.x + tempRect.w}
                    y2={startPoint!.y + tempRect.h}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray="4,4"
                  />
                  {(() => {
                    const arrowhead = getArrowHeadPoints(
                      startPoint!.x,
                      startPoint!.y,
                      startPoint!.x + tempRect.w,
                      startPoint!.y + tempRect.h,
                      Math.max(14, strokeWidth * 3.5)
                    );
                    return (
                      <polygon
                        points={`${startPoint!.x + tempRect.w},${startPoint!.y + tempRect.h} ${arrowhead.leftX},${arrowhead.leftY} ${arrowhead.rightX},${arrowhead.rightY}`}
                        fill={strokeColor}
                        opacity="0.6"
                      />
                    );
                  })()}
                </>
              )}
            </>
          )}

          {activeTool === 'pen' && tempPoints.length > 1 && (
            <path
              d={`M ${tempPoints.map((p) => `${p.x} ${p.y}`).join(' L ')}`}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      </svg>

      {/* Render Text Annotation Inline Editor */}
      {annotations.map((ann) => {
        if (ann.type === 'text' && editingTextId === ann.id) {
          return (
            <div
              key={`editor-${ann.id}`}
              style={{
                position: 'fixed',
                left: `${ann.x - scroll.x}px`,
                top: `${ann.y - scroll.y}px`,
                zIndex: 2147483647,
                pointerEvents: 'auto'
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col"
            >
              <textarea
                autoFocus
                value={textInputValue}
                placeholder="Type text label..."
                onChange={(e) => setTextInputValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText(ann.id, textInputValue);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!ann.text) {
                      deleteAnnotation(ann.id);
                    }
                    setEditingTextId(null);
                  }
                }}
                onBlur={() => commitText(ann.id, textInputValue)}
                style={{
                  minWidth: '120px',
                  minHeight: '32px',
                  background: 'rgba(17,20,26,0.95)',
                  border: '1px solid #3B82F6',
                  borderRadius: '8px',
                  color: ann.color,
                  padding: '6px 8px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 600,
                  resize: 'both',
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>
          );
        }
        return null;
      })}

      {/* Render Text Labels */}
      {annotations.map((ann) => {
        if (ann.type === 'text' && editingTextId !== ann.id) {
          const isSelected = selectedId === ann.id;
          return (
            <div
              key={`label-${ann.id}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTextId(ann.id);
                setTextInputValue(ann.text || '');
                setSelectedId(ann.id);
              }}
              onMouseDown={(e) => {
                if (activeTool === 'select') {
                  handleShapeMouseDown(e, ann, 'move');
                }
              }}
              style={{
                position: 'fixed',
                left: `${ann.x - scroll.x}px`,
                top: `${ann.y - scroll.y}px`,
                zIndex: 2147483645,
                color: ann.color,
                fontSize: '14px',
                fontWeight: 600,
                whiteSpace: 'pre-wrap',
                pointerEvents: activeTool === 'select' ? 'auto' : 'none',
                cursor: activeTool === 'select' ? 'move' : 'crosshair',
                userSelect: 'none',
                padding: '4px',
                borderRadius: '4px',
                border: isSelected && activeTool === 'select' ? '1px dashed #3b82f6' : '1px solid transparent',
              }}
            >
              {ann.text}
            </div>
          );
        }
        return null;
      })}
    </>
  );
};
