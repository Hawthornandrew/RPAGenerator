import React, { useState, useEffect } from 'react';
import FieldMapper    from './FieldMapper';
import OfferGenerator from './OfferGenerator';
import { fetchCoordinates, fetchTemplate } from './api';
import './App.css';

export default function App() {
  const [mode,        setMode]        = useState('loading');
  const [coordinates, setCoordinates] = useState({});
  const [pdfBytes,    setPdfBytes]    = useState(null);
  const [loadError,   setLoadError]   = useState('');

  useEffect(() => {
    async function init() {
      try {
        const [coords, bytes] = await Promise.all([
          fetchCoordinates(),
          fetchTemplate(),
        ]);
        setCoordinates(coords);
        setPdfBytes(bytes);
        // If admin has never mapped fields, open mapper; otherwise go straight to generator
        const hasCoords = Object.keys(coords).length > 0;
        setMode(hasCoords ? 'generator' : 'mapper');
      } catch (e) {
        setLoadError(e.message);
        setMode('error');
      }
    }
    init();
  }, []);

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
      <FieldMapper
        initialCoords={coordinates}
        pdfBytes={pdfBytes}
        onComplete={handleMapComplete}
        onCancel={() => setMode('generator')}
      />
    );
  }

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
            <button className="remap-btn" onClick={() => setMode('mapper')}>
              Edit field positions
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <OfferGenerator
          coordinates={coordinates}
          pdfBytes={pdfBytes}
          onRemap={() => setMode('mapper')}
        />
      </main>
    </div>
  );
}
