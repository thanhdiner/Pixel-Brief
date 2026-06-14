# PixelBrief - AI Agent UI Annotator

PixelBrief is a Chrome extension (Manifest V3) that lets users visually annotate webpages, add text comments, and export structured prompts and screenshots for AI coding agents.

---

## Overview

PixelBrief is designed for developers, designers, and product managers who pair-program with AI coding agents (such as Antigravity, Devin, or Cursor). By drawing directly on the webpage, you can highlight issues, write down desired changes, and export a complete structured prompt bundle that AI agents can parse and execute.

---

## Features

| Feature | Description |
| :--- | :--- |
| **Floating Toolbar** | Moveable annotation toolbar containing Select, Rectangle, Ellipse, Arrow, Freehand Pen, Pin, and Text tools. |
| **Scroll Synchronization** | Vector drawings are bound to document-relative offsets, keeping them pinned to elements during page scroll. |
| **Shadow DOM Isolation** | The overlay interface is mounted in a Shadow DOM to isolate styles and prevent host page styles from breaking the toolbar. |
| **Persistent Storage** | Annotations are automatically saved per URL path and reload when you reopen the overlay or refresh. |
| **Side Panel Manager** | Side list showing all annotations and notes with click-to-zoom centering functionality. |
| **AI Prompt Export** | Generates a clean structured Markdown prompt detailing each annotated element and its text note. |
| **ZIP Bundle Export** | Captures a viewport screenshot, overlays your drawings, and bundles `screenshot.png` + `prompt.md` + `annotations.json` in a single ZIP file. |

---

## Installation

### Prerequisites
* **Node.js**: Version 18 or higher.
* **npm**: Package manager (installed with Node.js).

### Step-by-step Installation
1. **Clone or Download** the repository to your local machine.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build the extension**:
   ```bash
   npm run build
   ```
   This generates the compiled extension in the `dist` folder.
4. **Load into Google Chrome**:
   * Open Chrome and navigate to `chrome://extensions`.
   * Enable **Developer Mode** using the toggle switch in the top-right corner.
   * Click the **Load unpacked** button in the top-left corner.
   * Select the `dist` folder located in the root of this project.

---

## Usage

### User Flow
1. **Activate the Overlay**: Open any regular webpage (e.g. a public site or your local development server) and press **`Ctrl+Shift+M`** (or **`Cmd+Shift+M`** on macOS) or click the PixelBrief extension icon.
2. **Draw Annotations**: Select a drawing tool (Rectangle, Ellipse, Arrow, Pen, Pin, or Text) from the floating toolbar and click/drag on the webpage.
3. **Add Notes**: Drop a numbered comment pin, click on it, or open the side panel to add text feedback.
4. **Refine layout**: Resize shapes using the active handles or drag/move annotations.
5. **Export Assets**:
   * Click **Copy AI Prompt** in the Side Panel or Toolbar More menu to copy a structured Markdown prompt.
   * Click **Export Bundle (ZIP)** to download the prompt, screenshot, and annotation JSON.

---

## Permissions

The extension requests the following permissions in `manifest.json` for specific features:

| Permission | Purpose |
| :--- | :--- |
| `activeTab` | Allows the extension to run scripts, overlay the canvas, and capture the screen on the active webpage. |
| `scripting` | Used to inject the content script dynamically when the user toggles the extension. |
| `storage` | Saves visual annotations locally so they are preserved across refreshes and browser sessions. |
| `tabs` | Used to query tab attributes and establish communications between background service workers and content overlays. |
| `clipboardWrite` | Allows the user to copy generated Markdown prompts directly to their clipboard. |

---

## Project Structure

```
PixelBrief/
├── public/                 # Static assets (icons, manifest.json)
├── src/
│   ├── background/         # Service worker for hotkeys and screen capture
│   ├── content/            # Entry point for injection and Shadow DOM mounting
│   └── overlay/            # React UI components and state management
│       ├── components/     # Toolbar, style popovers, and side panel
│       ├── utils/          # Export handlers, zip builders, and geometry math
│       ├── store.ts        # Zustand state store and persistent storage sync
│       └── types.ts        # Vector shape data type mappings
├── index.html              # Development sandbox page
├── popup.html              # Extension action popup window
└── package.json            # Dependencies and build scripts
```

---

## Troubleshooting

### Overlay does not appear
* **Security Pages**: Chrome blocks extension script injection on `chrome://` system tabs and the Chrome Web Store. Use a standard web page.
* **Reload Needed**: If you just loaded or rebuilt the extension, reload the webpage first to let Chrome initialize the newly registered content script.

### Screenshot capture fails
* Ensure the tab is active and fully loaded. The screenshot API requires active viewport visibility.

---

## Notes
* **Viewport Captures**: Captures only the visible portion of the viewport. Scroll to the desired area before triggering the capture to match annotations.
* **Dynamic Content**: If elements on the page move dynamically (like modal windows opening/closing), annotations will remain fixed at their original absolute document coordinates.

---

## License

MIT License.
