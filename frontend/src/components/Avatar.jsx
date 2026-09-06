export default function Avatar({ person, size = 'md', className = '' }) {
  const initials = person?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return <span className={`avatar avatar-${size} ${className}`} style={{ background: person?.avatar_color || person?.avatarColor || '#7259ee' }} title={person?.name}>{initials}</span>;
}
