import React, { useState, useEffect } from 'react';
import FieldMapper    from './FieldMapper';
import FieldManager   from './FieldManager';
import OfferGenerator from './OfferGenerator';
import { fetchCoordinates, fetchTemplate, fetchFields } from './api';
import './App.css';

export default function App() {
  const [mode,        setMode]        = useState('loading');
  const [coordinates, setCoordinates] = useState({});
  const [pdfBytes,    setPdfBytes]    = useState(null);
  const [fields,      setFields]      = useState([]);
  const [loadError,   setLoadError]   = useState('');
  const [showManager, setShowManager] = useState(false);
  const [adminPin,    setAdminPin]    = useState('');

  useEffect(() => {
    async function init() {
      try {
        const [coords, bytes, fieldDefs] = await Promise.all([
          fetchCoordinates(),
          fetchTemplate(),
          fetchFields(),
        ]);
        setCoordinates(coords);
        setPdfBytes(bytes);
        setFields(fieldDefs);
        setMode(Object.keys(coords).length > 0 ? 'generator' : 'mapper');
      } catch (e) {
        setLoadError(e.message);
        setMode('error');
      }
    }
    init();
  }, []);

  // Called by FieldManager when fields are saved.
  // Updates live state immediately — new fields appear in the mapper + form
  // without needing a page reload. User still needs to paste FIELD_DEFINITIONS
  // into Vercel and redeploy to persist across sessions.
  function handleFieldsSaved(updatedFields) {
    setFields(updatedFields);
    // Don't close the modal — user needs to copy the FIELD_DEFINITIONS value first
  }

  function handleMapComplete(coords) {
    setCoordinates(coords);
    setMode('generator');
  }

  if (mode === 'loading') {
    return (
      <div className="full-center">
        <div className="spinner" />
        <p className="loading-text">Loading offer generator…</p>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="full-center">
        <div className="error-card">
          <div className="error-icon">⚠</div>
          <h2>Setup required</h2>
          <p>{loadError}</p>
          <p className="error-hint">
            Make sure <code>TEMPLATE_URL</code> and <code>FIELD_COORDINATES</code> are set
            in your Vercel environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'mapper') {
    return (
      <>
        <FieldMapper
          fields={fields}
          initialCoords={coordinates}
          pdfBytes={pdfBytes}
          onComplete={handleMapComplete}
          onCancel={Object.keys(coordinates).length > 0 ? () => setMode('generator') : null}
          onManageFields={() => setShowManager(true)}
          adminPin={adminPin}
        />
        {showManager && (
          <FieldManager
            fields={fields}
            onSave={handleFieldsSaved}
            onClose={() => setShowManager(false)}
            adminPin={adminPin}
            onAdminPin={setAdminPin}
          />
        )}
      </>
    );
  }

  // Generator mode
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">H&amp;A</span>
            <span className="logo-text">Offer Generator</span>
          </div>
          <div className="header-right">
            <span className="logo-sub">Hawthorn &amp; Albatross</span>
            <button className="header-btn" onClick={() => setShowManager(true)}>
              Manage fields
            </button>
            <button className="header-btn" onClick={() => setMode('mapper')}>
              Edit positions
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <OfferGenerator
          coordinates={coordinates}
          pdfBytes={pdfBytes}
          fields={fields}
          onRemap={() => setMode('mapper')}
        />
      </main>

      {showManager && (
        <FieldManager
          fields={fields}
          onSave={handleFieldsSaved}
          onClose={() => setShowManager(false)}
          adminPin={adminPin}
          onAdminPin={setAdminPin}
        />
      )}
    </div>
  );
}