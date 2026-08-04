export function BotIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <path
                d="M3 27c2-13 11-21 15-21s3 8-1 13c8-2 13 1 13 4s-6 3-11 3c6 3 9 7 7 9s-7-1-11-4c1 6-2 10-5 10s-6-5-4-11c-5 3-9 3-10 1s2-4 7-4z"
                fill="currentColor" opacity="0.45"
            />
            <circle cx="24" cy="25" r="13" fill="currentColor" />
            <circle cx="19.5" cy="24" r="2" fill="var(--cbw-accent-dark)" />
            <circle cx="28.5" cy="24" r="2" fill="var(--cbw-accent-dark)" />
            <path d="M19.5 29.5c1.8 1.6 5.2 1.6 7 0" stroke="var(--cbw-accent-dark)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
    );
}

export function StaffIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /><circle cx="17" cy="8" r="2.5" /><path d="M16 14.2c2.7.5 5 2.5 5 5.8" />
        </svg>
    );
}

export function SparkleIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
            <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" opacity="0.65" />
        </svg>
    );
}

export function ArrowIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
        </svg>
    );
}

export function ExpandIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
}

export function CompressIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
}

export function CloseIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

export function SendIcon() {
    return (<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 12 21 3l-5 18-5.2-7.3L2.5 12Z" /></svg>);
}

export function ThumbUpIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h11.6a2 2 0 0 0 2-1.6l1.3-6a2 2 0 0 0-2-2.4H14l1-4.4A1.8 1.8 0 0 0 13.3 2L7 11" />
        </svg>
    );
}

export function CopyIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );
}

export function CheckIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export function ThumbDownIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2v11M22 11V4a2 2 0 0 0-2-2H8.4a2 2 0 0 0-2 1.6l-1.3 6a2 2 0 0 0 2 2.4H10l-1 4.4A1.8 1.8 0 0 0 10.7 22L17 13" />
        </svg>
    );
}

