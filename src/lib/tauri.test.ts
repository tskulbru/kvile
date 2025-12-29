import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  isTauriAvailable,
  sendRequest,
  parseHttpFile,
  readFile,
  writeFile,
  listHttpFiles,
} from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("tauri.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isTauriAvailable", () => {
    it("returns true when __TAURI_INTERNALS__ exists", () => {
      expect(isTauriAvailable()).toBe(true);
    });

    it("returns false when __TAURI_INTERNALS__ does not exist", () => {
      const win = window as unknown as Record<string, unknown>;
      const original = win.__TAURI_INTERNALS__;
      delete win.__TAURI_INTERNALS__;
      expect(isTauriAvailable()).toBe(false);
      win.__TAURI_INTERNALS__ = original;
    });
  });

  describe("sendRequest", () => {
    it("calls invoke with correct command and args", async () => {
      const mockResponse = {
        status: 200,
        status_text: "OK",
        headers: {},
        body: "test",
        time: 100,
        size: 4,
      };
      vi.mocked(invoke).mockResolvedValue(mockResponse);

      const request = {
        method: "GET",
        url: "https://example.com",
        headers: {},
      };

      const result = await sendRequest(request);

      expect(invoke).toHaveBeenCalledWith("send_request", { request });
      expect(result).toEqual(mockResponse);
    });

    it("throws error on failure", async () => {
      vi.mocked(invoke).mockRejectedValue("Network error");

      const request = {
        method: "GET",
        url: "https://example.com",
        headers: {},
      };

      await expect(sendRequest(request)).rejects.toThrow("Network error");
    });
  });

  describe("parseHttpFile", () => {
    it("calls invoke with correct command and args", async () => {
      const mockParsed = [
        {
          method: "GET",
          url: "https://example.com",
          headers: {},
          line_number: 1,
          variables: {},
          metadata: {},
        },
      ];
      vi.mocked(invoke).mockResolvedValue(mockParsed);

      const content = "GET https://example.com";
      const result = await parseHttpFile(content);

      expect(invoke).toHaveBeenCalledWith("parse_http_file", { content });
      expect(result).toEqual(mockParsed);
    });
  });

  describe("readFile", () => {
    it("calls invoke with correct command and args", async () => {
      vi.mocked(invoke).mockResolvedValue("file content");

      const result = await readFile("/path/to/file.http");

      expect(invoke).toHaveBeenCalledWith("read_file", { path: "/path/to/file.http" });
      expect(result).toBe("file content");
    });

    it("throws error on failure", async () => {
      vi.mocked(invoke).mockRejectedValue("File not found");

      await expect(readFile("/nonexistent")).rejects.toThrow("File not found");
    });
  });

  describe("writeFile", () => {
    it("calls invoke with correct command and args", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await writeFile("/path/to/file.http", "new content");

      expect(invoke).toHaveBeenCalledWith("write_file", {
        path: "/path/to/file.http",
        content: "new content",
      });
    });
  });

  describe("listHttpFiles", () => {
    it("calls invoke with correct command and args", async () => {
      const mockFiles = [
        { path: "/dir/test.http", name: "test.http", is_http_file: true },
      ];
      vi.mocked(invoke).mockResolvedValue(mockFiles);

      const result = await listHttpFiles("/dir");

      expect(invoke).toHaveBeenCalledWith("list_http_files", { directory: "/dir" });
      expect(result).toEqual(mockFiles);
    });
  });
});
