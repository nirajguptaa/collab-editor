import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import styles from './DashboardPage.module.css';

const LANGUAGES = ['javascript','typescript','python','java','go','rust','cpp','html','sql'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);

  const [rooms, setRooms]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoom, setNewRoom]   = useState({ name: '', language: 'javascript', is_public: false });
  const [error, setError]       = useState('');

  useEffect(() => {
    api.get('/rooms')
      .then(({ data }) => setRooms(data.rooms))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/rooms', newRoom);
      navigate(`/room/${data.room.slug}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room.');
      setCreating(false);
    }
  }

  async function handleDelete(slug, e) {
    e.stopPropagation();
    if (!confirm('Delete this room? This cannot be undone.')) return;
    await api.delete(`/rooms/${slug}`);
    setRooms((prev) => prev.filter((r) => r.slug !== slug));
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60)   return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400)return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <span className={styles.logoIcon}>{'</>'}</span>
          <span className={styles.logoText}>CodeCollab</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.username}>@{user?.username}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero */}
        <div className={styles.hero}>
          <h1>Your rooms</h1>
          <button className={styles.createBtn} onClick={() => setShowModal(true)}>
            + New room
          </button>
        </div>

        {/* Room grid */}
        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : rooms.length === 0 ? (
          <div className={styles.empty}>
            <p>No rooms yet.</p>
            <button className={styles.createBtnSm} onClick={() => setShowModal(true)}>
              Create your first room →
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {rooms.map((room) => (
              <div
                key={room.id}
                className={styles.roomCard}
                onClick={() => navigate(`/room/${room.slug}`)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.roomLang}>{room.language}</span>
                  {room.is_public && <span className={styles.publicBadge}>public</span>}
                </div>
                <h3 className={styles.roomName}>{room.name}</h3>
                <div className={styles.cardMeta}>
                  <span>rev {room.revision ?? 0}</span>
                  <span>{timeAgo(room.updated_at)}</span>
                </div>
                <div className={styles.cardActions}>
                  <Link
                    to={`/room/${room.slug}`}
                    className={styles.openBtn}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open
                  </Link>
                  <button
                    className={styles.copyBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${location.origin}/room/${room.slug}`);
                    }}
                    title="Copy share link"
                  >
                    Copy link
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(room.slug, e)}
                    title="Delete room"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create room modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>New room</h2>
            <form onSubmit={handleCreate} className={styles.form}>
              <div className={styles.field}>
                <label>Room name</label>
                <input
                  autoFocus
                  placeholder="My awesome project"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Language</label>
                <select
                  value={newRoom.language}
                  onChange={(e) => setNewRoom({ ...newRoom, language: e.target.value })}
                >
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={newRoom.is_public}
                  onChange={(e) => setNewRoom({ ...newRoom, is_public: e.target.checked })}
                />
                Make room public (anyone with the link can view)
              </label>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.modalBtns}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={creating}>
                  {creating ? 'Creating…' : 'Create room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
