import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FIELDS } from './fields';
import { renderPageToCanvas, canvasToPDF } from './pdfUtils';
import { saveCoordinates } from './api';
import './FieldMapper.css';

export default function FieldMapper({ initialCoords, pdfBytes, onComplete, onCancel }) {
  const [coords,     setCoords]     = useState(initialCoords || {});
  const [fieldIdx,   setFieldIdx]   = useState(0);
  const [pageInfo,   setPageInfo]   = useState(null);
  const [pageCanvas, setPageCanvas] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [pin,        setPin]        = useState('');
  const [showPin,    setShowPin]    = useState(false);
  const [cursor,     setCursor]     = useState(null);

  const containerRef = useRef(null);
  const canvasRef    = useRef(null);

  const field       = FIELDS[fieldIdx];
  const mappedCount = FIELDS.filter(f => coords[f.id]).length;
  const allMapped   = mappedCount === FIELDS.length;

  // Render page whenever field changes
  useEffect(() => {
    if (!pdfBytes || !field) return;
    setLoading(true);
    const w = containerRef.current?.clientWidth || 780;
    renderPageToCanvas(pdfBytes, field.page, w)
      .then(result => { setPageCanvas(result); setPageInfo(result); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pdfBytes, fieldIdx]);

  // Redraw canvas with pins
  useEffect(() => {
    if (!pageCanvas || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width  = pageCanvas.canvas.width;
    canvasRef.current.height = pageCanvas.canvas.height;
    ctx.drawImage(pageCanvas.canvas, 0, 0);

    FIELDS.forEach(f => {
      const c = coords[f.id];
      if (!c || c.page !== field.page) return;
      const cx = c.pdfX * pageCanvas.scale;
      const cy = (pageCanvas.pdfHeight - c.pdfY) * pageCanvas.scale;
      const isActive = f.id === field.id;

      // Crosshair lines
      ctx.strokeStyle = isActive ? '#3B6D11' : 'rgba(99,153,34,0.5)';
      ctx.lineWidth   = isActive ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();

      // Dot
      ctx.beginPath();
      ctx.arc(cx, cy, isActive ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#3B6D11' : 'rgba(99,153,34,0.7)';
      ctx.fill();

      // Label bubble
      const label = f.sampleValue;
      ctx.font = `${isActive ? 'bold ' : ''}11px DM Sans, sans-serif`;
      const tw  = ctx.measureText(label).width;
      ctx.fillStyle = isActive ? '#3B6D11' : 'rgba(59,109,17,0.8)';
      ctx.fillRect(cx + 8, cy - 12, tw + 8, 14);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx + 12, cy - 2);
    });
  }, [pageCanvas, coords, fieldIdx]);

  const handleClick = useCallback(e => {
    if (!pageInfo || !canvasRef.current) return;
    const rect   = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width  / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const cx     = (e.clientX - rect.left) * scaleX;
    const cy     = (e.clientY - rect.top)  * scaleY;
    const { pdfX, pdfY } = canvasToPDF(cx, cy, pageInfo.pdfWidth, pageInfo.pdfHeight, pageInfo.scale);
    const next = { ...coords, [field.id]: { page: field.page, pdfX, pdfY } };
    setCoords(next);
    // Auto-advance to next unmapped field
    const ni = FIELDS.findIndex((f, i) => i > fieldIdx && !next[f.id]);
    if (ni !== -1) setFieldIdx(ni);
  }, [pageInfo, coords, field, fieldIdx]);

  const handleMouseMove = useCallback(e => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

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

  function handleDone() {
    onComplete(coords);
  }

  return (
    <div className="mapper-shell">
      {/* Sidebar */}
      <aside className="mapper-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">H&amp;A Field Mapper</div>
          <div className="sidebar-prog-label">{mappedCount} / {FIELDS.length} placed</div>
          <div className="sidebar-prog-track">
            <div className="sidebar-prog-fill" style={{ width: `${(mappedCount / FIELDS.length) * 100}%` }} />
          </div>
        </div>

        <div className="sidebar-cue">
          {allMapped
            ? <div className="cue-done">✓ All fields placed</div>
            : (
              <div className="cue-active">
                <div className="cue-num">{fieldIdx + 1}</div>
                <div>
                  <div className="cue-title">Click to place:</div>
                  <div className="cue-field">{field?.label}</div>
                  <div className="cue-sample">e.g. "{field?.sampleValue}"</div>
                  <div className="cue-page">Page {field?.page}</div>
                </div>
              </div>
            )
          }
          {!allMapped && (
            <button className="btn-skip" onClick={() => setFieldIdx(i => Math.min(i + 1, FIELDS.length - 1))}>
              Skip →
            </button>
          )}
        </div>

        <div className="field-list">
          {FIELDS.map((f, i) => (
            <div
              key={f.id}
              className={`fitem ${i === fieldIdx ? 'fitem--active' : ''} ${coords[f.id] ? 'fitem--done' : ''}`}
              onClick={() => setFieldIdx(i)}
            >
              <div className="fitem-dot">
                {coords[f.id] ? '✓' : <span style={{ opacity: 0.4 }}>{i + 1}</span>}
              </div>
              <div className="fitem-info">
                <div className="fitem-label">{f.label}</div>
                <div className="fitem-page">Page {f.page}</div>
              </div>
              {coords[f.id] && (
                <button className="fitem-clear" onClick={e => {
                  e.stopPropagation();
                  const n = { ...coords }; delete n[f.id]; setCoords(n);
                }}>×</button>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {/* Save to server */}
          {!showPin
            ? (
              <button className="btn-save" onClick={() => setShowPin(true)}>
                Save to server
              </button>
            )
            : (
              <div className="pin-entry">
                <input
                  type="password"
                  placeholder="Admin PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="pin-input"
                />
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )
          }

          {saveResult && (
            <div className={`save-result ${saveResult.ok ? 'save-result--ok' : 'save-result--err'}`}>
              <p>{saveResult.message}</p>
              {saveResult.ok && saveResult.value && (
                <>
                  <p style={{ marginTop: 6, fontSize: 11 }}>
                    Copy this value into your <code>FIELD_COORDINATES</code> env var in Vercel, then redeploy:
                  </p>
                  <textarea
                    readOnly
                    className="coord-output"
                    value={saveResult.value}
                    onClick={e => e.target.select()}
                  />
                </>
              )}
            </div>
          )}

          <button className="btn-done" onClick={handleDone}>
            {allMapped ? 'Start generating offers →' : 'Use current positions →'}
          </button>

          {onCancel && (
            <button className="btn-cancel" onClick={onCancel}>← Back to offers</button>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <main className="mapper-main" ref={containerRef}>
        {loading && (
          <div className="canvas-loading">
            <div className="spinner" />
            <span>Rendering page {field?.page}…</span>
          </div>
        )}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', cursor: 'crosshair', maxWidth: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursor(null)}
          />
          {cursor && !loading && (
            <div className="cursor-tip" style={{ left: cursor.x + 14, top: cursor.y - 10 }}>
              {field?.label}
            </div>
          )}
        </div>
        <div className="canvas-hint">
          Page {field?.page} — click exactly where the text should appear
        </div>
      </main>
    </div>
  );
}
