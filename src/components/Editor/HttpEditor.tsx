import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRef, useEffect, useCallback } from "react";
import type { editor, IDisposable } from "monaco-editor";
import { extractInlineVariables } from "@/lib/variables";
import { getDynamicVariablesList, resolveDynamicVariable } from "@/lib/dynamic-variables";

interface HttpEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export function HttpEditor({ value, onChange }: HttpEditorProps) {
  const { setCursorLine, navigateToLine, setNavigateToLine, getCurrentVariables } = useAppStore();
  const {
    fontSize,
    fontFamily,
    tabSize,
    wordWrap,
    lineNumbers,
    minimap,
    showVariableHints,
    getResolvedTheme,
  } = useSettingsStore();
  const isDarkMode = getResolvedTheme() === 'dark';
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const hoverProviderRef = useRef<IDisposable | null>(null);
  const completionProviderRef = useRef<IDisposable | null>(null);
  const cursorListenerRef = useRef<IDisposable | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  // Build combined variables for hover preview
  const getResolvedVariables = useCallback(() => {
    const envVariables = getCurrentVariables();
    const inlineVariables = extractInlineVariables(value);
    return { ...envVariables, ...inlineVariables };
  }, [getCurrentVariables, value]);

  // Handle navigation requests from the outline
  useEffect(() => {
    if (navigateToLine !== null && editorRef.current) {
      editorRef.current.revealLineInCenter(navigateToLine);
      editorRef.current.setPosition({ lineNumber: navigateToLine, column: 1 });
      editorRef.current.focus();
      setNavigateToLine(null); // Clear the navigation request
    }
  }, [navigateToLine, setNavigateToLine]);

