import path from "path";
import { fileURLToPath } from "url";

// Detect pkg environment: import.meta.url throws in pkg-compiled binaries.
// When running as .exe, we must set CWD to the exe directory so that
// native modules (better-sqlite3) can be found by the bindings package.
try {
  fileURLToPath(import.meta.url);
} catch {
  process.chdir(path.dirname(process.execPath));
}
