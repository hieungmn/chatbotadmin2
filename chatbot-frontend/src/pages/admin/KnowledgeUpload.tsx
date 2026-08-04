import React, { useCallback, useEffect, useRef, useState } from 'react';
import { deleteKnowledgeFile, getKnowledgeFileChunks, getKnowledgeFiles, reviewKnowledgeFile, uploadKnowledgeFile } from '../../api/knowledge';
import { useSite } from '../../context/SiteContext';
import { useAuth } from '../../context/AuthContext';
import { KnowledgeFile } from '../../types';
import { IconBrain, IconRefresh, IconTrash } from '../../components/icons';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
const statusBadge = (status: string) => {
    if (status === 'completed') return <Badge tone="success">アップロード済み</Badge>;
    if (status === 'processing' || status === 'pending') return <Badge tone="warning">処理中</Badge>;
    if (status === 'failed') return <Badge tone="danger">取込失敗</Badge>;
    return <Badge tone="neutral">{status}</Badge>;
};

const approvalBadge = (status: string) => {
    if (status === 'approved') return <Badge tone="success">承認済み</Badge>;
    if (status === 'pending') return <Badge tone="warning">承認待ち</Badge>;
    return <Badge tone="danger">却下</Badge>;
};

export default function KnowledgeUpload() {

    const { selectedSiteId, hasNoSites, sites } = useSite();

    const { role } = useAuth();

    const [fileType, setFileType] = useState<'word' | 'excel' | 'pdf'>('word');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<KnowledgeFile[]>([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [viewingFile, setViewingFile] = useState<KnowledgeFile | null>(null);
    const [chunks, setChunks] = useState<{
        id: number; content_text: string; section_id: string | null; section_title: string | null;
        page_number: number | null; sheet_name: string | null; row_number: number | null;
    }[]>([]);
    const [chunksLoading, setChunksLoading] = useState(false);
    const [chunksError, setChunksError] = useState('');
    const chunkRequest = useRef(0);
    const currentSite = sites.find(s => s.site_id === selectedSiteId);

    const handleSelectFile = (file: File) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        const type = extension === 'docx' ? 'word' : ['xlsx', 'xls'].includes(extension || '') ? 'excel' : extension === 'pdf' ? 'pdf' : null;
        if (!type) {
            setSelectedFile(null); setIsError(true);
            setMessage('Word（.docx）、Excel（.xlsx / .xls）、PDF（.pdf）を選択してください。');
            return;
        }
        setFileType(type); setSelectedFile(file); setIsError(false); setMessage('');
    };

    const fetchFiles = useCallback(() => {
        if (!selectedSiteId) { setFiles([]); setFilesLoading(false); return; }
        setFilesLoading(true);
        getKnowledgeFiles(selectedSiteId)
            .then(res => { if (res.success) setFiles(res.files || []); })
            .finally(() => setFilesLoading(false));
    }, [selectedSiteId]);

    useEffect(() => {
        chunkRequest.current++;
        setViewingFile(null);
        fetchFiles();
        return () => { chunkRequest.current++; };
    }, [fetchFiles]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
        else if (e.type === 'dragleave') setIsDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
        if (e.dataTransfer.files?.[0]) handleSelectFile(e.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!selectedFile || !selectedSiteId) return;
        setLoading(true);
        setMessage('');
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('site_id', selectedSiteId);
            formData.append('file_type', fileType);

            const res = await uploadKnowledgeFile(formData);
            if (res.success) {
                setIsError(false);
                const warnings = Array.isArray(res.warnings) ? res.warnings.filter((warning: unknown) => typeof warning === 'string') : [];
                setMessage(['アップロードが完了しました。', ...warnings].join(' '));
                setSelectedFile(null);
                fetchFiles();
            } else {
                setIsError(true);
                setMessage(res.message || '学習に失敗しました。');
            }
        } catch (err: any) {
            setIsError(true);
            setMessage(err.response?.data?.message || 'アップロード中にエラーが発生しました。');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFile = async (file: KnowledgeFile) => {
        if (!window.confirm(`「${file.file_name}」を削除しますか？関連するナレッジチャンクもすべて削除されます。`)) return;
        setBusyId(file.id);
        try {
            await deleteKnowledgeFile(file.id);
            setFiles(prev => prev.filter(f => f.id !== file.id));
        } catch (err: any) {
            alert(err.response?.data?.message || '削除に失敗しました。');
        } finally {
            setBusyId(null);
        }
    };

    const handleReviewFile = async (file: KnowledgeFile, approve: boolean) => {
        setBusyId(file.id);
        try {
            await reviewKnowledgeFile(file.id, approve);
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, approval_status: approve ? 'approved' : 'rejected' } : f));
        } catch (err: any) {
            alert(err.response?.data?.message || '処理に失敗しました。');
        } finally {
            setBusyId(null);
        }
    };

    const handleViewChunks = async (file: KnowledgeFile) => {
        const request = ++chunkRequest.current;
        setViewingFile(file);
        setChunks([]);
        setChunksError('');
        setChunksLoading(true);
        try {
            const res = await getKnowledgeFileChunks(file.id);
            if (request !== chunkRequest.current) return;
            if (res.success && Array.isArray(res.chunks)) setChunks(res.chunks);
            else setChunksError(res.message || '内容を取得できませんでした。もう一度お試しください。');
        } catch (error: any) {
            if (request !== chunkRequest.current) return;
            setChunksError(error.response?.data?.message || '内容を取得できませんでした。接続を確認して、もう一度お試しください。');
        } finally {
            if (request === chunkRequest.current) setChunksLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="page-head">
                <div className="page-eyebrow">Knowledge Upload</div>
                <h1 className="page-title">AIナレッジ</h1>
                <div className="page-desc">Word・Excel・PDFファイルを登録し、AIが回答の根拠として参照するナレッジを管理します。</div>
            </div>

            {hasNoSites ? (
                <div className="panel"><EmptyState title="割り当てられたサイトがありません" /></div>
            ) : (
                <div className="import-grid">
                    <div className="panel">
                        <div className="panel-head"><span className="panel-head-title">新規アップロード</span></div>
                        <div className="panel-body">
                            <div className="banner banner-info" style={{ marginBottom: 12, fontSize: 11.5 }}>
                                対象: <b>{currentSite?.site_name || selectedSiteId}</b>
                                {role === 'staff' && <><br /></>}
                            </div>

                            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                                    <input type="radio" checked={fileType === 'word'} onChange={() => { setFileType('word'); setSelectedFile(null); }} /> Word
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                                    <input type="radio" checked={fileType === 'excel'} onChange={() => { setFileType('excel'); setSelectedFile(null); }} /> Excel
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                                    <input type="radio" checked={fileType === 'pdf'} onChange={() => { setFileType('pdf'); setSelectedFile(null); }} /> PDF
                                </label>
                            </div>

                            <input
                                type="file"
                                accept={fileType === 'word' ? '.docx' : fileType === 'pdf' ? '.pdf' : '.xlsx,.xls'}
                                ref={inputRef}
                                onChange={(e) => { if (e.target.files?.[0]) handleSelectFile(e.target.files[0]); e.currentTarget.value = ''; }}
                                style={{ display: 'none' }}
                            />
                            <div
                                className={`dropzone ${isDragActive ? 'active' : ''}`}
                                onClick={() => inputRef.current?.click()}
                                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                            >
                                <IconBrain size={18} className="cell-muted" />
                                <div className="dropzone-title" style={{ marginTop: 6 }}>
                                    {selectedFile ? selectedFile.name : 'クリックまたはドラッグで選択'}
                                </div>
                                <div className="dropzone-desc">{fileType === 'word' ? '.docx' : fileType === 'pdf' ? '.pdf' : '.xlsx / .xls'}</div>
                            </div>
                            <div className="field-hint" style={{ marginTop: 8 }}>
                                {fileType === 'excel'
                                    ? '一般的な表と質問・回答形式に対応します。項目名を先頭行に置くと読み取りやすくなります。取込後は「詳細を見る」でシート・行・内容を確認してください。'
                                    : fileType === 'pdf'
                                        ? '文字を選択・コピーできるPDFに対応します。画像だけのスキャンPDFやパスワード付きPDFは読み取れません。'
                                        : '文書内のテキストを取り込みます。画像内の文字は読み取れません。'}
                            </div>

                            {selectedFile && (
                                <div style={{ marginTop: 10 }}>
                                    <button onClick={handleUpload} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                                        {loading ? 'アップロード・処理中…' : 'アップロードする'}
                                    </button>
                                </div>
                            )}

                            {message && (
                                <div className={`banner ${isError ? 'banner-danger' : 'banner-success'}`} style={{ marginTop: 12, fontSize: 11.5 }}>{message}</div>
                            )}
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-head">
                            <span className="panel-head-title">アップロード済みファイル</span>
                            <button onClick={fetchFiles} disabled={filesLoading} className="btn btn-secondary btn-sm"><IconRefresh size={12} /> 更新</button>
                        </div>
                        <div className="data-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>ファイル名</th>
                                        <th>形式</th>
                                        <th>状態</th>
                                        <th>承認</th>
                                        <th className="cell-num">チャンク</th>
                                        <th>登録日</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filesLoading ? (
                                        <tr><td colSpan={7} className="table-empty">読み込み中…</td></tr>
                                    ) : files.length === 0 ? (
                                        <tr><td colSpan={7} className="table-empty">まだファイルがアップロードされていません</td></tr>
                                    ) : (
                                        files.map(f => (
                                            <tr key={f.id}>
                                                <td className="cell-truncate" title={f.file_name}>{f.file_name}</td>
                                                <td className="cell-muted">{f.file_type}</td>
                                                <td title={f.status === 'failed' ? 'ファイルを削除して、もう一度アップロードしてください。' : undefined}>{statusBadge(f.status)}</td>
                                                <td>{approvalBadge(f.approval_status)}</td>
                                                <td className="cell-num">{f.chunk_count}</td>
                                                <td className="cell-muted">{new Date(f.created_at).toLocaleDateString('ja-JP')}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleViewChunks(f)} style={{ marginRight: 4 }}>
                                                        詳細を見る
                                                    </button>
                                                    {role === 'admin' && f.approval_status === 'pending' && f.status === 'completed' && (
                                                        <>
                                                            <button className="btn btn-secondary btn-sm" disabled={busyId === f.id} onClick={() => handleReviewFile(f, true)} style={{ marginRight: 4 }}>承認</button>
                                                            <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => handleReviewFile(f, false)} style={{ marginRight: 4 }}>却下</button>
                                                        </>
                                                    )}
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        disabled={busyId === f.id}
                                                        onClick={() => handleDeleteFile(f)}
                                                    >
                                                        <IconTrash size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {viewingFile && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,61,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
                    <div className="panel" style={{ width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                        <div className="panel-head">
                            <span className="panel-head-title cell-truncate" title={viewingFile.file_name}>
                                学習内容 — {viewingFile.file_name}
                            </span>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                chunkRequest.current++;
                                setViewingFile(null);
                            }}>閉じる</button>
                        </div>
                        <div className="panel-body" style={{ overflowY: 'auto' }}>
                            {chunksLoading ? (
                                <EmptyState title="読み込み中…" />
                            ) : chunksError ? (
                                <div role="alert">
                                    <div className="banner banner-danger">{chunksError}</div>
                                    <button className="btn btn-secondary" style={{ marginTop: 12 }}
                                        onClick={() => handleViewChunks(viewingFile)}>再試行</button>
                                </div>
                            ) : chunks.length === 0 ? (
                                <EmptyState title="学習データが見つかりませんでした" />
                            ) : (
                                <>
                                    <div className="field-hint" style={{ marginBottom: 10 }}>
                                        このファイルから、AIが実際に学習した{chunks.length}件の断片（チャンク）です。
                                    </div>
                                    {chunks.map((c, i) => (
                                        <div key={c.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                            <div className="cell-muted" style={{ fontSize: 10, marginBottom: 4 }}>
                                                #{i + 1}
                                                {c.section_title && ` · ${c.section_title}`}
                                                {c.page_number != null && ` · ページ ${c.page_number}`}
                                                {c.sheet_name && ` · ${c.sheet_name}`}
                                                {c.row_number != null && ` · 行 ${c.row_number}`}
                                            </div>
                                            {c.content_text}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
