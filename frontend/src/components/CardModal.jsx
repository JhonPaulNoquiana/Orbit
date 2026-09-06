import { useEffect, useState } from 'react';
import { AlignLeft, CalendarDays, Check, MessageCircle, Trash2, UserRound } from 'lucide-react';
import { api } from '../services/api.js';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

const LABEL_COLORS = ['#7259ee', '#0ea5a0', '#e36b52', '#3487eb', '#d14f8b'];

export default function CardModal({ card, lists, members, canEdit, onClose, onChanged, onDeleted }) {
  const [form, setForm] = useState({ title: card.title, description: card.description || '', priority: card.priority, dueDate: card.due_date?.slice(0, 10) || '', assigneeId: card.assignee_id || '', listId: lists.find((l) => l.cards.some((c) => c.id === card.id))?.id || '', completed: card.completed });
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [labelName, setLabelName] = useState('');
  const [labels, setLabels] = useState(card.labels || []);
  const [error, setError] = useState('');
  useEffect(() => { api(`/boards/cards/${card.id}/comments`).then(setComments); }, [card.id]);

  async function save(event) {
    event.preventDefault();
    try { await api(`/boards/cards/${card.id}`, { method: 'PATCH', body: { ...form, dueDate: form.dueDate || null, assigneeId: form.assigneeId || null, labels } }); onChanged(); onClose(); }
    catch (e) { setError(e.message); }
  }
  async function addComment(event) {
    event.preventDefault(); if (!comment.trim()) return;
    try { const value = await api(`/boards/cards/${card.id}/comments`, { method: 'POST', body: { body: comment } }); setComments([...comments, value]); setComment(''); }
    catch (e) { setError(e.message); }
  }
  async function remove() {
    if (!confirm('Delete this card? This cannot be undone.')) return;
    try { await api(`/boards/cards/${card.id}`, { method: 'DELETE' }); onDeleted(); onClose(); } catch (e) { setError(e.message); }
  }
  function addLabel() {
    if (!labelName.trim()) return;
    setLabels([...labels, { name: labelName.trim(), color: LABEL_COLORS[labels.length % LABEL_COLORS.length] }]); setLabelName('');
  }

  return <Modal title={canEdit ? 'Card details' : 'Card preview'} subtitle={canEdit ? 'Add the context your team needs to move.' : 'Guests can view and join the conversation.'} onClose={onClose} wide>
    <form className="card-detail-grid" onSubmit={save}>
      <div className="card-main-fields">
        <label>Card title<input disabled={!canEdit} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label><span className="label-icon"><AlignLeft size={16} />Description</span><textarea disabled={!canEdit} rows="6" placeholder="Add details, links, or acceptance criteria…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="labels-editor"><label>Labels</label><div className="label-list">{labels.map((label, index) => <button type="button" disabled={!canEdit} key={`${label.name}-${index}`} style={{ '--label-color': label.color }} onClick={() => canEdit && setLabels(labels.filter((_, i) => i !== index))}>{label.name}{canEdit && ' ×'}</button>)}</div>{canEdit && <div className="inline-add"><input placeholder="New label" value={labelName} onChange={(e) => setLabelName(e.target.value)} /><button type="button" onClick={addLabel}>Add</button></div>}</div>
        <div className="comments"><h3><MessageCircle size={17} />Conversation</h3><div className="comment-list">{comments.map((item) => <div className="comment" key={item.id}><Avatar person={{ name: item.user_name, avatar_color: item.avatar_color }} size="sm" /><div><p><strong>{item.user_name}</strong><time>{new Date(item.created_at).toLocaleDateString()}</time></p><div>{item.body}</div></div></div>)}</div><div className="comment-compose"><input placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addComment(e); }} /><button type="button" disabled={!comment.trim()} onClick={addComment}>Send</button></div></div>
      </div>
      <aside className="card-side-fields">
        <label><span className="label-icon"><UserRound size={15} />Assignee</span><select disabled={!canEdit} value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}><option value="">Unassigned</option>{members.filter((m) => m.role !== 'guest').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Priority<select disabled={!canEdit} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label><span className="label-icon"><CalendarDays size={15} />Due date</span><input disabled={!canEdit} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
        <label>List<select disabled={!canEdit} value={form.listId} onChange={(e) => setForm({ ...form, listId: e.target.value })}>{lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
        <label className="complete-toggle"><input disabled={!canEdit} type="checkbox" checked={form.completed} onChange={(e) => setForm({ ...form, completed: e.target.checked })} /><span><Check size={15} /></span>Mark complete</label>
        {error && <div className="form-error">{error}</div>}
        {canEdit && <><button className="primary-button save-card">Save changes</button><button type="button" className="delete-button" onClick={remove}><Trash2 size={16} />Delete card</button></>}
      </aside>
    </form>
  </Modal>;
}
