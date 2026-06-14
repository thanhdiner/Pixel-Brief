import React from 'react';
import { useStore } from './store';
import { FloatingToolbar } from './components/FloatingToolbar';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { SidePanel } from './components/SidePanel';

const App: React.FC = () => {
  const { isCapturing } = useStore();

  // Hide UI overlay controls (toolbar, list panel) during screenshot capture
  const showUI = !isCapturing;

  return (
    <div className="font-sans text-zinc-900 leading-normal antialiased">
      {/* SVG drawing/render canvas */}
      <AnnotationCanvas />

      {/* Control UI overlays */}
      {showUI && <FloatingToolbar />}
      {showUI && <SidePanel />}
    </div>
  );
};

export default App;
