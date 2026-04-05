import { useState, useRef, useEffect } from 'react';
import styles from './OutputPanel.module.css';

export default function OutputPanel({ result, isRunning, onClose }) {
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result]);

  if (!result && !isRunning) return null;

  const hasError  = result?.exitCode !== 0 || result?.error;
  const hasOutput = result?.stdout?.trim();
  const hasStderr = result?.stderr?.trim();

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Output</span>
          {result && (
            <span className={`${styles.badge} ${hasError ? styles.badgeError : styles.badgeOk}`}>
              {hasError ? 'failed' : 'success'}
            </span>
          )}
          {result?.executionTime && (
            <span className={styles.time}>{result.executionTime}ms</span>
          )}
          {result?.ranBy && (
            <span className={styles.ranBy}>run by {result.ranBy}</span>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body} ref={outputRef}>
        {isRunning && (
          <div className={styles.running}>
            <span className={styles.spinner}></span>
            <span>Running...</span>
          </div>
        )}

        {result?.error && (
          <div className={styles.errorMsg}>{result.error}</div>
        )}

        {result?.stage === 'compilation' && hasStderr && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Compilation error</div>
            <pre className={styles.stderr}>{result.stderr}</pre>
          </div>
        )}

        {result?.stage !== 'compilation' && hasStderr && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Stderr</div>
            <pre className={styles.stderr}>{result.stderr}</pre>
          </div>
        )}

        {hasOutput ? (
          <div className={styles.section}>
            {hasStderr && <div className={styles.sectionLabel}>Stdout</div>}
            <pre className={styles.stdout}>{result.stdout}</pre>
          </div>
        ) : result && !isRunning && !hasError && !hasStderr ? (
          <div className={styles.empty}>Program exited with no output.</div>
        ) : null}

        {result && !hasOutput && !hasStderr && !result.error && !isRunning && (
          <div className={styles.empty}>No output.</div>
        )}
      </div>
    </div>
  );
}