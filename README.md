# Uniphrase

A desktop localization and translation toolkit for Unity engine games.

Uniphrase provides a streamlined workflow for extracting, editing, and repacking text assets from Unity serialized files and bundles. Built with an Electron and Vue 3 user interface on top of a high-performance C# (.NET 8) core engine, it enables accurate and non-destructive asset modification.

---

## Key Features

- **Direct Asset Extraction:** Scans and extracts strings from `TextAsset`, serialized `MonoBehaviour`, and asset bundles without executing the target game.
- **Precision Repacking:** Injects updated strings into Unity `.assets` and `.bundle` archives while preserving original LZ4/LZMA compression standards.
- **Minimalist Interface:** Designed with Vue 3 and Tailwind CSS to deliver an organized, distraction-free environment for localization tasks.
- **Virtualized Data Grid:** Handles large-scale datasets with over 10,000 string entries smoothly without performance degradation.
- **Interoperable Data Pipeline:** Exports and imports structured JSON schemas compatible with modern machine translation services, LLM workflows, and custom translation scripts.
- **Non-Destructive Workflow:** Generates patched bundles or stand-alone patch directories to protect original game data.

---

## Getting Started

### 1. Download & Installation

1. Navigate to the **Releases** section on GitHub.
2. Download the latest installer or portable executable (`.zip` or `.exe`).
3. Extract or install the package, then launch `Uniphrase.exe`.

### 2. Basic Workflow

1. **Select Asset File:** Click **Open Asset** in the top navigation bar and select the target Unity file (such as `resources.assets`, `sharedassets0.assets`, or specific asset bundles) inside your game directory.
2. **Extract Strings:** Click **Extract** to scan the asset. All recognized text entries will appear in the translation grid.
3. **Translate:**
   - Double-click on any entry in the **Translated Text** column to edit text directly.
   - Alternatively, click **Export JSON** to run batch translations through external tools or LLM APIs, then use **Import JSON** to update the grid.
4. **Repack & Apply Patch:** Click **Build Patch** to generate the updated asset files. Replace the original game file with the generated output to verify your changes in-game.

---

## Architecture Overview

Uniphrase implements a hybrid sidecar architecture to separate interface rendering from compute-heavy binary serialization:

- **Frontend & App Lifecycle:** Electron, Vue 3 (Composition API), TypeScript, Tailwind CSS
- **State Management:** Pinia
- **Core Engine (Sidecar Executable):** .NET 8 CLI utility powered by AssetsTools.NET v3
- **IPC Layer:** Typed Node.js `child_process` streaming events between Electron Main and the UI runtime

```text
[ Electron (Vue 3 + Tailwind UI) ]
               |  Typed IPC
[ Electron Main Process (Node.js) ]
               |  Standard I/O Streams (JSON-RPC / Stdout)
[ C# Engine Executable (AssetsTools.NET) ]
               |  Binary Parsing & Serialization
[ Unity Game Files (.assets / .bundle) ]
