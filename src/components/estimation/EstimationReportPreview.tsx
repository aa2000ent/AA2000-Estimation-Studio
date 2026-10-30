import React, { useEffect, useRef, useState } from 'react';
import { prepareEstimationReportLayout } from '../../utils/standardEstimationReport';

interface Props {
  html: string;
  onClose: () => void;
  onDownload: () => Promise<void>;
  controls?: React.ReactNode;
  busy?: boolean;
}

export default function EstimationReportPreview({ html, onClose, onDownload, controls, busy = false }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      previousFocus?.focus();
    };
  }, []);

  // An isolated document prevents the report's print styles from changing the
  // application. Both preview and download use the same HTML and pagination.
  const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>AA2000 Commercial Quotation Preview</title></head><body>${html}<style>
    html,body{margin:0;padding:0;background:#e2e8f0}
    .estimation-report{margin:auto;background:transparent;padding:12px 0}
    .estimation-report .proposal-cover,.estimation-report .logical-sheet{margin-bottom:16px;box-shadow:0 1px 5px #0002}
    @page{size:A4 portrait;margin:10pt 0 40pt}
    @media print{
      html,body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .estimation-report{width:210mm;margin:0;padding:0;background:#fff}
      .estimation-report .proposal-cover,.estimation-report .logical-sheet{width:100%;margin:0;box-shadow:none}
    }
  </style></body></html>`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0f172acc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="quotation-preview-title" style={{ width: 'min(1100px, 100%)', height: '92vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#fff', background: '#103861' }}>
          <div><h2 id="quotation-preview-title" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>AA2000 Commercial Quotation</h2><p style={{ fontSize: 12, margin: '3px 0 0', color: '#dbeafe' }}>Preview of the PDF export</p></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button disabled={loading || downloading} onClick={() => { const preview = previewRef.current?.contentWindow; preview?.focus(); preview?.print(); }} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', color: '#103861', fontWeight: 700, cursor: 'pointer', opacity: loading || downloading ? 0.6 : 1 }}>Print</button>
            <button disabled={loading || downloading} onClick={async () => { setDownloading(true); try { await onDownload(); } finally { setDownloading(false); } }} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', color: '#103861', fontWeight: 700, cursor: 'pointer', opacity: loading || downloading ? 0.6 : 1 }}>{downloading ? 'Generating PDF…' : 'Download PDF'}</button>
            <button ref={closeRef} onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #93c5fd', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Close</button>
          </div>
        </header>
        {controls}
        {(loading || busy) && <p role="status" style={{ margin: 0, padding: 10, fontSize: 12, color: '#334155' }}>{busy ? 'Generating PDF…' : 'Preparing preview…'}</p>}
        <iframe ref={previewRef} title="AA2000 proposal PDF preview" sandbox="allow-same-origin allow-modals" srcDoc={documentHtml} style={{ width: '100%', flex: 1, border: 0, background: '#e2e8f0', minHeight: 0 }} onLoad={async event => {
          const doc = event.currentTarget.contentDocument;
          if (!doc) return;
          await Promise.all(Array.from(doc.images).map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
          await doc.fonts?.ready;
          prepareEstimationReportLayout(doc.body);
          setLoading(false);
        }} />
      </section>
    </div>
  );
}
