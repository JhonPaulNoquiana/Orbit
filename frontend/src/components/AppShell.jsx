import { useEffect, useRef, useState } from 'react';
import { Activity, Bell, ChevronDown, LayoutDashboard, LogOut, Search, Settings, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Avatar from './Avatar.jsx';

export default function AppShell({ children, workspace, workspaces = [], onWorkspaceChange, onMembers, onActivity, onSettings, searchValue = '', onSearch }) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  useEffect(() => {
    function focusSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/"><span className="brand-mark">O</span><span>orbit</span></Link>
        {workspaces.length > 1 && onWorkspaceChange && <select className="mobile-workspace-select" aria-label="Switch workspace" value={workspace?.id || ''} onChange={(event) => onWorkspaceChange(event.target.value)}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <div className="search"><Search size={17} /><input ref={searchRef} value={searchValue} onChange={(event) => onSearch?.(event.target.value)} placeholder="Search boards…" /><kbd>Ctrl K</kbd></div>
        <div className="top-actions">
          <button className="icon-button" onClick={onActivity} aria-label="Open activity" title="Activity"><Bell size={19} /></button>
          <div className="profile-menu-wrap">
            <button className="profile-chip" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><Avatar person={session.user} size="sm" /><span>{session.user.name}</span><ChevronDown size={14} /></button>
            {profileOpen && <div className="profile-menu"><strong>{session.user.name}</strong><span>{session.user.email}</span><span className={`role-badge role-${workspace?.role}`}>{workspace?.role}</span><button onClick={logout}><LogOut size={15} />Log out</button></div>}
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <div className="workspace-switcher">
          <span className="workspace-logo">{workspace?.name?.[0] || 'W'}</span>
          <div><strong>{workspace?.name || 'Workspace'}</strong><span>{workspace?.role || ''} workspace</span></div>
          {workspaces.length > 1 && onWorkspaceChange ? <>
            <select className="workspace-select" aria-label="Switch workspace" title="Switch workspace" value={workspace?.id || ''} onChange={(event) => onWorkspaceChange(event.target.value)}>
              {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.role}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </> : <ChevronDown size={15} aria-hidden="true" />}
        </div>
        <nav>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}><LayoutDashboard size={19} />Boards</Link>
          <button onClick={onMembers}><Users size={19} />Members</button>
          <button onClick={onActivity}><Activity size={19} />Activity</button>
          {onSettings && <button onClick={onSettings}><Settings size={19} />Workspace settings</button>}
        </nav>
        <div className="sidebar-foot">
          <div className="tip-card"><span>✦</span><strong>A calmer way to ship.</strong><p>Keep work visible, ownership clear, and momentum steady.</p></div>
          <button className="logout" onClick={logout}><LogOut size={18} />Log out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
