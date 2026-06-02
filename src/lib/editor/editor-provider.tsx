"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { Editor } from "./editor";

const EditorContext = createContext<Editor | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const editorRef = useRef<Editor | null>(null);
  if (!editorRef.current) {
    editorRef.current = new Editor();
  }

  return (
    <EditorContext.Provider value={editorRef.current}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return editor;
}
