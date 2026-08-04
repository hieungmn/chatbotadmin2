export const WIDGET_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap');

.cbw-root {
    font-family: "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic Medium", Meiryo, sans-serif;
    position: fixed; bottom: 20px; right: 20px; z-index: 999999;
    display: flex; flex-direction: column; align-items: flex-end; gap: 14px;
}
.cbw-launcher-row { display: flex; align-items: center; gap: 10px; }
.cbw-teaser {
    position: relative; background: var(--cbw-accent-soft); padding: 13px 18px;
    border-radius: 18px; box-shadow: 0 14px 32px var(--cbw-accent-shadow), 0 2px 8px rgba(20,33,61,0.06);
    max-width: 248px; font-size: 12.5px; line-height: 1.6; color: #1A1D24; cursor: pointer;
    animation: cbw-teaser-in 0.28s ease-out;
    border: none;
}
/* 吹き出しからアバターへ視線が繋がるよう、右側に小さな「しっぽ」を付ける */
.cbw-teaser::after {
    content: ''; position: absolute; right: -6px; bottom: 14px;
    width: 14px; height: 14px; background: var(--cbw-accent-soft);
    clip-path: polygon(0 0, 100% 50%, 0 100%); border-radius: 0 3px 0 0;
}
.cbw-teaser-close {
    position: absolute; top: -7px; right: -7px; width: 20px; height: 20px; border-radius: 50%;
    background: #fff; border: 1px solid #E2E4E9; color: #8B93A1; display: flex; align-items: center; justify-content: center;
    cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.12); z-index: 1;
}
@keyframes cbw-teaser-in { from { opacity: 0; transform: translateY(8px) scale(0.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
.cbw-launcher {
    width: 56px; height: 56px; padding: 0; margin: 0; box-sizing: border-box;
    border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(135deg, var(--cbw-accent) 0%, var(--cbw-accent-dark) 100%);
    color: #fff; display: flex; align-items: center; justify-content: center; position: relative; z-index: 0;
    box-shadow: 0 6px 18px var(--cbw-accent-shadow), 0 2px 6px rgba(20,33,61,0.16);
    transition: transform 0.15s ease, box-shadow 0.15s ease; overflow: hidden;
}
.cbw-launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 30px var(--cbw-accent-shadow), 0 3px 8px rgba(0,0,0,0.14); }
/* ボタンの背後に広がって消える「波紋」— 閉じている間、ずっと控えめに
   繰り返し、クリック可能であることをさりげなく知らせる演出。 */
.cbw-launcher-pulse {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid var(--cbw-accent); pointer-events: none;
    animation: cbw-pulse-ring 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.cbw-launcher-pulse.cbw-launcher-pulse-delay { animation-delay: 1.4s; }
@keyframes cbw-pulse-ring {
    0% { transform: scale(1); opacity: 0.55; }
    100% { transform: scale(1.6); opacity: 0; }
}
.cbw-launcher-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
/* 起動ボタンの周りに小さな泡がふわっと浮かんで消える、控えめな誘導演出。
   ボタン自体はoverflow:hiddenのため、泡は外側のラッパーに乗せて
   ボタンの外までクリップされずに浮かべるようにしている。 */
.cbw-launcher-wrap { position: relative; }
.cbw-bubble-particle {
    position: absolute; left: 28px; bottom: 6px; border-radius: 50%;
    background: var(--cbw-accent); pointer-events: none; opacity: 0;
    animation: cbw-float 4s ease-in-out infinite;
}
.cbw-bubble-particle:nth-child(1) { width: 7px; height: 7px; left: 4px; animation-delay: 0s; }
.cbw-bubble-particle:nth-child(2) { width: 5px; height: 5px; left: 44px; background: var(--cbw-accent-dark); animation-delay: 1.3s; }
.cbw-bubble-particle:nth-child(3) { width: 4px; height: 4px; left: 24px; animation-delay: 2.6s; }
@keyframes cbw-float {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    20% { opacity: 0.75; }
    65% { opacity: 0.4; }
    100% { transform: translateY(-40px) scale(1); opacity: 0; }
}
.cbw-panel {
    width: min(378px, calc(100vw - 24px));
    height: min(608px, calc(100vh - 116px));
    background: #fff; border-radius: 14px; overflow: hidden;
    border: 1px solid var(--cbw-accent-soft);
    box-shadow: 0 20px 56px rgba(20,33,61,0.20), 0 2px 10px rgba(20,33,61,0.08);
    display: flex; flex-direction: column; position: relative;
    animation: cbw-pop 0.18s ease-out;
    transition: width 0.2s cubic-bezier(.4,0,.2,1), height 0.2s cubic-bezier(.4,0,.2,1);
}
.cbw-panel-expanded {
    width: min(480px, calc(100vw - 24px));
    height: min(724px, calc(100vh - 60px));
}
@keyframes cbw-pop { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.cbw-header {
    background: #fff; border-bottom: 1px solid #E7E9ED;
    color: #1A1D24; padding: 14px 14px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
}
.cbw-header-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.cbw-header-avatar {
    width: 36px; height: 36px; border-radius: 50%; background: var(--cbw-accent-dark);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; position: relative; color: #fff;
}
.cbw-status-dot { position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background: #24B47E; border: 2px solid #fff; }
.cbw-header-name { font-size: 13.5px; font-weight: 700; line-height: 1.3; color: #1A1D24; }
.cbw-header-sub { font-size: 10.5px; color: #8B93A1; margin-top: 1px; display: flex; align-items: center; gap: 4px; }
.cbw-header-actions { display: flex; align-items: center; gap: 1px; flex-shrink: 0; }
.cbw-close-btn { background: transparent; border: none; color: #8B93A1; cursor: pointer; padding: 7px; display: flex; border-radius: 7px; transition: background 0.12s, color 0.12s; }
.cbw-close-btn:hover { background: #F1F3F5; color: #1A1D24; }

/* ===== ツールチップ — ブラウザ標準のtitle属性(見た目が粗い)を使わず、
   自前で軽量なホバーラベルを表示する ===== */
[data-tooltip] { position: relative; }
[data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute; top: calc(100% + 7px); right: 0;
    background: #1A1D24; color: #fff; font-size: 10.5px; font-weight: 600; line-height: 1.3;
    padding: 5px 9px; border-radius: 6px; white-space: nowrap;
    opacity: 0; transform: translateY(-4px); pointer-events: none;
    transition: opacity 0.12s ease, transform 0.12s ease; z-index: 20;
    box-shadow: 0 4px 12px rgba(20,33,61,0.22);
}
[data-tooltip]:hover::after, [data-tooltip]:focus-visible::after { opacity: 1; transform: translateY(0); }
.cbw-body { flex: 1; overflow-y: auto; padding: 16px; background: color-mix(in srgb, var(--cbw-accent-soft) 40%, #F6F7F9); display: flex; flex-direction: column; gap: 10px; }
.cbw-body::-webkit-scrollbar { width: 5px; }
.cbw-body::-webkit-scrollbar-thumb { background: #C9CDD6; border-radius: 4px; }
.cbw-row { display: flex; gap: 8px; align-items: flex-start; max-width: 100%; }
.cbw-row-user { justify-content: flex-end; }
.cbw-avatar {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
    background: var(--cbw-accent-dark);
    display: flex; align-items: center; justify-content: center; overflow: hidden; color: #fff;
}
.cbw-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.cbw-header-avatar .cbw-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.cbw-bubble { padding: 12px 16px; font-size: 13.3px; line-height: 1.55; max-width: 78%; word-break: break-word; }
.cbw-bubble-bot { background: #fff; color: #1A1D24; border: 1px solid var(--cbw-accent-soft); border-radius: 4px 14px 14px 14px; box-shadow: 0 1px 2px rgba(20,33,61,0.04); }
.cbw-bubble-user { background: #EEF0F3; color: #1A1D24; border-radius: 14px 4px 14px 14px; }
.cbw-link { color: inherit; text-decoration: underline; font-weight: 600; }
.cbw-bubble-bot .cbw-link { color: var(--cbw-accent-dark); }
.cbw-copy-btn {
    margin-left: 34px; margin-top: 3px; width: 22px; height: 22px; padding: 0;
    border: none; background: transparent; color: #B0B6C0; cursor: pointer;
    display: flex; align-items: center; justify-content: center; border-radius: 5px;
    transition: background 0.12s, color 0.12s;
}
.cbw-copy-btn:hover { background: #E9EBEF; color: var(--cbw-accent-dark); }
.cbw-answer-card { margin-left: 34px; margin-top: 6px; max-width: 78%; display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #E2E4E9; border-radius: 10px; padding: 8px; box-shadow: 0 1px 3px rgba(20,33,61,0.05); }
.cbw-images { display: flex; flex-wrap: wrap; gap: 6px; }
.cbw-answer-img { width: 88px; height: 88px; object-fit: cover; border-radius: 8px; border: 1px solid #E2E4E9; display: block; }
.cbw-cta { align-self: flex-start; font-size: 11.5px; font-weight: 700; color: #fff; background: var(--cbw-accent-dark); padding: 6px 13px; border-radius: 999px; text-decoration: none; }
.cbw-cta:hover { opacity: 0.92; }
.cbw-feedback { display: flex; gap: 6px; margin-top: 6px; margin-left: 34px; }
.cbw-fb-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; border: 1px solid #D8DBE2; background: #fff; color: #5B6472; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.12s; }
.cbw-fb-btn:hover { background: #F5F6F8; border-color: #B7BCC6; color: #1A1D24; }
.cbw-menu { display: flex; flex-direction: column; gap: 7px; margin-left: 34px; margin-top: 4px; margin-right: 2px; }
.cbw-menu-item {
    display: flex; align-items: center; gap: 8px; padding: 10px 12px; width: 100%;
    border-radius: 10px; background: var(--cbw-accent-soft); border: 1px solid var(--cbw-accent); color: var(--cbw-accent-dark);
    font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;
    transition: border-color 0.12s, background 0.12s;
}
.cbw-menu-item:hover { background: color-mix(in srgb, var(--cbw-accent) 15%, var(--cbw-accent-soft)); }
.cbw-menu-item .cbw-menu-spark { flex-shrink: 0; color: var(--cbw-accent-dark); }
.cbw-menu-item .cbw-menu-label {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cbw-menu-item .cbw-menu-arrow { flex-shrink: 0; color: var(--cbw-accent); }
.cbw-typing { display: flex; gap: 4px; align-items: center; padding: 11px 14px; }
.cbw-dot { width: 6px; height: 6px; border-radius: 50%; background: #B7BCC6; animation: cbw-bounce 1.3s infinite ease-in-out both; }
.cbw-dot:nth-child(2) { animation-delay: -0.18s; }
.cbw-dot:nth-child(3) { animation-delay: -0.36s; }
@keyframes cbw-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
.cbw-inputbar { border-top: 1px solid #E2E4E9; padding: 10px 12px; display: flex; align-items: center; gap: 8px; background: #fff; flex-shrink: 0; }
.cbw-input { flex: 1; border: none; outline: none; background: transparent; font-size: 13.5px; color: #1A1D24; padding: 6px 4px; font-family: inherit; }
.cbw-input::placeholder { color: #9CA3AF; }
.cbw-send-btn { width: 34px; height: 34px; padding: 0; margin: 0; box-sizing: border-box; border-radius: 50%; border: none; background: var(--cbw-accent-dark); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: opacity 0.12s, transform 0.12s; }
.cbw-send-btn:disabled { background: #C9CDD6; cursor: default; }
.cbw-send-btn:hover:not(:disabled) { transform: scale(1.05); }
.cbw-footer { text-align: center; padding: 6px 0 10px; font-size: 10px; color: #B7BCC6; }
@media (prefers-reduced-motion: reduce) {
  .cbw-panel, .cbw-teaser { animation: none; transition: none; }
  .cbw-dot { animation: none; opacity: 0.8; }
  .cbw-launcher:hover { transform: none; }
  .cbw-bubble-particle { animation: none; opacity: 0; }
  .cbw-launcher-pulse { animation: none; opacity: 0; }
  [data-tooltip]::after { transition: none; }
}
`;
