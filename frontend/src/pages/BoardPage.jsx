import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ChevronDown, MessageCircle, MoreHorizontal, Plus, Settings2, Star, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import CardModal from '../components/CardModal.jsx';
import Modal from '../components/Modal.jsx';
import { ActivityModal, MembersModal } from '../components/WorkspaceModals.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export default function BoardPage() {
  const { boardId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [modal, setModal] = useState(null);
  const [newList, setNewList] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [cardDrafts, setCardDrafts] = useState({});
  const [error, setError] = useState('');
  const [boardForm, setBoardForm] = useState({ name: '', description: '', color: '#7259ee' });
  const [listTitle, setListTitle] = useState('');

  const load = async () => {
    try { setError(''); const board = await api(`/boards/${boardId}`); setData(board); const ws = await api(`/workspaces/${board.board.workspace_id}`); setWorkspace(ws); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [boardId]);
  if (!data || !workspace) return <div className="boot">{error || 'Loading board…'}</div>;
  const canEdit = ['owner', 'admin', 'member'].includes(data.board.role);
  const canAdmin = ['owner', 'admin'].includes(data.board.role);

  async function addList(event) {
    event.preventDefault(); if (!newList.trim()) return;
    try { await api(`/boards/${boardId}/lists`, { method: 'POST', body: { title: newList } }); setNewList(''); setAddingList(false); load(); } catch (e) { setError(e.message); }
  }
  async function addCard(event, listId) {
    event.preventDefault(); const title = cardDrafts[listId]; if (!title?.trim()) return;
    try { await api(`/boards/lists/${listId}/cards`, { method: 'POST', body: { title } }); setCardDrafts({ ...cardDrafts, [listId]: '' }); load(); } catch (e) { setError(e.message); }
  }
  async function dropCard(event, listId) {
    event.preventDefault(); if (!canEdit) return;
    const cardId = event.dataTransfer.getData('text/card-id'); if (!cardId) return;
    try { await api(`/boards/cards/${cardId}`, { method: 'PATCH', body: { listId, position: Date.now() } }); load(); } catch (e) { setError(e.message); }
  }
  async function toggleComplete(event, card) {
    event.stopPropagation(); if (!canEdit) return;
    try { await api(`/boards/cards/${card.id}`, { method: 'PATCH', body: { completed: !card.completed } }); load(); } catch (e) { setError(e.message); }
  }
  async function toggleStar() {
    if (!canEdit) return;
    await api(`/boards/${boardId}`, { method: 'PATCH', body: { isStarred: !data.board.is_starred } }); load();
  }

  function openBoardSettings() {
    setBoardForm({ name: data.board.name, description: data.board.description || '', color: data.board.color });
    setModal('board-settings');
  }
  async function saveBoard(event) {
    event.preventDefault();
    try { await api(`/boards/${boardId}`, { method: 'PATCH', body: boardForm }); setModal(null); await load(); }
    catch (e) { setError(e.message); }
  }
  async function archiveBoard() {
    if (!confirm('Archive this board? It will be hidden from the active boards page.')) return;
    try { await api(`/boards/${boardId}`, { method: 'PATCH', body: { archived: true } }); navigate('/'); }
    catch (e) { setError(e.message); }
  }
  async function deleteBoard() {
    if (!confirm(`Permanently delete “${data.board.name}” and all of its cards?`)) return;
    try { await api(`/boards/${boardId}`, { method: 'DELETE' }); navigate('/'); }
    catch (e) { setError(e.message); }
  }
  function openListSettings(list) {
    setListTitle(list.title); setModal({ type: 'list', list });
  }
  async function saveList(event) {
    event.preventDefault();
    try { await api(`/boards/lists/${modal.list.id}`, { method: 'PATCH', body: { title: listTitle } }); setModal(null); await load(); }
    catch (e) { setError(e.message); }
  }
  async function deleteList() {
    if (!confirm(`Delete “${modal.list.title}” and every card in it?`)) return;
    try { await api(`/boards/lists/${modal.list.id}`, { method: 'DELETE' }); setModal(null); await load(); }
    catch (e) { setError(e.message); }
  }

  const selectedCard = modal && typeof modal === 'object' && modal.type === 'card' ? modal.card : null;
  return <div className="board-page" style={{ '--board-accent': data.board.color }}>
    <header className="board-topbar"><Link className="brand" to="/"><span className="brand-mark">O</span><span>orbit</span></Link><div className="board-breadcrumb"><Link to="/"><ArrowLeft size={16} />Boards</Link><i>/</i><strong>{data.board.name}</strong></div><div className="board-top-actions">{canEdit && <button className="icon-button" onClick={openBoardSettings} aria-label="Board settings" title="Board settings"><Settings2 size={18} /></button>}<Avatar person={session.user} size="sm" /></div></header>
    <div className="board-header"><div className="board-heading"><div className="board-dot"></div><div><h1>{data.board.name}</h1><p>{data.board.description}</p></div>{canEdit && <button className={`star-button plain ${data.board.is_starred ? 'starred' : ''}`} aria-label={data.board.is_starred ? 'Unstar board' : 'Star board'} onClick={toggleStar}><Star size={19} fill={data.board.is_starred ? 'currentColor' : 'none'} /></button>}</div><div className="board-toolbar"><div className="avatar-stack">{data.members.slice(0, 4).map((member) => <Avatar key={member.id} person={member} size="sm" />)}{data.members.length > 4 && <span>+{data.members.length - 4}</span>}</div><button className="secondary-button" onClick={() => setModal('members')}><Users size={17} />{canAdmin ? 'Share' : 'Members'}</button></div></div>
    {data.board.role === 'guest' && <div className="guest-banner">You're viewing this board as a guest. You can open cards and join conversations.</div>}
    {error && <div className="board-error">{error}</div>}
    <div className="kanban-scroll"><div className="kanban-board">
      {data.lists.map((list) => <section className="list-column" key={list.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropCard(e, list.id)}>
        <div className="list-header"><div><span className="list-dot"></span><h2>{list.title}</h2><b>{list.cards.length}</b></div>{canEdit && <button className="icon-button" onClick={() => openListSettings(list)} aria-label={`Edit ${list.title}`} title="List settings"><MoreHorizontal size={18} /></button>}</div>
        <div className="card-list">
          {list.cards.map((card) => { const assignee = data.members.find((member) => member.id === card.assignee_id); return <article className={`task-card ${card.completed ? 'is-complete' : ''}`} key={card.id} draggable={canEdit} onDragStart={(e) => { e.dataTransfer.setData('text/card-id', card.id); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => setModal({ type: 'card', card })}>
            <div className="task-labels">{card.labels?.map((label, index) => <span key={index} style={{ '--label-color': label.color }}>{label.name}</span>)}</div>
            <div className="task-title"><button className="check-button" disabled={!canEdit} aria-label={card.completed ? 'Mark incomplete' : 'Mark complete'} onClick={(e) => toggleComplete(e, card)}>{card.completed && <Check size={13} />}</button><h3>{card.title}</h3></div>
            {card.description && <p>{card.description}</p>}
            <div className="task-footer"><div>{card.due_date && <span className={new Date(card.due_date) < new Date() && !card.completed ? 'overdue' : ''}><CalendarDays size={14} />{new Date(card.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}{card.comment_count > 0 && <span><MessageCircle size={14} />{card.comment_count}</span>}</div>{assignee && <Avatar person={assignee} size="xs" />}</div>
          </article>; })}
        </div>
        {canEdit && <form className="quick-card" onSubmit={(e) => addCard(e, list.id)}>
          <Plus size={16} aria-hidden="true" />
          <input aria-label={`Add card to ${list.title}`} placeholder="Add a card…" value={cardDrafts[list.id] || ''} onChange={(e) => setCardDrafts({ ...cardDrafts, [list.id]: e.target.value })} />
          <button type="submit" disabled={!cardDrafts[list.id]?.trim()} aria-label={`Create card in ${list.title}`}>Add</button>
        </form>}
      </section>)}
      {canEdit && <section className="add-list-column">{addingList ? <form onSubmit={addList}><input autoFocus placeholder="List title" value={newList} onChange={(e) => setNewList(e.target.value)} /><div><button className="primary-button">Add list</button><button type="button" className="text-button" onClick={() => setAddingList(false)}>Cancel</button></div></form> : <button onClick={() => setAddingList(true)}><Plus size={18} />Add another list</button>}</section>}
    </div></div>
    <footer className="board-footer"><span><b>{data.lists.reduce((n, l) => n + l.cards.length, 0)}</b> total cards</span><span><b>{data.lists.reduce((n, l) => n + l.cards.filter((c) => c.completed).length, 0)}</b> complete</span><button onClick={() => setModal('activity')}>Activity <ChevronDown size={14} /></button></footer>
    {selectedCard && <CardModal card={selectedCard} lists={data.lists} members={data.members} canEdit={canEdit} onClose={() => setModal(null)} onChanged={load} onDeleted={load} />}
    {modal === 'board-settings' && <Modal title="Board settings" subtitle="Update how this board appears to your team." onClose={() => setModal(null)}><form className="stack-form" onSubmit={saveBoard}><label>Board name<input required autoFocus value={boardForm.name} onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })} /></label><label>Description<textarea rows="4" value={boardForm.description} onChange={(e) => setBoardForm({ ...boardForm, description: e.target.value })} /></label><label>Accent color<input type="color" value={boardForm.color} onChange={(e) => setBoardForm({ ...boardForm, color: e.target.value })} /></label><div className="settings-danger"><button type="button" className="secondary-button" onClick={archiveBoard}>Archive board</button>{canAdmin && <button type="button" className="delete-button" onClick={deleteBoard}>Delete permanently</button>}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button">Save board</button></div></form></Modal>}
    {modal?.type === 'list' && <Modal title="List settings" subtitle="Rename this stage or remove it from the board." onClose={() => setModal(null)}><form className="stack-form" onSubmit={saveList}><label>List title<input required autoFocus value={listTitle} onChange={(e) => setListTitle(e.target.value)} /></label><div className="settings-danger"><button type="button" className="delete-button" onClick={deleteList}>Delete list and cards</button></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button">Save list</button></div></form></Modal>}
    {modal === 'members' && <MembersModal workspace={workspace} boards={[data.board]} onClose={() => setModal(null)} />}
    {modal === 'activity' && <ActivityModal workspace={workspace} onClose={() => setModal(null)} />}
  </div>;
}
