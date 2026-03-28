import { useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../store/editor.store';
import { useSocket }      from '../../hooks/useSocket';
import styles from './CollabEditor.module.css';

const LANGUAGES = [
  'javascript','typescript','python','java','go','rust',
  'cpp','c','csharp','html','css','json','markdown','sql',
];

export default function CollabEditor({ roomId, slug }) {
  const monacoRef = useRef(null);
  const editorRef = useRef(null);
  const isRemote  = useRef(false);

  const language   = useEditorStore((s) => s.language);
  const users      = useEditorStore((s) => s.users);
  const isConnected= useEditorStore((s) => s.isConnected);
  const setLanguage= useEditorStore((s) => s.setLanguage);
  const content    = useEditorStore((s) => s.content);

  const { sendOp, sendCursor, sendLanguageChange } = useSocket(roomId, editorRef, isRemote);

  // Set initial content once after editor mounts and content loads (uncontrolled)
  const initialSet = useRef(false);
  useEffect(() => {
    if (!editorRef.current || !content || initialSet.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    isRemote.current = true;
    model.setValue(content);
    isRemote.current = false;
    initialSet.current = true;
  }, [content, editorRef.current]);

  // Local change → send op (only fires for real user input)
  const handleChange = useCallback((_value, ev) => {
    if (isRemote.current) return;

    for (const change of ev.changes) {
      const { rangeOffset, rangeLength, text } = change;

      if (text.length > 0 && rangeLength === 0) {
        sendOp({ type: 'insert', position: rangeOffset, chars: text });
      } else if (rangeLength > 0 && text.length === 0) {
        sendOp({ type: 'delete', position: rangeOffset, length: rangeLength });
      } else if (text.length > 0 && rangeLength > 0) {
        sendOp({ type: 'delete', position: rangeOffset, length: rangeLength });
        sendOp({ type: 'insert', position: rangeOffset, chars: text });
      }
    }
  }, [sendOp]);

  function handleCursorChange(ev) {
    if (!ev.position) return;
    sendCursor({ lineNumber: ev.position.lineNumber, column: ev.position.column });
  }

  function handleLanguageChange(lang) {
    setLanguage(lang);
    sendLanguageChange(lang);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.presence}>
          {users.map((u) => (
            <span key={u.userId} className={styles.avatar}
              style={{ background: u.color }} title={u.username}>
              {u.username[0].toUpperCase()}
            </span>
          ))}
        </div>
        <select className={styles.langSelect} value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className={`${styles.status} ${isConnected ? styles.online : styles.offline}`}>
          {isConnected ? '● live' : '○ connecting…'}
        </span>
      </div>

      <Editor
        height="calc(100vh - 48px)"
        defaultLanguage="javascript"
        language={language}
        defaultValue=""
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: '"JetBrains Mono", monospace',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'gutter',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          padding: { top: 16 },
        }}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          monacoRef.current = monaco;
        }}
        onChange={handleChange}
      />
    </div>
  );
}