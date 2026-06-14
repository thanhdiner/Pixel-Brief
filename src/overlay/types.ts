export interface Point {
  x: number;
  y: number;
}

export type AnnotationType = 'rect' | 'ellipse' | 'arrow' | 'pen' | 'pin' | 'text';
export type ToolType = AnnotationType | 'select';

export interface Annotation {
  id: string;
  type: AnnotationType;
  pageUrl: string;
  pageTitle: string;
  createdAt: string;
  color: string;
  strokeWidth: number;
  x: number; // Document relative x (pointer.clientX + window.scrollX)
  y: number; // Document relative y (pointer.clientY + window.scrollY)
  width?: number; // For rect / ellipse
  height?: number; // For rect / ellipse
  points?: Point[]; // For pen (freehand path)
  text?: string; // For text labels
  comment?: string; // For pin/annotation notes
  number?: number; // For pin numbers
  updatedAt?: string; // For updates
}
