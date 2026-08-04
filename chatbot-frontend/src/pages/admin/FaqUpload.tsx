import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { deleteFaqBatch, getFaqBatches, reviewFaqBatch, syncFaqDatabase } from '../../api/faq';
import { useSite } from '../../context/SiteContext';
import { useAuth } from '../../context/AuthContext';
import { ExcelFaqRow, FaqBatch } from '../../types';
import { IconRefresh, IconTrash, IconUpload } from '../../components/icons';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge tone="success">承認済み</Badge>;
    if (status === 'pending') return <Badge tone="warning">承認待ち</Badge>;
    return <Badge tone="danger">却下</Badge>;
};

export default function FaqUpload() {

    const { selectedSiteId, sites, hasNoSites } = useSite();

    const { role } = useAuth();

    const currentSite = sites.find(s => s.site_id === selectedSiteId);

    const [fileName, setFileName] = useState<string | null>(null);
    const [matchedRows, setMatchedRows] = useState<ExcelFaqRow[]>([]);
    const [skippedRows, setSkippedRows] = useState<{ row: ExcelFaqRow; reason: string }[]>([]);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [batches, setBatches] = useState<FaqBatch[]>([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [reviewingBatch, setReviewingBatch] = useState<FaqBatch | null>(null);
    const [reviewApprove, setReviewApprove] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const fetchBatches = useCallback(() => {
        if (!selectedSiteId) { setBatches([]); setBatchesLoading(false); return; }
        setBatchesLoading(true);
        getFaqBatches(selectedSiteId)
            .then(res => { if (res.success) setBatches(res.batches || []); })
            .finally(() => setBatchesLoading(false));
    }, [selectedSiteId]);

    useEffect(() => { fetchBatches(); }, [fetchBatches]);
    useEffect(() => { setReviewingBatch(null); setReviewError(''); }, [selectedSiteId]);

    // Excel列構成: A=data_id, B=site_id, C=category, D=question, E=keywords, F=answer_text, G=redirect_url
    const processExcel = (file: File) => {
        if (!selectedSiteId) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];

                if (rawRows.length <= 1) {
                    setIsError(true);
                    setMessage('Excelファイルにデータがありません。');
                    return;
                }

                const matched: ExcelFaqRow[] = [];
                const skipped: { row: ExcelFaqRow; reason: string }[] = [];

                rawRows.slice(1)
                    .filter(row => row && row.length > 0 && row[0])
                    .forEach((row) => {
                        const parsed: ExcelFaqRow = {
                            data_id: String(row[0] || '').trim(),
                            site_id: String(row[1] || '').trim().toLowerCase(),
                            category: String(row[2] || '').trim(),
                            question: String(row[3] || '').trim(),
                            keywords: String(row[4] || '').trim(),
                            answer_text: String(row[5] || '').trim(),
                            redirect_url: String(row[6] || '').trim(),
                            is_draft: false,
                        };

                        if (parsed.site_id && parsed.site_id !== selectedSiteId) {
                            skipped.push({ row: parsed, reason: `別サイト（${parsed.site_id}）のデータです` });
                        } else if (!parsed.question || !parsed.answer_text) {
                            skipped.push({ row: parsed, reason: '質問または回答が空です' });
                        } else {
                            matched.push({ ...parsed, site_id: selectedSiteId });
                        }
                    });

                setFileName(file.name);
                setMatchedRows(matched);
                setSkippedRows(skipped);
                setIsError(false);
                setMessage(
                    skipped.length > 0
                        ? `${matched.length}件が対象サイト向けです（${skipped.length}件は対象外のためスキップされます）。`
                        : `${matched.length}件のデータを読み込みました。内容を確認して同期してください。`
                );
            } catch (err) {
                console.error(err);
                setIsError(true);
                setMessage('Excelファイルの形式が正しくありません。1列目=data_id, 2列目=site_id, 3列目=category, 4列目=question, 5列目=keywords, 6列目=answer_text, 7列目=redirect_url の順で作成してください。');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
        else if (e.type === 'dragleave') setIsDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
        if (e.dataTransfer.files?.[0]) processExcel(e.dataTransfer.files[0]);
    };

    const handleSync = async () => {
        if (matchedRows.length === 0 || !selectedSiteId || !fileName) return;
        setLoading(true);
        setMessage('');
        try {
            const res = await syncFaqDatabase(selectedSiteId, fileName, matchedRows);
            if (res.success) {
                setIsError(false);
                setMessage(res.message || '同期が完了しました。');
                setMatchedRows([]);
                setSkippedRows([]);
                setFileName(null);
                fetchBatches();
            } else {
                setIsError(true);
                setMessage(res.message || '同期に失敗しました。');
            }
        } catch (err: any) {
            setIsError(true);
            setMessage(err.response?.data?.message || 'サーバーへの接続に失敗しました。');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBatch = async (batch: FaqBatch) => {
        if (!window.confirm(`「${batch.file_name}」を削除しますか？このファイルから登録された${batch.row_count}件のFAQもすべて削除されます。`)) return;
        setBusyId(batch.id);
        try {
            await deleteFaqBatch(batch.id);
            setBatches(prev => prev.filter(b => b.id !== batch.id));
        } catch (err: any) {
            alert(err.response?.data?.message || '削除に失敗しました。');
        } finally {
            setBusyId(null);
        }
    };

    const handleReviewBatch = async (batch: FaqBatch, approve: boolean) => {
        setBusyId(batch.id);
        setReviewError('');
        try {
            await reviewFaqBatch(batch.id, approve);
            setReviewingBatch(null);
            fetchBatches();
        } catch (err: any) {
            const error = err.response?.data?.message || '処理に失敗しました。';
            if (reviewingBatch) setReviewError(error);
            else alert(error);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="page">
            <div className="page-head">
                <div className="page-eyebrow">FAQ Upload</div>
                <h1 className="page-title">FAQ一括取込</h1>
                <div className="page-desc">Excelファイルから対象サイトのFAQを追加します。既存のFAQは削除されず、新しいファイルとして追加されます。</div>
            </div>

            {hasNoSites ? (
                <div className="panel"><EmptyState title="割り当てられたサイトがありません" /></div>
            ) : (
                <>
                    <div className="import-grid">
                        <div className="panel">
                            <div className="panel-head"><span className="panel-head-title">新規アップロード</span></div>
                            <div className="panel-body">
                                <div className="banner banner-info" style={{ marginBottom: 12, fontSize: 11.5 }}>
                                    対象: <b>{currentSite?.site_name || selectedSiteId}</b>
                                    {role === 'staff'}
                                </div>

                                <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processExcel(e.target.files[0])} style={{ display: 'none' }} />
                                <div
                                    className={`dropzone ${isDragActive ? 'active' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                                >
                                    <IconUpload size={18} className="cell-muted" />
                                    <div className="dropzone-title" style={{ marginTop: 6 }}>
                                        {isDragActive ? 'ドロップしてください' : 'クリックまたはドラッグで選択'}
                                    </div>
                                    <div className="dropzone-desc">.xlsx / .xls</div>
                                </div>
                                <div className="field-hint" style={{ marginTop: 8 }}>
                                    列順: data_id, site_id, category, question, keywords, answer_text, redirect_url
                                </div>

                                {message && (
                                    <div className={`banner ${isError ? 'banner-danger' : 'banner-success'}`} style={{ marginTop: 12, fontSize: 11.5 }}>{message}</div>
                                )}
                            </div>
                        </div>

                        <div className="panel">
                            <div className="panel-head">
                                <span className="panel-head-title">アップロード済みファイル</span>
                                <button onClick={fetchBatches} disabled={batchesLoading} className="btn btn-secondary btn-sm"><IconRefresh size={12} /> 更新</button>
                            </div>
                            <div className="data-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ファイル名</th>
                                            <th className="cell-num">件数</th>
                                            <th>状態</th>
                                            <th>アップロード者</th>
                                            <th>登録日時</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batchesLoading ? (
                                            <tr><td colSpan={6} className="table-empty">読み込み中…</td></tr>
                                        ) : batches.length === 0 ? (
                                            <tr><td colSpan={6} className="table-empty">まだファイルがアップロードされていません</td></tr>
                                        ) : (
                                            batches.map(b => (
                                                <tr key={b.id}>
                                                    <td className="cell-truncate" title={b.file_name}>{b.file_name}</td>
                                                    <td className="cell-num">{b.row_count}<span className="cell-muted"> / -{b.skipped_count}</span></td>
                                                    <td>{statusBadge(b.approval_status)}</td>
                                                    <td className="cell-muted">{b.uploaded_by_username || '—'}</td>
                                                    <td className="cell-muted">{new Date(b.created_at).toLocaleDateString('ja-JP')}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        {role === 'admin' && b.approval_status === 'pending' && (
                                                            <>
                                                                <button className="btn btn-secondary btn-sm" disabled={busyId === b.id} onClick={() => handleReviewBatch(b, true)} style={{ marginRight: 4 }}>承認</button>
                                                                <button className="btn btn-ghost btn-sm" disabled={busyId === b.id} onClick={() => handleReviewBatch(b, false)} style={{ marginRight: 4 }}>却下</button>
                                                            </>
                                                        )}
                                                        {role === 'admin' && b.approval_status !== 'pending' && (
                                                            <button className="btn btn-secondary btn-sm" disabled={busyId === b.id} style={{ marginRight: 4 }}
                                                                onClick={() => { setReviewingBatch(b); setReviewApprove(b.approval_status === 'approved'); setReviewError(''); }}>編集</button>
                                                        )}
                                                        <button className="btn btn-danger btn-sm" disabled={busyId === b.id} onClick={() => handleDeleteBatch(b)}>
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

                    {(matchedRows.length > 0 || skippedRows.length > 0) && (
                        <div className="panel">
                            <div className="panel-head">
                                <span className="panel-head-title">プレビュー — 取込対象 {matchedRows.length}件 / スキップ {skippedRows.length}件</span>
                                {matchedRows.length > 0 && (
                                    <button onClick={handleSync} disabled={loading} className="btn btn-primary">
                                        {loading ? '同期中…' : `${matchedRows.length}件を取り込む`}
                                    </button>
                                )}
                            </div>
                            <div className="data-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>状態</th><th>DATA ID</th><th>カテゴリ</th><th>質問</th><th>回答</th></tr>
                                    </thead>
                                    <tbody>
                                        {matchedRows.map((item, idx) => (
                                            <tr key={`m-${idx}`}>
                                                <td><Badge tone="success">取込対象</Badge></td>
                                                <td className="cell-mono">{item.data_id}</td>
                                                <td className="cell-muted">{item.category}</td>
                                                <td className="cell-truncate" title={item.question}>{item.question}</td>
                                                <td className="cell-muted cell-truncate" title={item.answer_text}>{item.answer_text}</td>
                                            </tr>
                                        ))}
                                        {skippedRows.map((s, idx) => (
                                            <tr key={`s-${idx}`} style={{ opacity: 0.6 }}>
                                                <td><Badge tone="neutral">スキップ</Badge></td>
                                                <td className="cell-mono">{s.row.data_id}</td>
                                                <td className="cell-muted" colSpan={2}>{s.reason}</td>
                                                <td className="cell-muted cell-truncate" title={s.row.question}>{s.row.question}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
            {role === 'admin' && reviewingBatch && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,61,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
                    <div className="panel" role="dialog" aria-modal="true" aria-labelledby="batch-review-title" style={{ width: 520, maxWidth: '100%', background: '#fff' }}>
                        <div className="panel-head"><span id="batch-review-title" className="panel-head-title">ファイルの承認状態を編集</span></div>
                        <div className="panel-body">
                            <p style={{ overflowWrap: 'anywhere' }}>{reviewingBatch.file_name}</p>
                            <p>更新すると、このファイルに含まれるすべてのFAQに反映されます。承認するとFAQ管理で編集でき、回答にも使用されます。</p>
                            {reviewError && <div className="banner banner-danger" role="alert">{reviewError}</div>}
                            <div className="field"><label className="field-label" htmlFor="batch-approval">承認状態</label>
                                <select id="batch-approval" className="field-select" value={reviewApprove ? 'approved' : 'rejected'} disabled={busyId === reviewingBatch.id} onChange={e => setReviewApprove(e.target.value === 'approved')}>
                                    <option value="approved">承認する</option><option value="rejected">却下する</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn btn-secondary" disabled={busyId === reviewingBatch.id} onClick={() => setReviewingBatch(null)}>キャンセル</button>
                                <button className="btn btn-primary" disabled={busyId === reviewingBatch.id} onClick={() => handleReviewBatch(reviewingBatch, reviewApprove)}>{busyId === reviewingBatch.id ? '更新中…' : '更新'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
