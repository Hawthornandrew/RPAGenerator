import React, { useState } from 'react';
import { saveFields } from './api';
import './FieldManager.css';

const SECTIONS = [
  { id: 'property',  label: 'Property details' },
  { id: 'offer',     label: 'Offer & financing' },
  { id: 'timeline',  label: 'Timeline' },
  { id: 'parties',   label: 'Parties' },
  { id: 'hidden',    label: 'Hidden / auto-filled' },
];

function makeId(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function blankField() {
  return {
    id:          '',
    label:       '',
    page:        4,
    sampleValue: '',
    formSection: 'offer',
    formLabel:   '',
  };
}

export default function FieldManager({ fields, onSave, onClose, adminPin: initialPin, onAdminPin }) {
  const [localFields, setLocalFields] = useState(fields.map(f => ({ ...f })));
  const isDirty = JSON.stringify(localFields) !== JSON.stringify(fields);
  const [editing,     setEditing]     = useState(null);   // index of field being edited, or 'new'
  const [draft,       setDraft]       = useState(null);
  const [pin,         setPin]         = useState(initialPin || '');
  function updatePin(v) { setPin(v); if (onAdminPin) onAdminPin(v); }
  const [saving,      setSaving]      = useState(false);
  const [saveResult,  setSaveResult]  = useState(null);
  const [filter,      setFilter]      = useState('all');

  // ── Draft helpers ─────────────────────────────────────────────────────────
  function openNew() {
    setDraft(blankField());
    setEditing('new');
    setSaveResult(null);
  }

  function openEdit(i) {
    setDraft({ ...localFields[i] });
    setEditing(i);
    setSaveResult(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  function setDraftField(k, v) {
    setDraft(d => {
      const updated = { ...d, [k]: v };
      // Auto-generate id from label for new fields
      if (k === 'label' && editing === 'new') {
        updated.id = makeId(v);
        if (!updated.formLabel) updated.formLabel = v;
      }
      return updated;
    });
  }

  function commitDraft() {
    if (!draft.id || !draft.label || !draft.page) return;
    if (editing === 'new') {
      setLocalFields(f => [...f, draft]);
    } else {
      setLocalFields(f => f.map((field, i) => i === editing ? draft : field));
    }
    setEditing(null);
    setDraft(null);
  }

  function deleteField(i) {
    if (!window.confirm(`Delete field "${localFields[i].label}"?`)) return;
    setLocalFields(f => f.filter((_, idx) => idx !== i));
  }

  function moveField(i, dir) {
    const next = [...localFields];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setLocalFields(next);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await saveFields(localFields, pin);
      setSaveResult({ ok: true, message: result.message, value: result.FIELD_DEFINITIONS });
      onSave(localFields);
    } catch (e) {
      setSaveResult({ ok: false, message: e.message });
    }
    setSaving(false);
  }

  // ── Filtered view ─────────────────────────────────────────────────────────
  const visible = filter === 'all'
    ? localFields
    : localFields.filter(f => f.formSection === filter);

  return (
    <div className="fm-overlay">
      <div className="fm-panel">

        {/* Header */}
        <div className="fm-header">
          <div>
            <h2 className="fm-title">Field Manager</h2>
            <p className="fm-sub">Add, edit, or remove fields. Changes apply to both the mapper and the offer form.</p>
          </div>
          <button className="fm-close" onClick={() => {
            if (isDirty && !window.confirm("You have unsaved changes. Close anyway?")) return;
            onClose();
          }}>✕</button>
        </div>

        {/* Filter + Add */}
        <div className="fm-toolbar">
          <div className="fm-filters">
            <button className={`fm-filter ${filter === 'all' ? 'fm-filter--on' : ''}`} onClick={() => setFilter('all')}>
              All ({localFields.length})
            </button>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`fm-filter ${filter === s.id ? 'fm-filter--on' : ''}`}
                onClick={() => setFilter(s.id)}
              >
                {s.label} ({localFields.filter(f => f.formSection === s.id).length})
              </button>
            ))}
          </div>
          <button className="fm-add-btn" onClick={openNew}>+ Add field</button>
        </div>

        {/* Field list */}
        <div className="fm-list">
          {visible.map((field, vi) => {
            const i = localFields.indexOf(field);
            const isEditing = editing === i;
            return (
              <div key={field.id} className={`fm-row ${isEditing ? 'fm-row--editing' : ''}`}>
                {isEditing && draft ? (
                  <div className="fm-edit-form">
                    <div className="fm-edit-grid">
                      <div className="fm-ef">
                        <label>Label <span className="fm-req">*</span></label>
                        <input value={draft.label} onChange={e => setDraftField('label', e.target.value)} placeholder="e.g. Seller credit" />
                      </div>
                      <div className="fm-ef">
                        <label>ID (auto-generated)</label>
                        <input value={draft.id} onChange={e => setDraftField('id', e.target.value)} placeholder="seller_credit" />
                      </div>
                      <div className="fm-ef">
                        <label>PDF page <span className="fm-req">*</span></label>
                        <input type="number" min="1" max="29" value={draft.page}
                          onChange={e => setDraftField('page', parseInt(e.target.value) || 1)} />
                      </div>
                      <div className="fm-ef">
                        <label>Sample value</label>
                        <input value={draft.sampleValue} onChange={e => setDraftField('sampleValue', e.target.value)} placeholder="e.g. $2,000" />
                      </div>
                      <div className="fm-ef">
                        <label>Form section</label>
                        <select value={draft.formSection} onChange={e => setDraftField('formSection', e.target.value)}>
                          {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="fm-ef">
                        <label>Form label</label>
                        <input value={draft.formLabel} onChange={e => setDraftField('formLabel', e.target.value)} placeholder="Label shown in form" />
                      </div>
                    </div>
                    <div className="fm-edit-actions">
                      <button className="fm-btn-save" onClick={commitDraft}
                        disabled={!draft.id || !draft.label || !draft.page}>
                        Save field
                      </button>
                      <button className="fm-btn-cancel" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="fm-row-content">
                    <div className="fm-row-move">
                      <button onClick={() => moveField(i, -1)} title="Move up" disabled={i === 0}>▲</button>
                      <button onClick={() => moveField(i, 1)} title="Move down" disabled={i === localFields.length - 1}>▼</button>
                    </div>
                    <div className="fm-row-info">
                      <span className="fm-row-label">{field.label}</span>
                      <span className="fm-row-meta">
                        page {field.page}
                        {field.formSection !== 'hidden' && ` · ${SECTIONS.find(s => s.id === field.formSection)?.label}`}
                        {field.sampleValue && ` · "${field.sampleValue}"`}
                      </span>
                    </div>
                    <div className="fm-row-section">
                      <span className={`fm-section-badge fm-section-badge--${field.formSection}`}>
                        {SECTIONS.find(s => s.id === field.formSection)?.label}
                      </span>
                    </div>
                    <div className="fm-row-actions">
                      <button className="fm-btn-edit" onClick={() => openEdit(i)}>Edit</button>
                      <button className="fm-btn-delete" onClick={() => deleteField(i)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* New field form (appended at bottom) */}
          {editing === 'new' && draft && (
            <div className="fm-row fm-row--editing fm-row--new">
              <div className="fm-edit-form">
                <div className="fm-new-badge">New field</div>
                <div className="fm-edit-grid">
                  <div className="fm-ef">
                    <label>Label <span className="fm-req">*</span></label>
                    <input autoFocus value={draft.label} onChange={e => setDraftField('label', e.target.value)} placeholder="e.g. Seller credit" />
                  </div>
                  <div className="fm-ef">
                    <label>ID</label>
                    <input value={draft.id} onChange={e => setDraftField('id', e.target.value)} placeholder="seller_credit" />
                  </div>
                  <div className="fm-ef">
                    <label>PDF page <span className="fm-req">*</span></label>
                    <input type="number" min="1" max="29" value={draft.page}
                      onChange={e => setDraftField('page', parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="fm-ef">
                    <label>Sample value</label>
                    <input value={draft.sampleValue} onChange={e => setDraftField('sampleValue', e.target.value)} placeholder="e.g. $2,000" />
                  </div>
                  <div className="fm-ef">
                    <label>Form section</label>
                    <select value={draft.formSection} onChange={e => setDraftField('formSection', e.target.value)}>
                      {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="fm-ef">
                    <label>Form label</label>
                    <input value={draft.formLabel} onChange={e => setDraftField('formLabel', e.target.value)} placeholder="Label shown in form" />
                  </div>
                </div>
                <div className="fm-edit-actions">
                  <button className="fm-btn-save" onClick={commitDraft}
                    disabled={!draft.id || !draft.label || !draft.page}>
                    Add field
                  </button>
                  <button className="fm-btn-cancel" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save to server */}
        <div className="fm-save-bar">
          <div className="fm-save-top-row">
            <div className="fm-pin-row">
              <input
                type="password"
                className="fm-pin-input"
                placeholder="Admin PIN"
                value={pin}
                onChange={e => updatePin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <button className="fm-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save to server'}
              </button>
            </div>
            <p className="fm-save-explainer">
              Saves your field list. You'll get a value to paste into Vercel env vars.
            </p>
          </div>
          {saveResult && (
            <div className={`fm-save-result ${saveResult.ok ? 'fm-save-result--ok' : 'fm-save-result--err'}`}>
              {!saveResult.ok && <p>{saveResult.message}</p>}
              {saveResult.ok && saveResult.value && (
                <>
                  <p className="fm-save-hint">
                    <strong>Done!</strong> Now copy this value → paste into{' '}
                    <code>FIELD_DEFINITIONS</code> in Vercel → Save → Redeploy.
                  </p>
                  <div className="fm-copy-row">
                    <textarea
                      readOnly
                      className="fm-coord-output"
                      value={saveResult.value}
                      onClick={e => e.target.select()}
                    />
                    <button
                      className="fm-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(saveResult.value).then(() => {
                          const btn = document.activeElement;
                          const orig = btn.textContent;
                          btn.textContent = 'Copied!';
                          setTimeout(() => { btn.textContent = orig; }, 2000);
                        });
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
