import React from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export default function Badge({ tone, children, dot = true }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
    return (
        <span className={`badge badge-${tone}`}>
            {dot && <span className="badge-dot" />}
            {children}
        </span>
    );
}
