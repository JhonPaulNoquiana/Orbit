import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, LayoutGrid, Plus, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import Modal from '../components/Modal.jsx';
import { ActivityModal, MembersModal } from '../components/WorkspaceModals.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../services/api.js';

const COLORS = ['#7259ee', '#e36b52', '#0ea5a0', '#3487eb', '#d14f8b', '#3d405b'];

export default function WorkspacePage() {
  const { session, refresh } = useAuth();
  const [workspaceId, setWorkspaceId] = useState(() => localStorage.getItem('orbit_workspace_id') || session.workspaces[0]?.id);
  const workspace = session.workspaces.find((item) => item.id === workspaceId) || session.workspaces[0];
  const [boards, setBoards] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0] });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const load = () => api(`/boards/workspace/${workspace.id}`).then(setBoards).catch((e) => setError(e.message));
  useEffect(() => { refresh().catch(() => {}); }, []);
  useEffect(() => {
    if (workspace?.id) load();
  }, [workspace?.id]);
  const stats = useMemo(() => ({ cards: boards.reduce((sum, board) => sum + board.card_count, 0), done: boards.reduce((sum, board) => sum + board.completed_count, 0) }), [boards]);
  const canCreate = ['owner', 'admin', 'member'].includes(workspace.role);
  const canManageWorkspace = ['owner', 'admin'].includes(workspace.role);
  const filteredBoards = boards.filter((board) => `${board.name} ${board.description}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function createBoard(event) {
    event.preventDefault(); setError('');
    try { const board = await api(`/boards/workspace/${workspace.id}`, { method: 'POST', body: form }); navigate(`/boards/${board.id}`); }
    catch (e) { setError(e.message); }
  }
  async function toggleStar(event, board) {
    event.stopPropagation();
    try { await api(`/boards/${board.id}`, { method: 'PATCH', body: { isStarred: !board.is_starred } }); load(); } catch (e) { setError(e.message); }
  }

  async function updateWorkspace(event) {
    event.preventDefault(); setError('');
    try {
      await api(`/workspaces/${workspace.id}`, { method: 'PATCH', body: { name: form.name, description: form.description } });
      await refresh(); setModal(null);
    } catch (e) { setError(e.message); }
  }

  function changeWorkspace(id) {
    localStorage.setItem('orbit_workspace_id', id);
    setWorkspaceId(id);
    setModal(null);
    setError('');
  }

  return <AppShell workspace={workspace} workspaces={session.workspaces} onWorkspaceChange={changeWorkspace} onMembers={() => setModal('members')} onActivity={() => setModal('activity')} searchValue={search} onSearch={setSearch} onSettings={canManageWorkspace ? () => { setForm({ ...form, name: workspace.name, description: workspace.description || '' }); setModal('workspace'); } : null}>
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div><span className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {session.user.name.split(' ')[0]}.</h1><p>Here's where the work is moving today.</p></div>
        {canCreate && <button className="primary-button" onClick={() => { setForm({ name: '', description: '', color: COLORS[0] }); setModal('new'); }}><Plus size={18} />New board</button>}
      </section>
      <section className="stat-row">
        <div className="stat-card"><span className="stat-icon lavender"><LayoutGrid /></span><div><b>{boards.length}</b><span>Active boards</span></div></div>
        <div className="stat-card"><span className="stat-icon peach"><Clock3 /></span><div><b>{stats.cards - stats.done}</b><span>Open cards</span></div></div>
        <div className="stat-card"><span className="stat-icon mint"><CheckCircle2 /></span><div><b>{stats.done}</b><span>Completed</span></div></div>
      </section>
      <section className="boards-section">
        <div className="section-heading"><div><h2>{search ? 'Search results' : 'Your boards'}</h2><p>{workspace.name} · <span className={`role-badge role-${workspace.role}`}>{workspace.role}</span></p></div>{search && <button className="text-button" onClick={() => setSearch('')}>Clear search</button>}</div>
        {error && <div className="form-error">{error}</div>}
        <div className="board-grid">
          {filteredBoards.map((board, index) => {
            const total = board.card_count || 0; const percent = total ? Math.round((board.completed_count / total) * 100) : 0;
            return <article className="board-tile" key={board.id} onClick={() => navigate(`/boards/${board.id}`)}>
              <div className="board-cover" style={{ '--board-color': board.color }}><div className="cover-orb orb-one"></div><div className="cover-orb orb-two"></div><span>{String(index + 1).padStart(2, '0')}</span>{canCreate && <button className={`star-button ${board.is_starred ? 'starred' : ''}`} aria-label={board.is_starred ? 'Unstar board' : 'Star board'} onClick={(e) => toggleStar(e, board)}><Star size={18} fill={board.is_starred ? 'currentColor' : 'none'} /></button>}</div>
              <div className="board-body"><div className="board-title"><div><h3>{board.name}</h3><p>{board.description || 'A space for thoughtful work.'}</p></div></div><div className="progress-meta"><span>{board.completed_count} of {total} cards complete</span><b>{percent}%</b></div><div className="progress-track"><i style={{ width: `${percent}%`, background: board.color }}></i></div></div>
            </article>;
          })}
          {filteredBoards.length === 0 && (canCreate && !search ? <button className="new-board-tile" onClick={() => { setForm({ name: '', description: '', color: COLORS[0] }); setModal('new'); }}><span><Plus /></span><strong>Create your first board</strong><p>Give your team's next idea a place to grow.</p></button> : <div className="new-board-tile static"><strong>{search ? 'No matching boards' : 'No boards available'}</strong><p>{search ? 'Try a different search term.' : 'Ask a workspace member to create one.'}</p></div>)}
        </div>
      </section>
    </div>
    {modal === 'new' && <Modal title="Create a new board" subtitle="Start with a simple workflow and shape it as you go." onClose={() => setModal(null)}><form className="stack-form" onSubmit={createBoard}><label>Board name<input required autoFocus placeholder="e.g. Fall campaign" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Description<textarea rows="3" placeholder="What is this board for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Accent color</label><div className="color-picker">{COLORS.map((color) => <button type="button" key={color} className={form.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })}></button>)}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button">Create board</button></div></form></Modal>}
    {modal === 'workspace' && <Modal title="Workspace settings" subtitle="Keep your workspace easy to recognize." onClose={() => setModal(null)}><form className="stack-form" onSubmit={updateWorkspace}><label>Workspace name<input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Description<textarea rows="4" placeholder="What does your team work on?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button">Save workspace</button></div></form></Modal>}
    {modal === 'members' && <MembersModal workspace={workspace} boards={boards} onClose={() => setModal(null)} />}
    {modal === 'activity' && <ActivityModal workspace={workspace} onClose={() => setModal(null)} />}
  </AppShell>;
}
