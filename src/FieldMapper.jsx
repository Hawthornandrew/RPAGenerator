import React, { useState, useRef, useEffect, useCallback } from 'react';
import { renderPageToCanvas, canvasToPDF, normaliseCoords } from './pdfUtils';
import { saveCoordinates } from './api';
import './FieldMapper.css';

export default function FieldMapper({
  fields: FIELDS = [],
  initialCoords,
  pdfBytes,
  onComplete,
  onCancel,
  onManageFields,
  adminPin: initPin,
}) {
  // coords: { [fieldId]: [ { page, pdfX, pdfY }, ... ] }
  const [coords,     setCoords]     = useState(() => normaliseCoords(initialCoords || {}));
  const [fieldIdx,   setFieldIdx]   = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(29); // RPA template default
  const [pageInfo,   setPageInfo]   = useState(null);
  const [pageCanvas, setPageCanvas] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [pin,        setPin]        = useState(initPin || '');
  const [showPin,    setShowPin]    = useState(false);
  const [cursor,     setCursor]     = useState(null);

  const containerRef = useRef(null);
  const canvasRef    = useRef(null);

  const field       = FIELDS[fieldIdx];

  // Keep currentPage in sync when active field changes
  
  useEffect(() => { if (field?.page) setCurrentPage(field.page); }, [fieldIdx]);
  // A field is "placed" if it has at least one coordinate
  const mappedCount = FIELDS.filter(f => (coords[f.id] || []).length > 0).length;
  const allMapped   = FIELDS.length > 0 && mappedCount === FIELDS.length;

  useEffect(() => {
    setCoords(normaliseCoords(initialCoords || {}));
  }, [initialCoords]);

  useEffect(() => {
    if (FIELDS.length === 0) return;
    const first = FIELDS.findIndex(f => (coords[f.id] || []).length === 0);
    setFieldIdx(first === -1 ? 0 : first);
  }, [FIELDS.length]);

  // Render page whenever active field changes
  useEffect(() => {
    if (!pdfBytes || !field) return;
    setLoading(true);
    const w = containerRef.current?.clientWidth || 780;
    renderPageToCanvas(pdfBytes, currentPage, w)
      .then(result => {
        setPageCanvas(result);
        setPageInfo(result);
        if (result.totalPages) setTotalPages(result.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pdfBytes, currentPage, FIELDS.length]);

  // Redraw canvas with all pins for this page
  useEffect(() => {
    if (!pageCanvas || !canvasRef.current || !field) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width  = pageCanvas.canvas.width;
    canvasRef.current.height = pageCanvas.canvas.height;
    ctx.drawImage(pageCanvas.canvas, 0, 0);

    FIELDS.forEach(f => {
      const positions = (coords[f.id] || []).filter(p => p.page === currentPage);
      if (!positions.length) return;
      const isActive = f.id === field.id;

      positions.forEach((pos, pinIdx) => {
        const cx = pos.pdfX * pageCanvas.scale;
        const cy = (pageCanvas.pdfHeight - pos.pdfY) * pageCanvas.scale;

        // Crosshair
        ctx.strokeStyle = isActive ? '#3B6D11' : 'rgba(99,153,34,0.5)';
        ctx.lineWidth   = isActive ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(cx, cy, isActive ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#3B6D11' : 'rgba(99,153,34,0.7)';
        ctx.fill();

        // Label — show pin number if multiple
        const label = positions.length > 1
          ? `${f.sampleValue || f.label} (${pinIdx + 1})`
          : (f.sampleValue || f.label);
        ctx.font = `${isActive ? 'bold ' : ''}11px DM Sans, sans-serif`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = isActive ? '#3B6D11' : 'rgba(59,109,17,0.8)';
        ctx.fillRect(cx + 8, cy - 12, tw + 8, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, cx + 12, cy - 2);
      });
    });
  }, [pageCanvas, coords, fieldIdx, FIELDS]);

  const handleClick = useCallback(e => {
    if (!pageInfo || !canvasRef.current || !field) return;
    const rect   = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width  / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const cx     = (e.clientX - rect.left) * scaleX;
    const cy     = (e.clientY - rect.top)  * scaleY;
    const { pdfX, pdfY } = canvasToPDF(cx, cy, pageInfo.pdfWidth, pageInfo.pdfHeight, pageInfo.scale);

    // Add this position to the field's array (allows multiple pins)
    setCoords(prev => ({
      ...prev,
      [field.id]: [...(prev[field.id] || []), { page: currentPage, pdfX, pdfY }],
    }));
  }, [pageInfo, field]);

  const handleMouseMove = useCallback(e => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Remove a specific pin from a field
  function removePin(fieldId, pinIdx) {
    setCoords(prev => {
      const updated = (prev[fieldId] || []).filter((_, i) => i !== pinIdx);
      return { ...prev, [fieldId]: updated };
    });
  }

  // Remove ALL pins from a field
  function clearField(fieldId) {
    setCoords(prev => ({ ...prev, [fieldId]: [] }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await saveCoordinates(coords, pin);
      setSaveResult({ ok: true, message: result.message, value: result.FIELD_COORDINATES });
    } catch (e) {
      setSaveResult({ ok: false, message: e.message });
    }
    setSaving(false);
  }

  return (
    <div className="mapper-shell">
      <aside className="mapper-sidebar">

        <div className="sidebar-header">
          <div className="sidebar-brand-row">
            <div className="sidebar-brand">H&amp;A Field Mapper</div>
            {onManageFields && (
              <button className="btn-manage-fields" onClick={onManageFields}>
                Manage fields
              </button>
            )}
          </div>
          <div className="sidebar-prog-label">{mappedCount} / {FIELDS.length} placed</div>
          <div className="sidebar-prog-track">
            <div className="sidebar-prog-fill"
              style={{ width: FIELDS.length ? `${(mappedCount / FIELDS.length) * 100}%` : '0%' }} />
          </div>
        </div>

        {/* Current field instruction */}
        <div className="sidebar-cue">
          {FIELDS.length === 0 ? (
            <div className="cue-empty">
              No fields yet.{' '}
              {onManageFields && <button className="cue-link" onClick={onManageFields}>Add fields →</button>}
            </div>
          ) : (
            <div className="cue-active">
              <div className="cue-num">{fieldIdx + 1}</div>
              <div>
                <div className="cue-title">
                  {(coords[field?.id] || []).length === 0
                    ? 'Click to place:'
                    : 'Click to add another spot:'}
                </div>
                <div className="cue-field">{field?.label}</div>
                <div className="cue-sample">e.g. "{field?.sampleValue}"</div>
                <div className="cue-page">Page {field?.page}</div>
                {(coords[field?.id] || []).length > 0 && (
                  <div className="cue-count">
                    {(coords[field?.id] || []).length} spot{(coords[field?.id] || []).length > 1 ? 's' : ''} placed
                  </div>
                )}
              </div>
            </div>
          )}
          {FIELDS.length > 0 && (
            <button className="btn-skip"
              onClick={() => setFieldIdx(i => Math.min(i + 1, FIELDS.length - 1))}>
              Next field →
            </button>
          )}
        </div>

        {/* Field list */}
        <div className="field-list">
          {FIELDS.map((f, i) => {
            const positions = coords[f.id] || [];
            const isActive  = i === fieldIdx;
            return (
              <div key={f.id}>
                <div
                  className={`fitem ${isActive ? 'fitem--active' : ''} ${positions.length > 0 ? 'fitem--done' : ''}`}
                  onClick={() => setFieldIdx(i)}
                >
                  <div className="fitem-dot">
                    {positions.length > 0
                      ? <span className="fitem-count">{positions.length}</span>
                      : <span style={{ opacity: 0.4 }}>{i + 1}</span>}
                  </div>
                  <div className="fitem-info">
                    <div className="fitem-label">{f.label}</div>
                    <div className="fitem-page">Page {f.page}</div>
                  </div>
                  {positions.length > 0 && (
                    <button className="fitem-clear"
                      onClick={e => { e.stopPropagation(); clearField(f.id); }}
                      title="Remove all pins">×</button>
                  )}
                </div>

                {/* Show individual pins with remove buttons when active */}
                {isActive && positions.length > 0 && (
                  <div className="pin-list">
                    {positions.map((pos, pi) => (
                      <div key={pi} className="pin-item">
                        <span className="pin-label">
                          Spot {pi + 1} — page {pos.page}
                        </span>
                        <button className="pin-remove"
                          onClick={() => removePin(f.id, pi)}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="pin-add-hint">Click the PDF to add another spot</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          {!showPin ? (
            <button className="btn-save" onClick={() => setShowPin(true)}>
              Save positions to server
            </button>
          ) : (
            <div className="pin-entry">
              <input
                type="password"
                placeholder="Admin PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="pin-input"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          {saveResult && (
            <div className={`save-result ${saveResult.ok ? 'save-result--ok' : 'save-result--err'}`}>
              <p>{saveResult.message}</p>
              {saveResult.ok && saveResult.value && (
                <>
                  <p style={{ marginTop: 6, fontSize: 11 }}>
                    Paste into <code>FIELD_COORDINATES</code> in Vercel → redeploy:
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <textarea
                      readOnly
                      className="coord-output"
                      value={saveResult.value}
                      onClick={e => e.target.select()}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(saveResult.value).then(() => {
                          const btn = document.activeElement;
                          const orig = btn.textContent;
                          btn.textContent = 'Copied!';
                          setTimeout(() => { btn.textContent = orig; }, 2000);
                        });
                      }}
                    >Copy</button>
                  </div>
                </>
              )}
            </div>
          )}

          <button className="btn-done" onClick={() => onComplete(coords)}>
            {allMapped ? 'Start generating offers →' : 'Use current positions →'}
          </button>

          {onCancel && (
            <button className="btn-cancel" onClick={onCancel}>← Back to offers</button>
          )}
        </div>
      </aside>

      {/* PDF canvas */}
      <main className="mapper-main" ref={containerRef}>
        {loading && (
          <div className="canvas-loading">
            <div className="spinner" />
            <span>Rendering page {field?.page}…</span>
          </div>
        )}
        {!loading && !field && FIELDS.length === 0 && (
          <div className="canvas-empty">
            <p>No fields to place yet.</p>
            {onManageFields && (
              <button className="btn-done" style={{ marginTop: 12 }} onClick={onManageFields}>
                + Add your first field
              </button>
            )}
          </div>
        )}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', cursor: 'crosshair', maxWidth: '100%',
                     boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursor(null)}
          />
          {cursor && !loading && field && (
            <div className="cursor-tip" style={{ left: cursor.x + 14, top: cursor.y - 10 }}>
              {(coords[field.id] || []).length === 0
                ? `Place: ${field.label}`
                : `Add spot ${(coords[field.id] || []).length + 1}: ${field.label}`}
            </div>
          )}
        </div>
        {/* Page navigation */}
        <div className="page-nav">
          <button
            className="page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >← Prev</button>

          <div className="page-input-row">
            <span className="page-label">Page</span>
            <input
              type="number"
              className="page-input"
              value={currentPage}
              min={1}
              max={totalPages}
              onChange={e => {
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1 && n <= totalPages) setCurrentPage(n);
              }}
            />
            <span className="page-label">of {totalPages}</span>
          </div>

          <button
            className="page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >Next →</button>
        </div>

        {field && (
          <div className="canvas-hint">
            Placing: <strong>{field?.label}</strong> — click to add a spot on page {currentPage}
          </div>
        )}
      </main>
    </div>
  );
}

