export default function EmptyState({ title, desc }: { title: string; desc?: string }) {
    return (
        <div className="empty-state">
            <div className="empty-state-title">{title}</div>
            {desc && <div className="empty-state-desc">{desc}</div>}
        </div>
    );
}
