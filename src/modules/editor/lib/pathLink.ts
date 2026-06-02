import { EditorView } from "@codemirror/view";
import { type Extension } from "@codemirror/state";

const PATH_REGEX = /(?:["'`])((?:\.{0,2}\/|~\/|@\/)[^\s"'`<>{}|\\^[\]]*\.[a-z]{1,10})(?:["'`])/gi;

type OpenFileFn = (path: string, pin: boolean) => void;
type GetDirFn = () => string;

export function pathLinkExtension(
  openFile: OpenFileFn,
  getDir: GetDirFn,
): Extension {
  return EditorView.domEventHandlers({
    click(event, view) {
      if (!event.ctrlKey && !event.metaKey) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      const relativePos = pos - line.from;
      let match: RegExpExecArray | null;
      PATH_REGEX.lastIndex = 0;
      while ((match = PATH_REGEX.exec(lineText)) !== null) {
        const start = match.index + 1;
        const end = start + match[1].length;
        if (relativePos >= start && relativePos <= end) {
          const rawPath = match[1];
          const pin = event.shiftKey;
          void resolveAndOpen(rawPath, getDir(), pin, openFile);
          event.preventDefault();
          return true;
        }
      }
      return false;
    },
  });
}

async function resolveAndOpen(
  rawPath: string,
  currentDir: string,
  pin: boolean,
  openFile: OpenFileFn,
): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  let resolved = rawPath;
  if (rawPath.startsWith("@/")) {
    resolved = rawPath.replace(/^@\//, `${currentDir}/src/`);
  } else if (rawPath.startsWith("~/")) {
    resolved = rawPath;
  } else if (!rawPath.startsWith("/")) {
    resolved = `${currentDir}/${rawPath}`;
  }
  try {
    const canonical = await invoke<string>("fs_canonicalize", { path: resolved });
    openFile(canonical, pin);
  } catch {
    // file not found -- no-op
  }
}
