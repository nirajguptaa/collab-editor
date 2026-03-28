import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useEditorStore } from '../store/editor.store';
import CollabEditor from '../components/editor/CollabEditor';
import styles from './RoomPage.module.css';

export default function RoomPage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const setDocument = useEditorStore((s) => s.setDocument);
  const setLanguage = useEditorStore((s) => s.setLanguage);

  const [room, setRoom]       = useState(null);
  const [roomId, setRoomId]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    api.get(`/rooms/${slug}`)
      .then(({ data }) => {
        const r = data.room;
        setRoom(r);
        setRoomId(r.id);
        setDocument({ content: r.content, revision: r.revision });
        setLanguage(r.language);
      })
      .catch((err) => {
        if (err.response?.status === 403) setError('You don\'t have access to this room.');
        else if (err.response?.status === 404) setError('Room not found.');
        else setError('Failed to load room.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <p className={styles.loadingText}>Connecting to room…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.center}>
        <p className={styles.errorText}>{error}</p>
        <Link to="/" className={styles.backLink}>← Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* Top bar */}
      <header className={styles.topbar}>
        <Link to="/" className={styles.back} title="Back to dashboard">
          <span className={styles.logoIcon}>{'</>'}</span>
        </Link>

        <div className={styles.roomInfo}>
          <span className={styles.roomName}>{room.name}</span>
          <span className={styles.roomSlug}>/{slug}</span>
        </div>

        <button className={styles.shareBtn} onClick={copyLink}>
          {copied ? '✓ Copied!' : 'Share link'}
        </button>
      </header>

      {/* Editor fills remaining space */}
      <div className={styles.editorWrap}>
        {roomId && <CollabEditor roomId={roomId} slug={slug} />}
      </div>
    </div>
  );
}
