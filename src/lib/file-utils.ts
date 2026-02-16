import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, isTauriAvailable } from "@/lib/tauri";

const STARTER_TEMPLATE = `### My Request
GET https://httpbin.org/get
`;

/**
 * Open a save dialog for creating a new .http file, write the starter template,
 * and return the path. Returns null if the user cancels.
 */
export async function createHttpFile(
  workspacePath: string
): Promise<string | null> {
  if (!isTauriAvailable()) return null;

  const defaultPath = `${workspacePath}/requests.http`;

  const path = await save({
    defaultPath,
    title: "Create HTTP File",
    filters: [
      { name: "HTTP Files", extensions: ["http", "rest"] },
    ],
  });

  if (!path) return null;

  // Ensure the file has an .http or .rest extension
  const finalPath =
    path.endsWith(".http") || path.endsWith(".rest") ? path : `${path}.http`;

  await writeFile(finalPath, STARTER_TEMPLATE);

  return finalPath;
}
