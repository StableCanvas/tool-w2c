import { useState, useCallback } from "react";
import { useDropzone, type FileWithPath } from "react-dropzone";
import { JsonReader, ImageReader, CWorkflow } from "@stable-canvas/cw-reader";
import { Transpiler } from "@stable-canvas/comfyui-client-transpiler"; // Assuming main is exported as Transpiler
import Editor from "@monaco-editor/react";
import "./App.css";

function App() {
  const [workflowJson, setWorkflowJson] = useState<CWorkflow | null>(null);
  const [transpiledCode, setTranspiledCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(async (file: FileWithPath) => {
    setIsLoading(true);
    setError(null);
    setWorkflowJson(null);
    setTranspiledCode("");
    setFileName(file.name);

    try {
      let reader;
      let workflow: CWorkflow;

      if (file.name.endsWith(".json")) {
        const fileContent = await file.text();
        const jsonData = JSON.parse(fileContent);
        reader = new JsonReader(jsonData);
        workflow = await reader.getWorkflow();
      } else if (file.name.endsWith(".png")) {
        const arrayBuffer = await file.arrayBuffer();
        // ImageReader expects Buffer, but ArrayBuffer should also work if library handles it
        // or you might need to convert it if it strictly requires Node.js Buffer.
        // For browser, ArrayBuffer is standard. Let's assume ImageReader can handle ArrayBuffer
        // or that cw-reader is smart enough for browser environments.
        // If not, a polyfill or conversion might be needed for Buffer.
        reader = new ImageReader(arrayBuffer);
        workflow = await reader.getWorkflow();
      } else {
        throw new Error(
          "Unsupported file type. Please upload a .json or .png file."
        );
      }

      setWorkflowJson(workflow); // Store the raw workflow object

      const transpiler = new Transpiler(workflow);
      const code = transpiler.toCode();
      setTranspiledCode(code);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(`Error processing file: ${err.message || "Unknown error"}`);
      setWorkflowJson(null);
      setTranspiledCode("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/json": [".json"],
      "image/png": [".png"],
    },
    multiple: false,
  });

  return (
    <div className="App">
      <header className="App-header">
        <h1>ComfyUI Workflow Transpiler</h1>
        <p>
          Upload or drag & drop a ComfyUI <code>.json</code> (API format) or{" "}
          <code>.png</code> workflow file.
        </p>
      </header>

      {workflowJson ? null : (
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? "active" : ""}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the file here ...</p>
          ) : (
            <p>Drag 'n' drop a file here, or click to select a file</p>
          )}
        </div>
      )}

      {isLoading && (
        <p className="status-text loading-text">Processing, please wait...</p>
      )}
      {error && <p className="status-text error-text">{error}</p>}
      {fileName && !isLoading && (
        <p className="status-text">
          Processed file: <strong>{fileName}</strong>
        </p>
      )}

      <div className="editors-container">
        {workflowJson && (
          <div className="editor-wrapper">
            <h2>Workflow Data (JSON)</h2>
            <Editor
              language="json"
              value={JSON.stringify(workflowJson, null, 2)}
              options={{ readOnly: true, minimap: { enabled: false } }}
              theme="vs-dark"
            />
          </div>
        )}

        {transpiledCode && (
          <div className="editor-wrapper">
            <h2>Transpiled Code (@stable-canvas/comfyui-client)</h2>
            <Editor
              language="typescript"
              value={transpiledCode}
              options={{ readOnly: true, minimap: { enabled: false } }}
              theme="vs-dark"
            />
          </div>
        )}
      </div>
      <footer>
        <p>
          Using{" "}
          <a
            href="https://www.npmjs.com/package/@stable-canvas/comfyui-client-transpiler"
            target="_blank"
            rel="noopener noreferrer"
          >
            @stable-canvas/comfyui-client-transpiler
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
