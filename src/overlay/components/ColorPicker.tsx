import React, { useState, useEffect, useRef } from 'react';

interface ColorPreset {
  name: string;
  value: string;
}

const PRESETS: ColorPreset[] = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' }
];

interface Props {
  selectedColor: string;
  onChangeColor: (color: string) => void;
}

const getStoredCustomColor = () => {
  return localStorage.getItem('pixelbrief_custom_color') || '#a855f7';
};

const setStoredCustomColor = (val: string) => {
  localStorage.setItem('pixelbrief_custom_color', val);
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ 'pixelbrief_custom_color': val });
  }
};

export const ColorPicker: React.FC<Props> = ({ selectedColor, onChangeColor }) => {
  const [customColor, setCustomColor] = useState(getStoredCustomColor);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  // Sync from chrome storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pixelbrief_custom_color'], (result) => {
        if (result.pixelbrief_custom_color) {
          setCustomColor(result.pixelbrief_custom_color);
        }
      });
    }
  }, []);

  const normalizeColor = (v: string) => v.toLowerCase().trim();
  const isPreset = PRESETS.some(p => normalizeColor(p.value) === normalizeColor(selectedColor));
  const isCustomSelected = !isPreset;

  return (
    <div className="flex flex-wrap items-center gap-[10px] mt-[8px] max-w-full">
      {/* Preset swatches */}
      {PRESETS.map((preset) => {
        const isSelected = !isCustomSelected && normalizeColor(selectedColor) === normalizeColor(preset.value);
        return (
          <button
            key={preset.value}
            type="button"
            title={preset.name}
            onClick={(e) => { e.stopPropagation(); onChangeColor(preset.value); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-[32px] h-[32px] flex-[0_0_32px] rounded-full relative inline-flex items-center justify-center bg-transparent hover:bg-black/[0.04] transition-all duration-150 cursor-pointer focus:outline-none"
            aria-label={`Select ${preset.name}`}
          >
            {isSelected && (
              <span className="absolute w-[28px] h-[28px] rounded-full border-2 border-zinc-400 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" />
            )}
            <span
              className="w-[18px] h-[18px] rounded-full flex-shrink-0 relative z-10"
              style={{ backgroundColor: preset.value, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
            />
          </button>
        );
      })}

      {/*
        Custom color swatch.
        The hidden <input type="color"> is placed INSIDE the button at position 0,0
        so Chrome/OS shows the native color picker near the actual swatch location on screen.
        Positioning it off-screen causes the picker to appear off-screen too.
      */}
      <div
        title="Custom color"
        aria-label="Choose custom color"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="w-[32px] h-[32px] flex-[0_0_32px] rounded-full relative inline-flex items-center justify-center bg-transparent hover:bg-black/[0.04] transition-all duration-150 cursor-pointer"
      >
        {isCustomSelected && (
          <span className="absolute w-[28px] h-[28px] rounded-full border-2 border-zinc-400 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" />
        )}
        <span
          className="w-[18px] h-[18px] rounded-full flex-shrink-0 relative z-10"
          style={{
            background: isCustomSelected
              ? customColor
              : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)'
          }}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={customColor}
          onChange={(e) => {
            const val = e.target.value;
            setCustomColor(val);
            onChangeColor(val);
            setStoredCustomColor(val);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            border: 'none',
            padding: 0,
            zIndex: 20,
          }}
        />
      </div>
    </div>
  );
};