  // Define themes before the editor mounts
  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    // Define Night Owl dark theme colors
    monaco.editor.defineTheme("kvile-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment.separator", foreground: "637777", fontStyle: "bold italic" },
        { token: "comment", foreground: "637777", fontStyle: "italic" },
        { token: "keyword.method", foreground: "c792ea", fontStyle: "bold" },
        { token: "keyword.version", foreground: "c792ea" },
        { token: "keyword", foreground: "c792ea" },
        { token: "variable", foreground: "addb67" },
        { token: "variable.dynamic", foreground: "7fdbca", fontStyle: "italic" },
        { token: "variable.definition", foreground: "82aaff" },
        { token: "attribute.name", foreground: "7fdbca" },
        { token: "string.url", foreground: "82aaff" },
        { token: "string", foreground: "ecc48d" },
        { token: "number", foreground: "f78c6c" },
        { token: "annotation", foreground: "c792ea", fontStyle: "italic" },
        { token: "delimiter.bracket", foreground: "d6deeb" },
      ],
      colors: {
        "editor.background": "#011627",
        "editor.foreground": "#d6deeb",
        "editor.lineHighlightBackground": "#0b253a",
        "editor.selectionBackground": "#1d3b53",
        "editorCursor.foreground": "#80a4c2",
        "editorLineNumber.foreground": "#4b6479",
        "editorLineNumber.activeForeground": "#c5e4fd",
      },
    });

    // Define Light Owl theme colors
    monaco.editor.defineTheme("kvile-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment.separator", foreground: "989fb1", fontStyle: "bold italic" },
        { token: "comment", foreground: "989fb1", fontStyle: "italic" },
        { token: "keyword.method", foreground: "994cc3", fontStyle: "bold" },
        { token: "keyword.version", foreground: "994cc3" },
        { token: "keyword", foreground: "994cc3" },
        { token: "variable", foreground: "4876d6" },
        { token: "variable.dynamic", foreground: "0c969b", fontStyle: "italic" },
        { token: "variable.definition", foreground: "4876d6" },
        { token: "attribute.name", foreground: "0c969b" },
        { token: "string.url", foreground: "4876d6" },
        { token: "string", foreground: "c96765" },
        { token: "number", foreground: "aa0982" },
        { token: "annotation", foreground: "994cc3", fontStyle: "italic" },
        { token: "delimiter.bracket", foreground: "403f53" },
      ],
      colors: {
        "editor.background": "#fbfbfb",
        "editor.foreground": "#403f53",
        "editor.lineHighlightBackground": "#f0f0f0",
        "editor.selectionBackground": "#e0e0e0",
        "editorCursor.foreground": "#90a7b2",
        "editorLineNumber.foreground": "#90a7b2",
        "editorLineNumber.activeForeground": "#403f53",
      },
    });

    // Register HTTP language
    monaco.languages.register({ id: "http" });

    // Define HTTP language tokens
    monaco.languages.setMonarchTokensProvider("http", {
      tokenizer: {
        root: [
          // Request separator
          [/^###.*$/, "comment.separator"],

          // Comments
          [/^#.*$/, "comment"],
          [/^\/\/.*$/, "comment"],

          // HTTP Methods
          [
            /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s/,
            "keyword.method",
          ],

          // HTTP Version
          [/HTTP\/[\d.]+/, "keyword.version"],

          // Dynamic variables (with $)
          [/\{\{\$[\w.-]+(?:\s+[\w.-]+)*\}\}/, "variable.dynamic"],

          // Regular variables
          [/\{\{[\w.-]+\}\}/, "variable"],

          // Variable definitions (VS Code style)
          [/^@[\w-]+=/, "variable.definition"],

          // Headers
          [/^[\w-]+:/, "attribute.name"],

          // URLs
          [/https?:\/\/[^\s]+/, "string.url"],

          // JSON keys
          [/"[\w-]+"(?=\s*:)/, "attribute.name"],

          // Strings
          [/"[^"]*"/, "string"],

          // Numbers
          [/\b\d+\b/, "number"],

          // Boolean
          [/\b(true|false|null)\b/, "keyword"],

          // Directives (Kulala style)
          [/^#\s*@[\w-]+/, "annotation"],

          // Response handlers
          [/^>\s*\{%/, "delimiter.bracket"],
          [/%\}/, "delimiter.bracket"],

          // File includes
          [/^<\s+/, "keyword"],
          [/^<>\s+/, "keyword"],
        ],
      },
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position changes (store disposable for cleanup)
    cursorListenerRef.current = editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber);
    });

    // Store monaco reference for hover provider updates
    monacoRef.current = monaco;

    // Register hover provider for variable preview
    registerHoverProvider(monaco);

    // Register completion provider for dynamic variables
    registerCompletionProvider(monaco);
  };

  // Register hover provider that shows variable values
  const registerHoverProvider = useCallback((monaco: typeof import("monaco-editor")) => {
    // Dispose existing provider
    if (hoverProviderRef.current) {
      hoverProviderRef.current.dispose();
    }

    // Don't register hover provider if hints are disabled
    if (!showVariableHints) {
      return;
    }

    hoverProviderRef.current = monaco.languages.registerHoverProvider("http", {
      provideHover: (model, position) => {
        const line = model.getLineContent(position.lineNumber);
        // Match both regular and dynamic variables
        const varRegex = /\{\{(\$?[\w.-]+(?:\s+[\w.-]+)*)\}\}/g;

        let match;
        while ((match = varRegex.exec(line)) !== null) {
          const startCol = match.index + 1;
          const endCol = startCol + match[0].length;

          // Check if cursor is within this variable
          if (position.column >= startCol && position.column <= endCol) {
            const varContent = match[1];

            // Check if it's a dynamic variable
            if (varContent.startsWith("$")) {
              const parts = varContent.slice(1).split(/\s+/);
              const varName = parts[0];
              const args = parts.slice(1).join(" ") || undefined;
              const preview = resolveDynamicVariable(varName, args);

              if (preview !== null) {
                return {
                  range: {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: startCol,
                    endColumn: endCol,
                  },
                  contents: [
                    { value: `**Dynamic: \`$${varName}\`**` },
                    { value: `Preview: \`${preview}\`` },
                    { value: "_Regenerates on each request_" },
                  ],
                };
              }
            }

            // Regular variable
            const variables = getResolvedVariables();
            const varValue = variables[varContent];

            const contents = varValue !== undefined
              ? [
                  { value: `**\`${varContent}\`**` },
                  { value: `\`\`\`\n${varValue}\n\`\`\`` },
                ]
              : [
                  { value: `**\`${varContent}\`**` },
                  { value: "_Variable not defined_" },
                ];

            return {
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: startCol,
                endColumn: endCol,
              },
              contents,
            };
          }
        }

        return null;
      },
    });
  }, [getResolvedVariables, showVariableHints]);

  // Register completion provider for dynamic variables
  const registerCompletionProvider = useCallback((monaco: typeof import("monaco-editor")) => {
    // Dispose existing provider
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider("http", {
      triggerCharacters: ["$", "{"],
      provideCompletionItems: (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);

        // Check if we're inside {{ or just typed $
        const insideBraces = textBeforeCursor.match(/\{\{(\$[\w]*)?$/);
        const afterDollar = textBeforeCursor.match(/\{\{\$$/);

        if (!insideBraces && !afterDollar) {
          return { suggestions: [] };
        }

        // Calculate what to replace - if we're after {{$, we need to replace from there
        const replaceStart = insideBraces
          ? position.column - (insideBraces[1]?.length || 0)
          : position.column;

        const replaceRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: replaceStart,
          endColumn: position.column,
        };

        const dynamicVars = getDynamicVariablesList();
        const suggestions = dynamicVars.map((v) => ({
          label: v.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: v.name + "}}",
          detail: v.description,
          range: replaceRange,
          sortText: "0" + v.name, // Ensure these appear first
        }));

        return { suggestions };
      },
    });
  }, []);

  // Update hover provider when variables change
  useEffect(() => {
    if (monacoRef.current) {
      registerHoverProvider(monacoRef.current);
    }
  }, [registerHoverProvider]);

  // Cleanup providers and listeners on unmount
  useEffect(() => {
    return () => {
      if (hoverProviderRef.current) {
        hoverProviderRef.current.dispose();
      }
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
      if (cursorListenerRef.current) {
        cursorListenerRef.current.dispose();
      }
    };
  }, []);

  return (
    <Editor
      height="100%"
      defaultLanguage="http"
      value={value}
      onChange={onChange}
      beforeMount={handleEditorBeforeMount}
      onMount={handleEditorMount}
      theme={isDarkMode ? "kvile-dark" : "kvile-light"}
      options={{
        minimap: { enabled: minimap },
        fontSize,
        fontFamily,
        lineNumbers,
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        wordWrap,
        automaticLayout: true,
        padding: { top: 8 },
        tabSize,
        insertSpaces: true,
        folding: true,
        foldingStrategy: "indentation",
        showFoldingControls: "mouseover",
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
