# Uniphrase

Desktop workbench for extracting, editing, and repacking text from Unity `.assets` and `.bundle` files.

## Layout

```text
backend/UnityAssetEngine/     .NET 8 CLI (AssetsTools.NET 3.0.5)
resources/bin/                self-contained unity-core-engine.exe + classdata.tpk
src/main/                     Electron main process and IPC
src/preload/                  context-isolated preload bridge
src/renderer/                 Vue 3 workspace
src/shared/                   IPC contracts shared by all processes
```

## Run

```bash
npm install
npm run engine:publish
npm run dev
```

`npm run dev` also works after `npm run engine:build`. The app looks for `resources/bin/unity-core-engine.exe` first, then the Release build beside the project.

## Engine

Stdout is one JSON object per line.

```text
unity-core-engine extract --input <file-or-folder> --output <json>
unity-core-engine repack --input <file-or-folder> --translations <json> --output <folder>
unity-core-engine version
```

`pathId` is a string so large Unity identifiers survive JavaScript. Numeric path IDs are still accepted. `fieldPath` locates the string inside a TextAsset (`m_Script`) or a MonoBehaviour. An empty `translation` keeps the original text.

Bundles are rewritten with their original compression (`None`, `LZMA`, `LZ4`, or `LZ4Fast`). `classdata.tpk` is loaded automatically from the engine directory for assets files that ship without a type tree.
