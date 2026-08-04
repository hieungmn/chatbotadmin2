export function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function mix(hex: string, target: [number, number, number], ratio: number): string {
    const [r, g, b] = hexToRgb(hex);
    const rr = Math.round(r + (target[0] - r) * ratio);
    const gg = Math.round(g + (target[1] - g) * ratio);
    const bb = Math.round(b + (target[2] - b) * ratio);
    return `rgb(${rr}, ${gg}, ${bb})`;
}

export const darken = (hex: string, ratio = 0.28) => mix(hex, [0, 0, 0], ratio);

export const lighten = (hex: string, ratio = 0.92) => mix(hex, [255, 255, 255], ratio);

export function hexToRgba(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
