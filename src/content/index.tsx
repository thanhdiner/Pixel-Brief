import { createRoot, Root } from 'react-dom/client';
import App from '../overlay/App';
import { useStore } from '../overlay/store';
// @ts-ignore
import contentStyles from './content.css?inline';

const ROOT_ID = 'pixelbrief-root';
let reactRoot: Root | null = null;
let container: HTMLDivElement | null = null;

function mountOverlay() {
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  // Create root container for overlay app
  container = document.createElement('div');
  container.id = ROOT_ID;
  container.dataset.pixelbriefRoot = 'true';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '0';
  container.style.height = '0';
  container.style.zIndex = '2147483647';
  container.style.overflow = 'visible';
  container.style.pointerEvents = 'none';

  // Attach shadow DOM to isolate page styling from extension styling
  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Load Tailwind styles inline to bypass strict CSP blocks on some websites
  const style = document.createElement('style');
  style.textContent = contentStyles;
  shadowRoot.appendChild(style);

  // App mount target div
  const appContainer = document.createElement('div');
  appContainer.id = 'pixel-brief-app';
  appContainer.style.position = 'fixed';
  appContainer.style.top = '0';
  appContainer.style.left = '0';
  appContainer.style.width = '100vw';
  appContainer.style.height = '100vh';
  appContainer.style.pointerEvents = 'none';
  shadowRoot.appendChild(appContainer);

  document.body.appendChild(container);

  // Mount React overlay application
  reactRoot = createRoot(appContainer);
  reactRoot.render(<App />);
}

function unmountOverlay() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  const rootEl = document.getElementById(ROOT_ID);
  if (rootEl) {
    rootEl.remove();
  }
  container = null;
}

// Subscribe to store changes to handle mount/unmount dynamically
let lastOverlayOpen = useStore.getState().overlayOpen;

// If initialized as open, mount it immediately
if (lastOverlayOpen) {
  mountOverlay();
}

useStore.subscribe((state) => {
  if (state.overlayOpen !== lastOverlayOpen) {
    lastOverlayOpen = state.overlayOpen;
    if (lastOverlayOpen) {
      mountOverlay();
    } else {
      unmountOverlay();
    }
  }
});

// Background script triggers this to toggle the toolbar and sidebar
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'TOGGLE_OVERLAY') {
    useStore.getState().toggleOverlay();
  }
});

// Auto-restore annotations on page load (saved in store, but only rendered if overlay is open)
const origin = window.location.origin;
const pathname = window.location.pathname;
const storageKey = `pixelbrief:${origin}:${pathname}`;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get([storageKey], (result) => {
    const data = result[storageKey];
    if (data && Array.isArray(data) && data.length > 0) {
      useStore.getState().setAnnotations(data);
    }
  });
}
