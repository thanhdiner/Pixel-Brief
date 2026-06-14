import { Point } from '../types';

/**
 * Calculates the coordinates of an arrowhead base points
 * @param x1 Start X
 * @param y1 Start Y
 * @param x2 End X (arrow tip)
 * @param y2 End Y (arrow tip)
 * @param size Size of the arrowhead
 */
export function getArrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number = 16) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowAngle = Math.PI / 6; // 30 degrees

  const leftX = x2 - size * Math.cos(angle - arrowAngle);
  const leftY = y2 - size * Math.sin(angle - arrowAngle);

  const rightX = x2 - size * Math.cos(angle + arrowAngle);
  const rightY = y2 - size * Math.sin(angle + arrowAngle);

  return { leftX, leftY, rightX, rightY };
}

/**
 * Checks if a point is near a line segment (for selecting lines/arrows)
 */
export function isPointNearLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tolerance: number = 8
): boolean {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy) < tolerance;
}

/**
 * Helper to get bounding box of a list of points
 */
export function getPointsBoundingBox(points: Point[]) {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
