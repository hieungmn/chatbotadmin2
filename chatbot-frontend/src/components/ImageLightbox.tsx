import { useEffect, useCallback } from 'react';

interface ImageLightboxProps {
    images: string[];
    index: number;
    onClose: () => void;
    onIndexChange: (newIndex: number) => void;
}

/**
 * Xem ảnh phóng to TẠI CHỖ (không mở tab mới) — có nút chuyển ảnh trái/phải
 * khi có nhiều ảnh, kèm số đếm "2/5". Dùng chung cho: ảnh trong khung chat,
 * ảnh FAQ trong màn sửa, ảnh chunk trong màn "詳細を見る".
 */
export default function ImageLightbox({ images, index, onClose, onIndexChange }: ImageLightboxProps) {
    const goPrev = useCallback(() => {
        onIndexChange((index - 1 + images.length) % images.length);
    }, [index, images.length, onIndexChange]);

    const goNext = useCallback(() => {
        onIndexChange((index + 1) % images.length);
    }, [index, images.length, onIndexChange]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && images.length > 1) goPrev();
            if (e.key === 'ArrowRight' && images.length > 1) goNext();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, goPrev, goNext, images.length]);

    if (images.length === 0) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.82)', zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="閉じる"
                style={{
                    position: 'absolute', top: 16, right: 20, width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 18,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                ✕
            </button>

            {images.length > 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    aria-label="前の画像"
                    style={{
                        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                        width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                        border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    ‹
                </button>
            )}

            <img
                src={images[index]}
                alt=""
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '88vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 6 }}
            />

            {images.length > 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    aria-label="次の画像"
                    style={{
                        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                        width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                        border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    ›
                </button>
            )}

            {images.length > 1 && (
                <div style={{
                    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 12.5,
                    padding: '4px 12px', borderRadius: 12,
                }}>
                    {index + 1} / {images.length}
                </div>
            )}
        </div>
    );
}
