export default function EmptyState({ icon = '◇', title = 'Nothing here yet', text = 'Create your first record to begin.' }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}
