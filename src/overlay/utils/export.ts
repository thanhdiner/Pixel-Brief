import JSZip from 'jszip';
import { Annotation } from '../types';
import { getArrowHeadPoints } from './geometry';

/**
 * Generates the Markdown prompt for the AI coding agent
 */
export function generateMarkdownPrompt(annotations: Annotation[]): string {
  const pageTitle = annotations[0]?.pageTitle || document.title;
  const pageUrl = annotations[0]?.pageUrl || window.location.href;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scrollX = Math.round(window.scrollX);
  const scrollY = Math.round(window.scrollY);

  let annotationsList = '';
  
  // Sort pins/annotations by pin number or creation time
  const sorted = [...annotations].sort((a, b) => {
    if (a.type === 'pin' && b.type === 'pin') {
      return (a.number || 0) - (b.number || 0);
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  sorted.forEach((ann, idx) => {
    const num = idx + 1;
    let details = '';
    
    if (ann.type === 'rect') {
      details = `Location: x=${Math.round(ann.x)}, y=${Math.round(ann.y)}, w=${Math.round(ann.width || 0)}, h=${Math.round(ann.height || 0)}`;
    } else if (ann.type === 'ellipse') {
      details = `Location (bounds): x=${Math.round(ann.x)}, y=${Math.round(ann.y)}, w=${Math.round(ann.width || 0)}, h=${Math.round(ann.height || 0)}`;
    } else if (ann.type === 'arrow') {
      details = `From x=${Math.round(ann.x)}, y=${Math.round(ann.y)} to x=${Math.round(ann.x + (ann.width || 0))}, y=${Math.round(ann.y + (ann.height || 0))}`;
    } else if (ann.type === 'pen') {
      details = `Freehand drawing containing ${ann.points?.length || 0} points, starting at x=${Math.round(ann.x)}, y=${Math.round(ann.y)}`;
    } else if (ann.type === 'pin') {
      details = `Pin #${ann.number} at x=${Math.round(ann.x)}, y=${Math.round(ann.y)}`;
    } else if (ann.type === 'text') {
      details = `Text Label at x=${Math.round(ann.x)}, y=${Math.round(ann.y)} containing: "${ann.text || ''}"`;
    }

    const requestText = ann.comment || ann.text || '(No comment added)';
    annotationsList += `${num}. [type: ${ann.type}, color: ${ann.color}] ${details}\n   Request: ${requestText}\n\n`;
  });

  if (sorted.length === 0) {
    annotationsList = 'No annotations added.\n';
  }

  return `# Visual UI Change Request

Page:
- Title: ${pageTitle}
- URL: ${pageUrl}
- Viewport: ${width}x${height}
- Scroll position: ${scrollX}, ${scrollY}

Context:
I annotated the webpage screenshot. Please inspect the numbered/colored marks and implement the requested UI changes.

Annotations:
${annotationsList}
Instructions for AI coding agent:
- Use the screenshot and annotations as the source of truth.
- Make only the requested UI changes.
- Do not refactor unrelated code.
- Keep existing responsive behavior unless the annotation asks otherwise.
- After changes, summarize modified files and explain how to verify.
`;
}

/**
 * Draws all annotations that intersect the current viewport onto a canvas loaded with the screenshot
 */
export function drawAnnotationsOnCanvas(
  screenshotDataUrl: string,
  annotations: Annotation[],
  scrollX: number,
  scrollY: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = screenshotDataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get 2d context'));
        return;
      }
      
      // Draw screenshot
      ctx.drawImage(img, 0, 0);

      // Set scale if screenshot is retina/high-DPI (naturalWidth differs from window.innerWidth)
      const scaleX = img.naturalWidth / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;

      // Draw each annotation
      annotations.forEach((ann) => {
        // Adjust coordinates relative to viewport and scale
        const x = (ann.x - scrollX) * scaleX;
        const y = (ann.y - scrollY) * scaleY;
        const strokeWidth = ann.strokeWidth * ((scaleX + scaleY) / 2);

        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (ann.type === 'rect') {
          const w = (ann.width || 0) * scaleX;
          const h = (ann.height || 0) * scaleY;
          ctx.strokeRect(x, y, w, h);
        } else if (ann.type === 'ellipse') {
          const w = (ann.width || 0) * scaleX;
          const h = (ann.height || 0) * scaleY;
          const rx = w / 2;
          const ry = h / 2;
          ctx.beginPath();
          ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (ann.type === 'arrow') {
          const x1 = x;
          const y1 = y;
          const x2 = (ann.x + (ann.width || 0) - scrollX) * scaleX;
          const y2 = (ann.y + (ann.height || 0) - scrollY) * scaleY;

          // Draw main line
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Draw arrowhead
          const headSize = Math.max(14, strokeWidth * 3.5);
          const arrowhead = getArrowHeadPoints(x1, y1, x2, y2, headSize);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(arrowhead.leftX, arrowhead.leftY);
          ctx.lineTo(arrowhead.rightX, arrowhead.rightY);
          ctx.closePath();
          ctx.fill();
        } else if (ann.type === 'pen') {
          if (ann.points && ann.points.length > 0) {
            ctx.beginPath();
            const startX = (ann.points[0].x - scrollX) * scaleX;
            const startY = (ann.points[0].y - scrollY) * scaleY;
            ctx.moveTo(startX, startY);
            
            for (let i = 1; i < ann.points.length; i++) {
              const ptX = (ann.points[i].x - scrollX) * scaleX;
              const ptY = (ann.points[i].y - scrollY) * scaleY;
              ctx.lineTo(ptX, ptY);
            }
            ctx.stroke();
          }
        } else if (ann.type === 'pin') {
          const radius = 16 * ((scaleX + scaleY) / 2);
          
          // Outer circle
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fill();

          // Inner white border/outline
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 * ((scaleX + scaleY) / 2);
          ctx.stroke();

          // Label number
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(14 * ((scaleX + scaleY) / 2))}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(ann.number || 1), x, y);
        } else if (ann.type === 'text') {
          const fontSize = 14 * ((scaleX + scaleY) / 2);
          ctx.font = `600 ${Math.round(fontSize)}px Arial, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(ann.text || '', x, y);
        }
      });
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
}

/**
 * Creates a zip bundle containing prompt.md, annotations.json and screenshot.png
 */
export async function createZipBundle(
  annotations: Annotation[],
  annotatedScreenshotDataUrl: string
): Promise<Blob> {
  const zip = new JSZip();
  
  // 1. Add annotations.json
  zip.file('annotations.json', JSON.stringify(annotations, null, 2));
  
  // 2. Add prompt.md
  const promptMd = generateMarkdownPrompt(annotations);
  zip.file('prompt.md', promptMd);
  
  // 3. Add screenshot.png
  const base64Data = annotatedScreenshotDataUrl.split(',')[1];
  zip.file('screenshot.png', base64Data, { base64: true });
  
  // Generate zip file as blob
  return await zip.generateAsync({ type: 'blob' });
}
