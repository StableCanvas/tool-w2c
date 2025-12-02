import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone, type FileWithPath } from "react-dropzone";
import { JsonReader, ImageReader, CWorkflow } from "@stable-canvas/cw-reader";
import { Transpiler } from "@stable-canvas/comfyui-client-transpiler";
import Editor from "@monaco-editor/react";
import "./App.css";

// Icons (Simple SVG implementation to avoid dependencies)
const IconUpload = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconClipboard = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);
const IconCheck = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconCopy = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconFile = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

function App() {
  const [workflowJson, setWorkflowJson] = useState<CWorkflow | null>(null);
  const [transpiledCode, setTranspiledCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Logic: Processing ---

  const processWorkflowObject = useCallback(
    (workflow: CWorkflow, sourceName: string) => {
      try {
        setWorkflowJson(workflow);
        setFileName(sourceName);

        const transpiler = new Transpiler(workflow);
        const code = transpiler.toCode();
        setTranspiledCode(code);
      } catch (err: any) {
        console.error("Transpilation error:", err);
        setError(`Transpilation failed: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const processFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);
      setWorkflowJson(null);
      setTranspiledCode("");

      try {
        let reader;
        let workflow: CWorkflow;

        if (file.type === "application/json" || file.name.endsWith(".json")) {
          const fileContent = await file.text();
          const jsonData = JSON.parse(fileContent);
          reader = new JsonReader(jsonData);
          workflow = await reader.getWorkflow();
        } else if (file.type === "image/png" || file.name.endsWith(".png")) {
          const arrayBuffer = await file.arrayBuffer();
          reader = new ImageReader(arrayBuffer);
          workflow = await reader.getWorkflow();
        } else {
          throw new Error("Unsupported file type. Please upload .json or .png");
        }

        processWorkflowObject(workflow, file.name);
      } catch (err: any) {
        console.error("Processing error:", err);
        setError(`Error processing file: ${err.message || "Unknown error"}`);
        setIsLoading(false);
      }
    },
    [processWorkflowObject]
  );

  const processTextContent = useCallback(
    async (text: string) => {
      try {
        const json = JSON.parse(text);
        // Basic validation to see if it looks like a workflow or ComfyUI API format
        if (typeof json !== "object" || json === null)
          throw new Error("Invalid JSON");

        setIsLoading(true);
        setError(null);

        const reader = new JsonReader(json);
        const workflow = await reader.getWorkflow();
        processWorkflowObject(workflow, "pasted-content.json");
      } catch (err) {
        // If it's not JSON, we just ignore it silently in paste handlers usually,
        // but if explicit, we set error.
        console.warn("Clipboard text was not valid JSON workflow");
        setError("Clipboard content is not a valid JSON workflow.");
      }
    },
    [processWorkflowObject]
  );

  // --- Logic: Paste & Drop ---

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"], "image/png": [".png"] },
    multiple: false,
    noClick: true, // We handle click manually via button
    noKeyboard: true,
  });

  // Handle Global Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // 1. Check for Files (e.g. copied PNG from file explorer)
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type === "image/png" || file.type === "application/json") {
          e.preventDefault();
          processFile(file);
          return;
        }
      }

      // 2. Check for Text (JSON)
      const text = e.clipboardData?.getData("text");
      if (text) {
        // Try to parse silently first
        try {
          const json = JSON.parse(text);
          // Simple heuristic: ComfyUI API JSON usually has keys like "3", "4" (node IDs) or "last_node_id"
          // Or is an array of nodes (standard web format).
          if (typeof json === "object" && json !== null) {
            e.preventDefault();
            processTextContent(text);
          }
        } catch (err) {
          // Not JSON, ignore regular copy-paste operations
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [processFile, processTextContent]);

  // Handle "Read from Clipboard" Button
  const handleReadClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      processTextContent(text);
    } catch (err) {
      setError("Failed to read from clipboard. Please use Ctrl+V instead.");
    }
  };

  // Copy Code Logic
  const handleCopyCode = async () => {
    if (!transpiledCode) return;
    await navigator.clipboard.writeText(transpiledCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // --- Render ---

  return (
    <div className="app-container" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="logo-icon">C</span>
          <h1>ComfyUI Transpiler</h1>
        </div>

        <div className="nav-actions">
          {fileName && (
            <div className="file-badge">
              <span>{fileName}</span>
            </div>
          )}

          <div className="button-group">
            <button onClick={open} className="btn btn-secondary">
              <IconUpload /> Upload File
            </button>
            <button onClick={handleReadClipboard} className="btn btn-primary">
              <IconClipboard /> Paste JSON
            </button>
          </div>
        </div>
      </nav>

      {/* Status Bar / Error Area */}
      {error && (
        <div className="status-bar error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {isLoading && (
        <div className="status-bar loading">
          <span className="spinner"></span> Processing workflow...
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        {!workflowJson ? (
          // Empty State
          <div className={`empty-state ${isDragActive ? "active" : ""}`}>
            <div className="empty-state-content">
              <div className="icon-wrapper">
                <IconFile />
              </div>
              <h2>Start Transpiling</h2>
              <p>
                Drag & drop a ComfyUI <b>.json</b> or <b>.png</b> file here
              </p>
              <div className="divider">OR</div>
              <div className="actions">
                <button onClick={open} className="btn btn-outline">
                  Select File
                </button>
                <p className="hint">You can also paste (Ctrl+V) directly!</p>
              </div>
            </div>
          </div>
        ) : (
          // Editors View
          <div className="split-view">
            {/* Left: Input JSON */}
            <div className="panel">
              <div className="panel-header">
                <span>Workflow JSON</span>
                <span className="badge">Read-only</span>
              </div>
              <div className="editor-container">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={JSON.stringify(workflowJson, null, 2)}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                  theme="vs-dark"
                />
              </div>
            </div>

            {/* Right: Output Code */}
            <div className="panel">
              <div className="panel-header">
                <span>Transpiled Client Code</span>
                <button
                  className={`btn-icon ${copySuccess ? "success" : ""}`}
                  onClick={handleCopyCode}
                  title="Copy to clipboard"
                >
                  {copySuccess ? <IconCheck /> : <IconCopy />}
                  {copySuccess ? " Copied" : " Copy"}
                </button>
              </div>
              <div className="editor-container">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  value={transpiledCode}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                  theme="vs-dark"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Powered by{" "}
          <a
            href="https://github.com/StableCanvas/comfyui-client/"
            target="_blank"
            rel="noreferrer"
          >
            @stable-canvas/comfyui-client
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
