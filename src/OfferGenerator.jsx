import React, { useState, useCallback } from 'react';
import { fillPDF, downloadPDF } from './pdfUtils';
import { HEADER_PAGES } from './fields';
import './OfferGenerator.css';

// Built-in steps — always shown regardless of dynamic fields
const FIXED_STEPS = [
  { label: '1 / 4', title: 'Property details',   sub: 'Address and parcel information.' },
  { label: '2 / 4', title: 'Offer & financing',  sub: 'Purchase price, deposit, and loan terms.' },
  { label: '3 / 4', title: 'Timeline',            sub: 'Closing, possession, and expiration.' },
  { label: '4 / 4', title: 'Parties & generate',  sub: 'Seller info, then download the filled RPA PDF.' },
];


function fmtPrice(raw) {
  if (!raw) return '';
  const n = parseFloat(String(raw).replace(/[$,]/g, ''));
  return isNaN(n) ? raw : `$${Math.round(n).toLocaleString()}`;
}

function today() {
  return new Date().toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' });
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="toggle-group">
      {options.map(([v, label]) => (
        <button key={v} type="button"
          className={`tog ${value === v ? 'tog--on' : ''}`}
          onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="field">{label && <label className="field-label">{label}</label>}{children}</div>;
}

function Section({ title, children }) {
  return <div className="section">{title && <div className="section-title">{title}</div>}{children}</div>;
}

export default function OfferGenerator({ coordinates, pdfBytes, fields = [], onRemap }) {
  const [step,   setStep]   = useState(0);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  const set = useCallback((k, v) => setValues(f => ({ ...f, [k]: v })), []);
  const val = k => values[k] ?? '';

  const goStep = n => { setStep(n); window.scrollTo({ top:0, behavior:'smooth' }); };

  // Build offer values for PDF filling
  function buildOfferValues() {
    const date     = today();
    const addrFull = [val('property_address_p4')||val('property_address_p1'), val('property_city'), `CA ${val('property_zip')}`].filter(Boolean).join(', ');
    const result   = { date_header: date, address_header: addrFull };

    // Auto-fill hidden/computed fields
    fields.forEach(f => {
      if (f.formSection === 'hidden') {
        if (f.id.includes('date'))    result[f.id] = date;
        if (f.id === 'address_header') result[f.id] = addrFull;
        // Sync address/date to both pages
        if (f.id === 'property_address_p4') result[f.id] = val('property_address_p1') || val(f.id);
        if (f.id === 'date_prepared_p4')    result[f.id] = date;
        if (f.id === 'date_prepared')       result[f.id] = date;
      } else {
        result[f.id] = val(f.id) || '';
        // Format price fields
        if (f.id.includes('price') || f.id.includes('amount') || f.id.includes('emd')) {
          result[f.id] = fmtPrice(val(f.id));
        }
      }
    });

    return result;
  }

  async function handleGenerate() {
    setStatus('generating');
    setErrMsg('');
    try {
      const offerValues = buildOfferValues();
      const filled = await fillPDF(pdfBytes, coordinates, offerValues, HEADER_PAGES);
      const addr = (val('property_address_p1') || val('property_address_p4') || 'offer')
        .replace(/\s+/g,'_').replace(/,/g,'');
      downloadPDF(filled, `RPA_${addr}.pdf`);
      setStatus('done');
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  }

  // Dynamic fields for each step (filtered by section)
  function renderDynamicFields(section) {
    const sectionFields = fields.filter(f => f.formSection === section);
    if (!sectionFields.length) return null;
    return sectionFields.map(f => (
      <Field key={f.id} label={f.formLabel || f.label}>
        <input
          value={val(f.id)}
          onChange={e => set(f.id, e.target.value)}
          placeholder={f.sampleValue ? `e.g. ${f.sampleValue}` : ''}
        />
      </Field>
    ));
  }

  const isCash = (val('finance_type') || 'All Cash') === 'All Cash';

  const steps = [
    // Step 0 — Property (built-in + dynamic property fields)
    <div key="0">
      <Section>
        <Field label="Street address">
          <input value={val('property_address_p1')} onChange={e => set('property_address_p1', e.target.value)} placeholder="1234 Maple Ave" />
        </Field>
        <div className="row-3">
          <Field label="City"><input value={val('property_city')} onChange={e => set('property_city', e.target.value)} placeholder="Chula Vista" /></Field>
          <Field label="State"><input value="CA" readOnly /></Field>
          <Field label="ZIP"><input value={val('property_zip')} onChange={e => set('property_zip', e.target.value)} placeholder="91910" inputMode="numeric" /></Field>
        </div>
        <div className="row-2">
          <Field label="County"><input value={val('property_county')||'San Diego'} onChange={e => set('property_county', e.target.value)} /></Field>
          <Field label="APN (optional)"><input value={val('apn')} onChange={e => set('apn', e.target.value)} placeholder="000-000-00-00" /></Field>
        </div>
        {/* Any extra property fields added via Field Manager */}
        {fields.filter(f => f.formSection === 'property' && !['property_address_p1','property_address_p4','property_city','property_zip','apn'].includes(f.id)).map(f => (
          <Field key={f.id} label={f.formLabel || f.label}>
            <input value={val(f.id)} onChange={e => set(f.id, e.target.value)} placeholder={f.sampleValue ? `e.g. ${f.sampleValue}` : ''} />
          </Field>
        ))}
      </Section>
    </div>,

    // Step 1 — Offer (built-in + dynamic offer fields)
    <div key="1">
      <Section title="Purchase price">
        <div className="row-2">
          <Field label="Offer price"><input value={val('offer_price')} onChange={e => set('offer_price', e.target.value)} placeholder="$450,000" inputMode="numeric" /></Field>
          <Field label="Earnest money"><input value={val('emd_amount')} onChange={e => set('emd_amount', e.target.value)} placeholder="$5,000" inputMode="numeric" /></Field>
        </div>
        <Field label="EMD due within">
          <ToggleGroup options={[['1','1 day'],['2','2 days'],['3','3 days'],['5','5 days'],['7','7 days']]}
            value={val('emd_days')||'3'} onChange={v => set('emd_days', v)} />
        </Field>
      </Section>
      <Section title="Financing">
        <Field label="Finance type">
          <ToggleGroup options={[['All Cash','All cash'],['Conventional','Conventional'],['FHA','FHA'],['VA','VA']]}
            value={val('finance_type')||'All Cash'} onChange={v => set('finance_type', v)} />
        </Field>
        {!isCash && <Field label="Loan amount"><input value={val('loan_amount')} onChange={e => set('loan_amount', e.target.value)} placeholder="$360,000" /></Field>}
      </Section>
      {/* Extra offer fields */}
      {fields.filter(f => f.formSection === 'offer' && !['offer_price','emd_amount'].includes(f.id)).length > 0 && (
        <Section title="Additional offer terms">
          {fields.filter(f => f.formSection === 'offer' && !['offer_price','emd_amount'].includes(f.id)).map(f => (
            <Field key={f.id} label={f.formLabel || f.label}>
              <input value={val(f.id)} onChange={e => set(f.id, e.target.value)} placeholder={f.sampleValue ? `e.g. ${f.sampleValue}` : ''} />
            </Field>
          ))}
        </Section>
      )}
    </div>,

    // Step 2 — Timeline (built-in + dynamic timeline fields)
    <div key="2">
      <Section title="Close of escrow">
        <Field label="Days from acceptance">
          <ToggleGroup options={[['14','14'],['21','21'],['30','30'],['45','45'],['60','60']]}
            value={val('coe_days')||'14'} onChange={v => set('coe_days', v)} />
        </Field>
      </Section>
      <Section title="Possession">
        <Field>
          <ToggleGroup options={[['COE','Close of escrow'],['COE+3','COE +3 days'],['COE+5','COE +5 days'],['Negotiable','Negotiable']]}
            value={val('possession')||'COE'} onChange={v => set('possession', v)} />
        </Field>
      </Section>
      <Section title="Offer expiration">
        <div className="row-2">
          <Field label="Expires in">
            <ToggleGroup options={[['1','1d'],['2','2d'],['3','3d'],['5','5d'],['7','7d']]}
              value={val('offer_expiry')||'3'} onChange={v => set('offer_expiry', v)} />
          </Field>
          <Field label="At time">
            <select value={val('offer_expiry_time')||'5:00 PM'} onChange={e => set('offer_expiry_time', e.target.value)}>
              {['8:00 AM','9:00 AM','10:00 AM','12:00 PM','3:00 PM','5:00 PM','8:00 PM','11:59 PM'].map(t=><option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </Section>
      {/* Extra timeline fields */}
      {fields.filter(f => f.formSection === 'timeline' && !['coe_days'].includes(f.id)).length > 0 && (
        <Section title="Additional timeline terms">
          {fields.filter(f => f.formSection === 'timeline' && !['coe_days'].includes(f.id)).map(f => (
            <Field key={f.id} label={f.formLabel || f.label}>
              <input value={val(f.id)} onChange={e => set(f.id, e.target.value)} placeholder={f.sampleValue ? `e.g. ${f.sampleValue}` : ''} />
            </Field>
          ))}
        </Section>
      )}
    </div>,

    // Step 3 — Parties + generate
    <div key="3">
      <Section title="Seller information">
        <Field label="Seller name(s)"><input value={val('seller_name')} onChange={e => set('seller_name', e.target.value)} placeholder="Robert & Linda Johnson" /></Field>
        <div className="row-2">
          <Field label="Seller brokerage"><input value={val('seller_brokerage')} onChange={e => set('seller_brokerage', e.target.value)} placeholder="Pacific Coast Realty" /></Field>
          <Field label="Seller agent"><input value={val('seller_agent')} onChange={e => set('seller_agent', e.target.value)} placeholder="Maria Torres" /></Field>
        </div>
        <Field label="Seller agent DRE #"><input value={val('seller_agent_license')} onChange={e => set('seller_agent_license', e.target.value)} placeholder="02198765" /></Field>
        {/* Extra party fields */}
        {fields.filter(f => f.formSection === 'parties' && !['seller_name','seller_brokerage','seller_agent','seller_agent_license'].includes(f.id)).map(f => (
          <Field key={f.id} label={f.formLabel || f.label}>
            <input value={val(f.id)} onChange={e => set(f.id, e.target.value)} placeholder={f.sampleValue ? `e.g. ${f.sampleValue}` : ''} />
          </Field>
        ))}
      </Section>

      {/* Summary */}
      <div className="summary-card">
        <div className="summary-header">
          <div className="summary-address">{val('property_address_p1') || 'Address not entered'}</div>
          <div className="summary-city">{[val('property_city'),'CA',val('property_zip')].filter(Boolean).join(', ')}</div>
        </div>
        <div className="summary-body">
          <div className="sum-row"><span className="sum-key">Offer price</span><span className="sum-val">{fmtPrice(val('offer_price')) || '—'}</span></div>
          <div className="sum-row"><span className="sum-key">Earnest money</span><span className="sum-val">{fmtPrice(val('emd_amount')) || '—'}</span></div>
          <div className="sum-row"><span className="sum-key">Financing</span><span className="sum-val">{val('finance_type')||'All Cash'}</span></div>
          <div className="sum-row"><span className="sum-key">COE</span><span className="sum-val">{val('coe_days')||'14'} days</span></div>
          <div className="sum-row"><span className="sum-key">Seller</span><span className="sum-val">{val('seller_name')||'—'}</span></div>
        </div>
      </div>

      <button
        className={`pdf-btn ${status==='generating'?'pdf-btn--loading':''}`}
        onClick={handleGenerate}
        disabled={status==='generating'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9 15 12 18 15 15"/>
        </svg>
        {status==='generating' ? 'Filling PDF…' : status==='done' ? 'Downloaded! Generate again?' : 'Generate & download RPA PDF'}
      </button>

      {status==='error'   && <div className="status-error">Error: {errMsg}</div>}
      {status==='done'    && <div className="status-success">PDF downloaded.</div>}

      <div className="remap-hint">
        Fields in wrong position? <button className="remap-link" onClick={onRemap}>Re-open field mapper</button>
      </div>
      <button className="reset-btn" onClick={() => { setValues({}); setStatus('idle'); goStep(0); }}>
        Start new offer
      </button>
    </div>,
  ];

  const s = FIXED_STEPS[step];
  return (
    <div className="generator">
      <div className="progress-track">
        {FIXED_STEPS.map((_,i) => (
          <div key={i} className={`progress-seg ${i<step?'done':i===step?'active':''}`} />
        ))}
      </div>
      <div className="step-header">
        <span className="step-label">{s.label}</span>
        <h1 className="step-title">{s.title}</h1>
        <p className="step-sub">{s.sub}</p>
      </div>
      <div className="step-body">{steps[step]}</div>
      <div className="step-nav">
        <button className="btn btn--ghost" onClick={() => goStep(step-1)} style={{ visibility: step===0?'hidden':'visible' }}>← Back</button>
        <span className="step-counter">{s.label}</span>
        {step < FIXED_STEPS.length-1
          ? <button className="btn btn--primary" onClick={() => goStep(step+1)}>Continue →</button>
          : <span />}
      </div>
    </div>
  );
}
