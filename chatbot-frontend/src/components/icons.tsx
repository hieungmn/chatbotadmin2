type P = { size?: number; className?: string };
const base = (size = 16) => ({
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export const IconDoc = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></svg>
);
export const IconUpload = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
);
export const IconBrain = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5.6V15a3 3 0 0 0 3 3h1" /><path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 1 5.6V15a3 3 0 0 1-3 3h-1" /><path d="M9 4v16M15 4v16" /></svg>
);
export const IconGlobe = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" /></svg>
);
export const IconUsers = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /><circle cx="17" cy="8" r="2.5" /><path d="M16 14.2c2.7.5 5 2.5 5 5.8" /></svg>
);
export const IconLogout = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
);
export const IconChevronDown = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconMenu = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconClose = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const IconRefresh = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
);
export const IconTrash = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>
);
export const IconPlus = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMessage = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
export const IconShield = ({ size, className }: P) => (
    <svg {...base(size)} className={className}><path d="M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3Z" /></svg>
);
