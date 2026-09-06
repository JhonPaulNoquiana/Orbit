import { useEffect, useState } from 'react';
import { Clock3, Settings2, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { api } from '../services/api.js';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

const ROLE_COPY = {
  owner: 'Full control, including admins and workspace settings',
  admin: 'Manages boards, members, and workspace settings',
  member: 'Creates and edits boards, lists, and cards',
  guest: 'Views assigned boards and participates in comments',
};

export function MembersModal({ workspace, boards = [], onClose }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ email: '', role: 'member', boardIds: [] });
  const [error, setError] = useState('');
  const editingExisting = members.some((member) => member.email.toLowerCase() === form.email.trim().toLowerCase());
  const canManage = ['owner', 'admin'].includes(workspace.role);
  const load = () => api(`/workspaces/${workspace.id}/members`).then(setMembers).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [workspace.id]);

  async function add(event) {
    event.preventDefault(); setError('');
    try { await api(`/workspaces/${workspace.id}/members`, { method: 'POST', body: form }); setForm({ email: '', role: 'member', boardIds: [] }); load(); }
    catch (e) { setError(e.message); }
  }
  async function update(userId, role) {
    try { await api(`/workspaces/${workspace.id}/members/${userId}`, { method: 'PATCH', body: { role, boardIds: role === 'guest' ? boards.map((board) => board.id) : [] } }); load(); }
    catch (e) { setError(e.message); }
  }
  async function remove(userId) {
    if (!confirm('Remove this person from the workspace?')) return;
    try { await api(`/workspaces/${workspace.id}/members/${userId}`, { method: 'DELETE' }); load(); }
    catch (e) { setError(e.message); }
  }

  return <Modal title="People & permissions" subtitle={`${members.length} people in ${workspace.name}`} onClose={onClose} wide>
    {canManage && <form className="invite-row" onSubmit={add}>
      <div><label>Email address</label><input type="email" required placeholder="teammate@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><label>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, boardIds: [] })}><option value="member">Member</option><option value="guest">Guest</option>{workspace.role === 'owner' && <option value="admin">Admin</option>}</select></div>
      <button className="primary-button" disabled={form.role === 'guest' && form.boardIds.length === 0}><UserPlus size={17} />{editingExisting ? 'Update access' : 'Add person'}</button>
      {form.role === 'guest' && <div className="board-access-picker"><label>Board access</label>{boards.map((board) => <label key={board.id}><input type="checkbox" checked={form.boardIds.includes(board.id)} onChange={(e) => setForm({ ...form, boardIds: e.target.checked ? [...form.boardIds, board.id] : form.boardIds.filter((id) => id !== board.id) })} />{board.name}</label>)}</div>}
    </form>}
    {error && <div className="form-error">{error}</div>}
    <div className="member-list">
      {members.map((member) => <div className="member-row" key={member.id}>
        <Avatar person={member} /><div className="member-info"><strong>{member.name}</strong><span>{member.email}</span></div>
        <div className="role-explain"><ShieldCheck size={16} /><span>{member.role === 'guest' ? `${member.board_ids.length} assigned board${member.board_ids.length === 1 ? '' : 's'}` : ROLE_COPY[member.role]}</span></div>
        {canManage && member.role === 'guest' && <button className="icon-button" title="Change guest board access" aria-label={`Change board access for ${member.name}`} onClick={() => setForm({ email: member.email, role: 'guest', boardIds: member.board_ids })}><Settings2 size={16} /></button>}
        {canManage && member.role !== 'owner' ? <select className={`role-select role-${member.role}`} value={member.role} onChange={(e) => update(member.id, e.target.value)}><option value="guest">Guest</option><option value="member">Member</option>{workspace.role === 'owner' && <option value="admin">Admin</option>}</select> : <span className={`role-badge role-${member.role}`}>{member.role}</span>}
        {canManage && member.role !== 'owner' && !(workspace.role === 'admin' && member.role === 'admin') && <button className="icon-button danger" onClick={() => remove(member.id)}><Trash2 size={17} /></button>}
      </div>)}
    </div>
  </Modal>;
}

export function ActivityModal({ workspace, onClose }) {
  const [items, setItems] = useState([]);
  useEffect(() => { api(`/workspaces/${workspace.id}/activity`).then(setItems); }, [workspace.id]);
  return <Modal title="Workspace activity" subtitle="A live trail of progress across every board" onClose={onClose}>
    <div className="activity-list">
      {items.length === 0 && <div className="empty-state"><Clock3 /><h3>No activity yet</h3><p>Your team's updates will appear here.</p></div>}
      {items.map((item) => <div className="activity-item" key={item.id}><Avatar person={{ name: item.user_name, avatar_color: item.avatar_color }} size="sm" /><div><p><strong>{item.user_name || 'Former member'}</strong> {item.action} {item.entity_type} <b>{item.entity_name}</b></p><time>{new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div></div>)}
    </div>
  </Modal>;
}
