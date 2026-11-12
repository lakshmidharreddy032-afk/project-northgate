import React, { useEffect, useState } from 'react';
import { apiUrl } from '../api';
import type { KycCase, NorthgateView } from '../shared/index';

interface DocumentViewerViewProps {
  activeCase: KycCase;
  onSaveAnnotation: (docId: string, annotation: string) => Promise<void>;
  onFlagDeficiency: (docId: string, bboxId?: string) => Promise<void>;
  onNavigate: (view: NorthgateView) => void;
  notify: (title: string, message: string) => void;
}

export const DocumentViewerView: React.FC<DocumentViewerViewProps> = ({
  activeCase,
  onSaveAnnotation,
  onFlagDeficiency,
  onNavigate,
  notify,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(activeCase.documents[0]?.id ?? '');
  const [pageIdx, setPageIdx] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [showOcrLayer, setShowOcrLayer] = useState(true);
  const [selectedBboxId, setSelectedBboxId] = useState<string>('');
  const [annotation, setAnnotation] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const doc = activeCase.documents.find((d) => d.id === selectedDocId) ?? activeCase.documents[0];

  useEffect(() => {
    if (activeCase.documents.length > 0 && !activeCase.documents.some((d) => d.id === selectedDocId)) {
      setSelectedDocId(activeCase.documents[0].id);
    }
    setPageIdx(0);
  }, [activeCase.id, activeCase.documents, selectedDocId]);

  useEffect(() => {
    if (doc) {
      setAnnotation(doc.analystAnnotation);
      setSelectedBboxId(doc.boundingBoxes[0]?.id ?? '');
      setPageIdx(0);
    }
  }, [doc?.id]);

  if (!doc) {
    return (
      <div className="p-6 text-on-surface-variant">
        No source documents attached to {activeCase.id}.
      </div>
    );
  }

  const page = doc.pages[pageIdx] ?? doc.pages[0];
  const focusedBox = doc.boundingBoxes.find((b) => b.id === selectedBboxId) ?? doc.boundingBoxes[0];

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await onSaveAnnotation(doc.id, annotation);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Top Toolbar */}
      <div className="bg-surface-container-lowest border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="material-symbols-outlined text-[18px] text-secondary">description</span>
          <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Active Source:</span>
          <select
            value={doc.id}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="h-8 px-2.5 bg-surface-container-low border border-slate-200 rounded font-mono text-[12px] font-semibold text-on-surface"
          >
            {activeCase.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fileName} (pg {d.currentPage}/{d.pageCount})
              </option>
            ))}
          </select>
          <span className="px-2 py-0.5 rounded bg-surface-container-low font-mono text-[11px] text-on-surface-variant">
            SHA-256: {doc.sha256.slice(0, 6)}...{doc.sha256.slice(-4)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Page Stepper */}
          <div className="flex items-center bg-surface-container-low rounded px-1 py-0.5 gap-1">
            <button
              type="button"
              disabled={pageIdx === 0}
              onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="font-mono text-[11px] px-1">
              {String(page?.pageNumber ?? 1).padStart(2, '0')} / {String(doc.pageCount).padStart(2, '0')}
            </span>
            <button
              type="button"
              disabled={pageIdx >= doc.pages.length - 1}
              onClick={() => setPageIdx((p) => Math.min(doc.pages.length - 1, p + 1))}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          {/* Zoom & Rotate */}
          <div className="flex items-center bg-surface-container-low rounded px-1 py-0.5 gap-1">
            <button
              type="button"
              onClick={() => setZoomPct((z) => Math.max(80, z - 10))}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white"
            >
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <span className="font-mono text-[11px] px-1">{zoomPct}%</span>
            <button
              type="button"
              onClick={() => setZoomPct((z) => Math.min(130, z + 10))}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
            <button
              type="button"
              onClick={() => setRotationDeg((r) => (r + 90) % 360)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white"
              title="Rotate Clockwise"
            >
              <span className="material-symbols-outlined text-[16px]">rotate_right</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowOcrLayer((v) => !v)}
            className={`h-8 px-3 rounded text-[11.5px] font-semibold flex items-center gap-1.5 ${
              showOcrLayer
                ? 'bg-secondary-container text-white'
                : 'bg-surface-container-low text-on-surface border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">layers</span>
            <span>OCR Bounding Layer</span>
          </button>

          <a
            href={apiUrl(`/api/cases/${encodeURIComponent(activeCase.id)}/documents/${encodeURIComponent(doc.id)}/download`)}
            className="h-8 px-3 rounded bg-surface-container-low border border-slate-200 hover:bg-surface-container text-[11.5px] font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Original PDF</span>
          </a>
        </div>
      </div>

      {/* Split Workbench */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] bg-surface-container-high/40">
        {/* Left 55%: Scanned Document Canvas */}
        <div className="w-full lg:w-[55%] p-5 flex flex-col items-center overflow-y-auto relative">
          <div className="pointer-events-none fixed bottom-16 left-72 z-10 opacity-20 select-none hidden xl:block">
            <div className="font-mono text-[13px] uppercase tracking-widest text-on-surface-variant -rotate-12 border-2 border-dashed border-outline-variant p-2 rounded">
              CONFIDENTIAL REGULATORY EVIDENCE • {activeCase.id}
            </div>
          </div>

          <div
            className="w-full max-w-[700px] bg-white border border-slate-200 rounded shadow-md p-8 text-on-surface transition-transform origin-top"
            style={{ transform: `scale(${zoomPct / 100}) rotate(${rotationDeg}deg)` }}
          >
            {page && (
              <>
                <div className="flex items-center justify-between font-mono text-[10.5px] text-outline pb-5">
                  <span>{page.headerLeft}</span>
                  <span>{page.headerRight}</span>
                </div>

                <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 mb-6">
                  <div className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-[24px] text-primary">account_balance</span>
                  </div>
                  <h2 className="text-[20px] font-semibold text-primary uppercase tracking-tight">
                    {page.documentTitle}
                  </h2>
                  <div className="text-[12px] text-on-surface-variant uppercase tracking-widest mt-1">
                    {page.subtitle}
                  </div>
                  <div className="font-mono text-[11px] text-on-surface-variant mt-0.5">{page.regMeta}</div>
                </div>

                <div className="flex flex-col gap-5">
                  {page.clauses.map((cl) => {
                    const bbox = cl.bboxId
                      ? doc.boundingBoxes.find((b) => b.id === cl.bboxId)
                      : undefined;
                    const isFocused = bbox && focusedBox?.id === bbox.id;
                    return (
                      <div key={cl.heading}>
                        <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-primary mb-1">
                          {cl.heading}
                        </h3>
                        <p className="text-[13px] leading-relaxed text-on-surface">{cl.body}</p>

                        {bbox && showOcrLayer && (
                          <button
                            type="button"
                            onClick={() => setSelectedBboxId(bbox.id)}
                            className={`w-full text-left relative mt-3 p-3 rounded transition-all ${
                              isFocused
                                ? 'bg-secondary-container/15 ring-2 ring-secondary shadow-sm'
                                : 'bg-surface-container-low border border-secondary/40 hover:ring-1 hover:ring-secondary'
                            }`}
                          >
                            <div className="inline-flex items-center gap-1.5 bg-secondary text-white text-[10.5px] font-semibold px-2 py-0.5 rounded mb-1.5">
                              {bbox.status !== 'VERIFIED' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-ping" />
                              )}
                              <span>{bbox.label}</span>
                            </div>
                            <div className="font-mono text-[13px] font-semibold text-primary">
                              {bbox.extractedText}
                            </div>
                            <div className="text-right font-mono text-[10.5px] text-secondary mt-1">
                              [x:{bbox.coords[0]}, y:{bbox.coords[1]}, w:{bbox.coords[2]}, h:{bbox.coords[3]}] • Conf:{' '}
                              {bbox.confidencePct}%
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right 45%: Evidentiary Extracted Attributes & Annotation */}
        <div className="w-full lg:w-[45%] bg-surface-container-lowest border-l border-slate-200 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Evidentiary Extracted Attributes
              </div>
              <h2 className="font-semibold text-[15px] text-on-surface">
                {doc.fileName} (Page {page?.pageNumber ?? 1})
              </h2>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold">
                ● {doc.ocrConfidencePct}% OCR Conf
              </span>
              <div className="font-mono text-[10.5px] text-on-surface-variant mt-0.5">Model: {doc.ocrModel}</div>
            </div>
          </div>

          <p className="text-[12px] text-on-surface-variant">
            Extracted structural entities correlated in real-time with statutory registries and KYC ownership graph. Select any bounding box to inspect or flag.
          </p>

          {/* All Bounding Boxes Cards */}
          <div className="flex flex-col gap-2.5">
            {doc.boundingBoxes.map((box) => {
              const isFocused = focusedBox?.id === box.id;
              const isIssue = box.status === 'DISCREPANCY' || box.status === 'FLAGGED';
              return (
                <div
                  key={box.id}
                  onClick={() => setSelectedBboxId(box.id)}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    isFocused
                      ? 'border-secondary bg-[#f0f7ff]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">
                        {isIssue ? 'location_on' : 'verified'}
                      </span>
                      {box.clauseTitle}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold ${
                        isIssue
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      }`}
                    >
                      {box.status === 'DISCREPANCY'
                        ? 'Registry Discrepancy Found'
                        : box.status === 'FLAGGED'
                          ? 'Flagged for Remediation'
                          : 'Verified in Registry'}
                    </span>
                  </div>

                  <div className="mt-1.5 font-mono text-[12.5px] font-semibold text-on-surface">
                    {box.extractedText}
                  </div>

                  {box.registryConflictNote && (
                    <div className="mt-2 p-2 rounded bg-error-container/40 border border-red-200 text-[11.5px] text-on-error-container">
                      {box.registryConflictNote}
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigator.clipboard?.writeText(box.extractedText);
                        notify('Copied Text', 'Extracted OCR text copied to clipboard.');
                      }}
                      className="h-7 px-2.5 rounded border border-slate-200 bg-white hover:bg-surface-container-low text-[11px] font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span>Copy Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onFlagDeficiency(doc.id, box.id);
                      }}
                      className="h-7 px-2.5 rounded bg-error-container/60 hover:bg-error-container text-on-error-container text-[11px] font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">flag</span>
                      <span>Flag as Deficiency</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('registry-reconciliation');
                      }}
                      className="h-7 px-2.5 rounded border border-slate-200 bg-white hover:bg-surface-container-low text-[11px] font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      <span>View in Registry Table</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Analyst Case Annotation */}
          <div className="mt-auto pt-3 border-t border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                KYC Senior Analyst Case Annotation
              </span>
              <span className="font-mono text-[10.5px] text-on-surface-variant">Auth: {doc.annotatedBy}</span>
            </div>
            <textarea
              rows={3}
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded text-[12px] focus:outline-none focus:border-secondary"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-secondary">verified_user</span>
                Immutable Audit Trail Integration Active
              </span>
              <button
                type="button"
                disabled={savingNote}
                onClick={() => void handleSaveNote()}
                className="h-8 px-3 rounded bg-primary text-white text-[12px] font-semibold hover:bg-primary-container"
              >
                {savingNote ? 'Saving...' : 'Save Annotation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
