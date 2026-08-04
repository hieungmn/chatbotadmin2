import { useSite } from '../../context/SiteContext';
import ChatWidget from '../../widget/ChatWidget';
import EmptyState from '../../components/EmptyState';
import { BASE_URL } from '../../api/client';
import { normalizeWidgetApiUrl } from '../../widget/widget-runtime';

export default function WidgetPreview() {
    const { sites, hasNoSites, selectedSiteId } = useSite();

    // このページは常にヘッダーで選択中のサイトに従う（他画面と統一）。
    const currentSite = sites.find(s => s.site_id === selectedSiteId);
    const backendUrl = normalizeWidgetApiUrl(BASE_URL);
    const embedSnippet = `<script src="${backendUrl}/static/chatbot-widget.js" data-site-id="${selectedSiteId || 's-wing'}" data-api-url="${backendUrl}" defer></script>`;

    return (
        <div className="page">
            <div className="page-head">
                <div className="page-eyebrow">Widget Preview</div>
                <h1 className="page-title">ウィジェット確認</h1>
                <div className="page-desc">
                    実際にサイトへ埋め込まれた場合の見た目・挙動を、右下に表示して確認できます。
                    {currentSite && <> 対象サイト: <b>{currentSite.site_name}</b></>}
                </div>
            </div>

            {hasNoSites ? (
                <div className="panel"><EmptyState title="割り当てられたサイトがありません" /></div>
            ) : (
                <>
                    <div className="panel">
                        <div className="panel-head"><span className="panel-head-title">埋め込みタグ（外部サイトの &lt;/body&gt; 直前に配置）</span></div>
                        <div className="panel-body">
                            <pre style={{
                                background: 'var(--navy-900)', color: '#D7E0EE', padding: '14px 16px', borderRadius: 6,
                                fontSize: 12, overflowX: 'auto', fontFamily: 'ui-monospace, monospace',
                            }}>{embedSnippet}</pre>
                            <div className="field-hint" style={{ marginTop: 8 }}>
                                公開サイトでは HTTPS のバックエンド URL を指定してください。埋め込みコードに管理者トークンを設定する必要はありません。ヘッダーのサイト選択を切り替えると、この埋め込みタグとプレビューも自動的に切り替わります。
                            </div>
                        </div>
                    </div>

                    {selectedSiteId && <ChatWidget key={selectedSiteId} siteId={selectedSiteId} />}
                </>
            )}
        </div>
    );
}
