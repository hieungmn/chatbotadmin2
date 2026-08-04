import { BASE_URL } from '../api/client';
import ImageLightbox from '../components/ImageLightbox';
import { useWidgetPresentation } from './useWidgetPresentation';
import { ArrowIcon, BotIcon, CheckIcon, CloseIcon, CompressIcon, CopyIcon, ExpandIcon, SendIcon, SparkleIcon, StaffIcon, ThumbDownIcon, ThumbUpIcon } from './widget-icons';
import { WIDGET_STYLES } from './widget-styles';
import { ChatMessageContent } from './ChatMessageContent';
import { safeChatUrl } from './safe-html';
import { widgetAssetUrl } from './widget-runtime';

interface ChatWidgetProps {
    siteId: string;
    apiUrl?: string;
}
export default function ChatWidget({ siteId, apiUrl }: ChatWidgetProps) {
    const {
        isOpen,
        setIsOpen,
        isExpanded,
        setIsExpanded,
        setShowTeaser,
        setHoverTeaser,
        setTeaserDismissed,
        lightbox,
        setLightbox,
        copiedId,
        handleCopy,
        siteName,
        contactUrl,
        avatarUrl,
        messages,
        suggestedTopics,
        input,
        setInput,
        isTyping,
        ready,
        available,
        bodyRef,
        sendMessage,
        sendFeedback,
        handleCloseClick,
        accentVars,
        showSuggestedTopics,
        teaserVisible
    } = useWidgetPresentation(siteId, apiUrl);
    const assetUrl = (value: string) => widgetAssetUrl(value, apiUrl ?? BASE_URL);
    const avatarSrc = avatarUrl ? assetUrl(avatarUrl) : undefined;

    return (
        <div
            className="cbw-root"
            style={accentVars}
            onMouseEnter={() => { if (!isOpen) setHoverTeaser(true); }}
            onMouseLeave={() => { if (!isOpen) setHoverTeaser(false); }}
            onFocus={() => { if (!isOpen) setHoverTeaser(true); }}
            onBlur={() => { if (!isOpen) setHoverTeaser(false); }}
        >
            <style>{WIDGET_STYLES}</style>

            {!isOpen && (
                <div className="cbw-launcher-row">
                    {teaserVisible && (
                        <div className="cbw-teaser" onClick={() => { setIsOpen(true); setShowTeaser(false); }}>
                            <span
                                className="cbw-teaser-close"
                                onClick={(e) => { e.stopPropagation(); setShowTeaser(false); setHoverTeaser(false); setTeaserDismissed(true); }}
                            >
                                <CloseIcon size={11} />
                            </span>
                            <b>{siteName}</b>のAIアシスタントです。<br />なんでもお気軽にどうぞ！
                        </div>
                    )}
                    <div className="cbw-launcher-wrap">
                        <span className="cbw-launcher-pulse" />
                        <span className="cbw-launcher-pulse cbw-launcher-pulse-delay" />
                        <span className="cbw-bubble-particle" />
                        <span className="cbw-bubble-particle" />
                        <span className="cbw-bubble-particle" />
                        <button
                            className="cbw-launcher"
                            onClick={() => { setIsOpen(true); setShowTeaser(false); setHoverTeaser(false); }}
                            aria-label="チャットを開く"
                        >
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="" className="cbw-launcher-avatar-img" />
                            ) : (
                                <BotIcon size={44} />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {isOpen && (
                <div className={`cbw-panel${isExpanded ? ' cbw-panel-expanded' : ''}`} role="dialog" aria-label={`${siteName} サポートチャット`}>
                    <div className="cbw-header">
                        <div className="cbw-header-left">
                            <div className="cbw-header-avatar">
                                {avatarSrc ? <img src={avatarSrc} alt="" className="cbw-avatar-img" /> : <BotIcon />}
                                <span className="cbw-status-dot" />
                            </div>
                            <div>
                                <div className="cbw-header-name">{siteName}</div>
                                <div className="cbw-header-sub">ご質問をお聞かせください</div>
                            </div>
                        </div>
                        <div className="cbw-header-actions">
                            {contactUrl && contactUrl !== '#' && (
                                <button
                                    className="cbw-close-btn"
                                    onClick={() => window.open(contactUrl, '_blank', 'noopener,noreferrer')}
                                    aria-label="有人スタッフに相談"
                                    data-tooltip="有人スタッフに相談"
                                >
                                    <StaffIcon />
                                </button>
                            )}
                            <button
                                className="cbw-close-btn"
                                onClick={() => setIsExpanded(v => !v)}
                                aria-label={isExpanded ? '縮小して表示' : '大きく表示'}
                                data-tooltip={isExpanded ? '元のサイズに戻す' : '大きく表示'}
                            >
                                {isExpanded ? <CompressIcon /> : <ExpandIcon />}
                            </button>
                            <button className="cbw-close-btn" onClick={handleCloseClick} aria-label="閉じる" data-tooltip="閉じる">
                                <CloseIcon />
                            </button>
                        </div>
                    </div>

                    <div className="cbw-body" ref={bodyRef}>
                        {messages.map((msg) => (
                            <div key={msg.id}>
                                <div className={`cbw-row ${msg.sender === 'user' ? 'cbw-row-user' : ''}`}>
                                    {msg.sender === 'bot' && <div className="cbw-avatar">{avatarSrc ? <img src={avatarSrc} alt="" className="cbw-avatar-img" /> : <BotIcon />}</div>}
                                    <div
                                        className={`cbw-bubble ${msg.sender === 'user' ? 'cbw-bubble-user' : 'cbw-bubble-bot'}`}
                                    >
                                        <ChatMessageContent text={msg.text} sender={msg.sender} />
                                    </div>
                                </div>
                                {msg.sender === 'bot' && msg.id !== 'welcome' && (
                                    <button className="cbw-copy-btn" onClick={() => handleCopy(msg.id, msg.text)} data-tooltip={copiedId === msg.id ? 'コピーしました' : '回答をコピー'}>
                                        {copiedId === msg.id ? <CheckIcon /> : <CopyIcon />}
                                    </button>
                                )}
                                {msg.sender === 'bot' && ((msg.images && msg.images.length > 0) || msg.redirect_url) && (
                                    <div className="cbw-answer-card">
                                        {msg.images && msg.images.length > 0 && (
                                            <div className="cbw-images">
                                                {msg.images.map((imgPath, i) => {
                                                    const fullSrc = assetUrl(imgPath);
                                                    if (!fullSrc) return null;
                                                    const allFullSrcs = msg.images!.map(assetUrl).filter((url): url is string => !!url);
                                                    return (
                                                        <img
                                                            key={i}
                                                            src={fullSrc}
                                                            alt=""
                                                            className="cbw-answer-img"
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => setLightbox({ images: allFullSrcs, index: allFullSrcs.indexOf(fullSrc) })}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {safeChatUrl(msg.redirect_url) && (
                                            <a href={safeChatUrl(msg.redirect_url)} target="_blank" rel="noopener noreferrer" className="cbw-cta">
                                                詳細を見る →
                                            </a>
                                        )}
                                    </div>
                                )}
                                {msg.sender === 'bot' && msg.showFeedback && (
                                    <div className="cbw-feedback">
                                        <button className="cbw-fb-btn" onClick={() => sendFeedback(msg.id, 1)}>
                                            <ThumbUpIcon /> 役に立った
                                        </button>
                                        <button className="cbw-fb-btn" onClick={() => sendFeedback(msg.id, -1)}>
                                            <ThumbDownIcon /> 役に立たなかった
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isTyping && (
                            <div className="cbw-row">
                                <div className="cbw-avatar">{avatarSrc ? <img src={avatarSrc} alt="" className="cbw-avatar-img" /> : <BotIcon />}</div>
                                <div className="cbw-bubble cbw-bubble-bot" style={{ padding: 0 }}>
                                    <div className="cbw-typing"><span className="cbw-dot" /><span className="cbw-dot" /><span className="cbw-dot" /></div>
                                </div>
                            </div>
                        )}

                        {showSuggestedTopics && (
                            <div className="cbw-menu">
                                {suggestedTopics.map((topic, i) => (
                                    <button key={i} className="cbw-menu-item" onClick={() => sendMessage(topic.label)} title={topic.label}>
                                        <span className="cbw-menu-spark"><SparkleIcon /></span>
                                        <span className="cbw-menu-label">{topic.label}</span>
                                        <span className="cbw-menu-arrow"><ArrowIcon /></span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="cbw-inputbar">
                        <input
                            className="cbw-input"
                            value={input}
                            disabled={isTyping || !ready || !available}
                            maxLength={4000}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder={isTyping ? 'AIが入力中…' : 'ご質問を入力してください'}
                        />
                        <button className="cbw-send-btn" onClick={() => sendMessage()} disabled={isTyping || !ready || !available || !input.trim()} aria-label="送信">
                            <SendIcon />
                        </button>
                    </div>

                </div>
            )}

            {lightbox && (
                <ImageLightbox
                    images={lightbox.images}
                    index={lightbox.index}
                    onClose={() => setLightbox(null)}
                    onIndexChange={(newIndex) => setLightbox(prev => prev ? { ...prev, index: newIndex } : null)}
                />
            )}
        </div>
    );
}
