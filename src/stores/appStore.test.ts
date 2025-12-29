import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "./appStore";
import * as tauri from "@/lib/tauri";

// Mock the tauri module
vi.mock("@/lib/tauri", () => ({
  listHttpFiles: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  sendRequest: vi.fn(),
  parseHttpFile: vi.fn().mockResolvedValue([]),
  startWatching: vi.fn().mockResolvedValue(undefined),
  stopWatching: vi.fn().mockResolvedValue(undefined),
  loadEnvironmentConfig: vi.fn().mockResolvedValue({ environments: [], shared: {} }),
}));

describe("appStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      openFiles: [],
      activeFileIndex: -1,
      fileTree: [],
      workspacePath: null,
      isLoadingFiles: false,
      isExecutingRequest: false,
      isSavingFile: false,
      isLoading: false,
      lastError: null,
      currentResponse: null,
      environmentConfig: null,
      activeEnvironment: "",
    });
    vi.clearAllMocks();
  });

  describe("loadWorkspace", () => {
    it("loads files and builds tree on success", async () => {
      const mockFiles = [
        { path: "/workspace/api/test.http", name: "test.http", is_http_file: true },
        { path: "/workspace/readme.md", name: "readme.md", is_http_file: false },
      ];
      vi.mocked(tauri.listHttpFiles).mockResolvedValue(mockFiles);

      await useAppStore.getState().loadWorkspace("/workspace");

      const state = useAppStore.getState();
      expect(state.workspacePath).toBe("/workspace");
      expect(state.fileTree.length).toBeGreaterThan(0);
      expect(state.isLoadingFiles).toBe(false);
      expect(state.lastError).toBeNull();
    });

    it("sets loading state while loading", async () => {
      vi.mocked(tauri.listHttpFiles).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const loadPromise = useAppStore.getState().loadWorkspace("/workspace");

      // Check loading state is set
      expect(useAppStore.getState().isLoadingFiles).toBe(true);

      await loadPromise;
      expect(useAppStore.getState().isLoadingFiles).toBe(false);
    });

    it("sets error on failure", async () => {
      vi.mocked(tauri.listHttpFiles).mockRejectedValue(new Error("Permission denied"));

      await useAppStore.getState().loadWorkspace("/workspace");

      const state = useAppStore.getState();
      expect(state.lastError).toBe("Permission denied");
      expect(state.isLoadingFiles).toBe(false);
    });
  });

  describe("loadFileFromPath", () => {
    it("loads file content and opens it", async () => {
      vi.mocked(tauri.readFile).mockResolvedValue("GET https://example.com");

      await useAppStore.getState().loadFileFromPath("/test.http", "test.http");

      const state = useAppStore.getState();
      expect(state.openFiles).toHaveLength(1);
      expect(state.openFiles[0].content).toBe("GET https://example.com");
      expect(state.openFiles[0].name).toBe("test.http");
      expect(state.activeFileIndex).toBe(0);
    });

    it("sets error on failure", async () => {
      vi.mocked(tauri.readFile).mockRejectedValue(new Error("File not found"));

      await useAppStore.getState().loadFileFromPath("/nonexistent.http", "nonexistent.http");

      const state = useAppStore.getState();
      expect(state.lastError).toBe("File not found");
      expect(state.openFiles).toHaveLength(0);
    });
  });

  describe("executeRequest", () => {
    it("sends request and stores response", async () => {
      const mockResponse = {
        status: 200,
        status_text: "OK",
        headers: { "content-type": "application/json" },
        body: '{"message": "Hello"}',
        time: 150,
        size: 20,
      };
      vi.mocked(tauri.sendRequest).mockResolvedValue(mockResponse);

      const request = {
        method: "GET",
        url: "https://example.com",
        headers: {},
      };

      await useAppStore.getState().executeRequest(request);

      const state = useAppStore.getState();
      expect(state.currentResponse).not.toBeNull();
      expect(state.currentResponse?.status).toBe(200);
      expect(state.currentResponse?.body).toBe('{"message": "Hello"}');
      expect(state.isExecutingRequest).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it("sets error on failure", async () => {
      vi.mocked(tauri.sendRequest).mockRejectedValue(new Error("Network error"));

      const request = {
        method: "GET",
        url: "https://example.com",
        headers: {},
      };

      await useAppStore.getState().executeRequest(request);

      const state = useAppStore.getState();
      expect(state.lastError).toBe("Network error");
      expect(state.isExecutingRequest).toBe(false);
    });
  });

  describe("saveCurrentFile", () => {
    it("saves modified file and clears modified flag", async () => {
      vi.mocked(tauri.writeFile).mockResolvedValue(undefined);

      // Set up a modified file
      useAppStore.setState({
        openFiles: [
          { path: "/test.http", name: "test.http", content: "updated content", modified: true, parsedRequests: [] },
        ],
        activeFileIndex: 0,
      });

      await useAppStore.getState().saveCurrentFile();

      const state = useAppStore.getState();
      expect(tauri.writeFile).toHaveBeenCalledWith("/test.http", "updated content");
      expect(state.openFiles[0].modified).toBe(false);
      expect(state.isSavingFile).toBe(false);
    });

    it("does nothing if no active file", async () => {
      await useAppStore.getState().saveCurrentFile();

      expect(tauri.writeFile).not.toHaveBeenCalled();
    });

    it("sets error on failure", async () => {
      vi.mocked(tauri.writeFile).mockRejectedValue(new Error("Write failed"));

      useAppStore.setState({
        openFiles: [
          { path: "/test.http", name: "test.http", content: "content", modified: true, parsedRequests: [] },
        ],
        activeFileIndex: 0,
      });

      await useAppStore.getState().saveCurrentFile();

      const state = useAppStore.getState();
      expect(state.lastError).toBe("Write failed");
    });
  });

  describe("clearError", () => {
    it("clears the last error", () => {
      useAppStore.setState({ lastError: "Some error" });

      useAppStore.getState().clearError();

      expect(useAppStore.getState().lastError).toBeNull();
    });
  });

  describe("closeWorkspace", () => {
    it("clears workspace state", () => {
      useAppStore.setState({
        workspacePath: "/some/path",
        fileTree: [{ name: "test", path: "/test", type: "file", isHttpFile: true }],
        openFiles: [{ path: "/test.http", name: "test.http", content: "GET /", modified: false, parsedRequests: [] }],
        activeFileIndex: 0,
        currentResponse: { status: 200, statusText: "OK", headers: {}, body: "", time: 0, size: 0, timestamp: new Date() },
      });

      useAppStore.getState().closeWorkspace();

      const state = useAppStore.getState();
      expect(state.workspacePath).toBeNull();
      expect(state.fileTree).toHaveLength(0);
      expect(state.openFiles).toHaveLength(0);
      expect(state.activeFileIndex).toBe(-1);
      expect(state.currentResponse).toBeNull();
    });
  });
});
