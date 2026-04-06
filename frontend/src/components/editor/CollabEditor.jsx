import { useRef, useEffect, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../store/editor.store';
import { useSocket }      from '../../hooks/useSocket';
import { api }            from '../../services/api';
import OutputPanel        from './OutputPanel';
import styles from './CollabEditor.module.css';

const LANGUAGES = [
  'javascript','typescript','python','java','go','rust',
  'cpp','c','csharp','html','css','json','markdown','sql',
];

const RUNNABLE = ['cpp', 'python', 'javascript'];

export default function CollabEditor({ roomId, slug }) {
  const monacoRef  = useRef(null);
  const editorRef  = useRef(null);
  const isRemote   = useRef(false);

  const language    = useEditorStore((s) => s.language);
  const users       = useEditorStore((s) => s.users);
  const isConnected = useEditorStore((s) => s.isConnected);
  const setLanguage = useEditorStore((s) => s.setLanguage);
  const content     = useEditorStore((s) => s.content);

  const [isRunning,    setIsRunning]    = useState(false);
  const [outputResult, setOutputResult] = useState(null);
  const [showOutput,   setShowOutput]   = useState(false);
  const [stdin,        setStdin]        = useState('');
  const [showStdin,    setShowStdin]    = useState(false);

  const { sendOp, sendCursor, sendLanguageChange } =
    useSocket(roomId, editorRef, isRemote, setOutputResult, setShowOutput);

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

  function handleLanguageChange(lang) {
    setLanguage(lang);
    sendLanguageChange(lang);
    // reset stdin when language changes
    setStdin('');
    setShowStdin(false);
  }

  async function handleRun() {
    const editor = editorRef.current;
    if (!editor) return;
    const code = editor.getValue();
    if (!code.trim()) return;

    setIsRunning(true);
    setShowOutput(true);
    setOutputResult(null);

    try {
      const { data } = await api.post(`/rooms/${slug}/execute`, {
        code,
        language,
        stdin,
      });
      setOutputResult(data);
    } catch (err) {
      setOutputResult({
        stdout:  '',
        stderr:  err.response?.data?.error || 'Execution failed.',
        exitCode: 1,
        executionTime: 0,
        error: null,
      });
    } finally {
      setIsRunning(false);
    }
  }

  const canRun = RUNNABLE.includes(language);

  // Calculate editor height based on what panels are open
  const stdinHeight  = showStdin  ? 110 : 0;
  const outputHeight = showOutput ? 220 : 0;
  const editorHeight = `calc(100vh - 48px - ${stdinHeight}px - ${outputHeight}px)`;

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
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

        {canRun && (
          <div className={styles.runGroup}>
            {/* Stdin toggle */}
            <button
              className={`${styles.stdinToggle} ${showStdin ? styles.stdinToggleActive : ''}`}
              onClick={() => setShowStdin((v) => !v)}
              title="Toggle stdin input"
            >
              stdin
            </button>

            {/* Run button */}
            <button
              className={`${styles.runBtn} ${isRunning ? styles.runBtnDisabled : ''}`}
              onClick={handleRun}
              disabled={isRunning}
              title={`Run ${language} code (Ctrl+Enter)`}
            >
              {isRunning
                ? <><span className={styles.runSpinner}></span> Running...</>
                : <>&#9654; Run</>
              }
            </button>
          </div>
        )}

        <span className={`${styles.status} ${isConnected ? styles.online : styles.offline}`}>
          {isConnected ? '● live' : '○ connecting…'}
        </span>
      </div>

      {/* Stdin panel */}
      {canRun && showStdin && (
        <div className={styles.stdinPanel}>
          <div className={styles.stdinHeader}>
            <span className={styles.stdinLabel}>stdin — program input</span>
            <button className={styles.stdinClear} onClick={() => setStdin('')}>clear</button>
          </div>
          <textarea
            className={styles.stdinArea}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Type input here. Each line = one line of input to your program..."
            spellCheck={false}
          />
        </div>
      )}

      {/* Editor */}
      <div className={styles.editorArea}>
        <Editor
          height={editorHeight}
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
            // Ctrl+Enter to run
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
              () => { if (canRun && !isRunning) handleRun(); }
            );
          }}
          onChange={handleChange}
        />

        <OutputPanel
          result={outputResult}
          isRunning={isRunning}
          onClose={() => setShowOutput(false)}
        />
      </div>
    </div>
  );
}