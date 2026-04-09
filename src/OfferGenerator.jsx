import React, { useState, useCallback } from 'react';
import { fillPDF, downloadPDF } from './pdfUtils';
import { OFFER_FIELD_MAP, HEADER_PAGES } from './fields';
import './OfferGenerator.css';

const STEPS = [
  { label: '1 / 5', title: 'Property details',  sub: 'Address and parcel information.' },
  { label: '2 / 5', title: 'Offer & financing', sub: 'Purchase price, deposit, and loan terms.' },
  { label: '3 / 5', title: 'Timeline',           sub: 'Closing, possession, and offer expiration.' },
  { label: '4 / 5', title: 'Contingencies',      sub: 'Select applicable contingencies.' },
  { label: '5 / 5', title: 'Parties & generate', sub: 'Seller info, then download the filled RPA PDF.' },
];

const CONTINGENCIES = [
  { id: 'inspection', label: 'Inspection contingency',    note: 'Buyer right to inspect' },
  { id: 'loan',       label: 'Loan contingency',          note: 'Financing approval' },
  { id: 'appraisal',  label: 'Appraisal contingency',     note: 'Property value' },
  { id: 'sale',       label: "Sale of buyer's property",  note: 'Subject to sale' },
  { id: 'title',      label: 'Title review',              note: 'Clear title' },
];

const ITEMS = ['Refrigerator','Washer','Dryer','Dishwasher','Range/Oven','Microwave','Window coverings','Garage door openers','Pool equipment'];

const INITIAL = {
  propertyAddress: '', propertyCity: '', propertyZip: '',
  propertyCounty: 'San Diego', apn: '',
  offerPrice: '', emdAmount: '', emdDays: '3',
  financeType: 'All Cash', loanAmount: '',
  coeDays: '14', possession: 'COE',
  offerExpiry: '3', offerExpiryTime: '5:00 PM',
  sellerName: '', sellerBrokerage: '', sellerAgent: '', sellerAgentLicense: '',
  contingencies: [], includedItems: [],
  additionalTerms: '',
};

function fmtPrice(raw) {
  if (!raw) return '';
  const n = parseFloat(String(raw).replace(/[$,]/g,''));
  return isNaN(n) ? raw : `$${Math.round(n).toLocaleString()}`;
}

function fmtDisplay(raw) {
  if (!raw) return '—';
  const n = parseFloat(String(raw).replace(/[$,]/g,''));
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

export default function OfferGenerator({ coordinates, pdfBytes, onRemap }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [status, setStatus] = useState('idle'); // idle | generating | done | error
  const [errMsg, setErrMsg] = useState('');

  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);
  const toggleArr = useCallback((k, v) => {
    setForm(f => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]
    }));
  }, []);
  const input = (k, props={}) => ({
    value: form[k] || '',
    onChange: e => set(k, e.target.value),
    ...props,
  });

  const goStep = n => { setStep(n); window.scrollTo({ top:0, behavior:'smooth' }); };
  const isCash = form.financeType === 'All Cash';

  // Build the flat offer object that maps to field IDs
  function buildOfferValues() {
    const date = today();
    const addrFull = [form.propertyAddress, form.propertyCity, `CA ${form.propertyZip}`].filter(Boolean).join(', ');
    const price = fmtPrice(form.offerPrice);
    const emd   = fmtPrice(form.emdAmount);

    return {
      date_prepared:        date,
      property_address:     form.propertyAddress,
      date_prepared_p4:     date,
      property_address_p4:  form.propertyAddress,
      property_city:        form.propertyCity,
      property_zip:         form.propertyZip,
      apn:                  form.apn,
      seller_name:          form.sellerName,
      seller_brokerage:     form.sellerBrokerage,
      seller_agent:         form.sellerAgent,
      seller_agent_license: form.sellerAgentLicense,
      offer_price:          price,
      coe_days:             form.coeDays,
      emd_amount:           emd,
      address_header:       addrFull,
      date_header:          date,
    };
  }

  async function handleGenerate() {
    setStatus('generating');
    setErrMsg('');
    try {
      const offerValues = buildOfferValues();
      const filled = await fillPDF(pdfBytes, coordinates, offerValues, HEADER_PAGES);
      const addr = (form.propertyAddress || 'offer').replace(/\s+/g,'_').replace(/,/g,'');
      downloadPDF(filled, `RPA_${addr}.pdf`);
      setStatus('done');
    } catch (e) {
      console.error(e);
      setErrMsg(e.message);
      setStatus('error');
    }
  }

  const conLabels = CONTINGENCIES.filter(c => form.contingencies.includes(c.id)).map(c => c.label);

  const steps = [
    // Step 0
    <div key="0">
      <Section>
        <Field label="Street address"><input {...input('propertyAddress')} placeholder="1234 Maple Ave" /></Field>
        <div className="row-3">
          <Field label="City"><input {...input('propertyCity')} placeholder="Chula Vista" /></Field>
          <Field label="State"><input value="CA" readOnly /></Field>
          <Field label="ZIP"><input {...input('propertyZip')} placeholder="91910" inputMode="numeric" /></Field>
        </div>
        <div className="row-2">
          <Field label="County"><input {...input('propertyCounty')} /></Field>
          <Field label="APN (optional)"><input {...input('apn')} placeholder="000-000-00-00" /></Field>
        </div>
      </Section>
    </div>,

    // Step 1
    <div key="1">
      <Section title="Purchase price">
        <div className="row-2">
          <Field label="Offer price"><input {...input('offerPrice')} placeholder="$450,000" inputMode="numeric" /></Field>
          <Field label="Earnest money"><input {...input('emdAmount')} placeholder="$5,000" inputMode="numeric" /></Field>
        </div>
        <Field label="EMD due within">
          <ToggleGroup options={[['1','1 day'],['2','2 days'],['3','3 days'],['5','5 days'],['7','7 days']]}
            value={form.emdDays} onChange={v => set('emdDays', v)} />
        </Field>
      </Section>
      <Section title="Financing">
        <Field label="Finance type">
          <ToggleGroup options={[['All Cash','All cash'],['Conventional','Conventional'],['FHA','FHA'],['VA','VA']]}
            value={form.financeType} onChange={v => set('financeType', v)} />
        </Field>
        {!isCash && <Field label="Loan amount"><input {...input('loanAmount')} placeholder="$360,000" /></Field>}
      </Section>
    </div>,

    // Step 2
    <div key="2">
      <Section title="Close of escrow">
        <Field label="Days from acceptance">
          <ToggleGroup options={[['14','14'],['21','21'],['30','30'],['45','45'],['60','60']]}
            value={form.coeDays} onChange={v => set('coeDays', v)} />
        </Field>
      </Section>
      <Section title="Possession">
        <Field>
          <ToggleGroup
            options={[['COE','Close of escrow'],['COE+3','COE +3 days'],['COE+5','COE +5 days'],['Negotiable','Negotiable']]}
            value={form.possession} onChange={v => set('possession', v)} />
        </Field>
      </Section>
      <Section title="Offer expiration">
        <div className="row-2">
          <Field label="Expires in">
            <ToggleGroup options={[['1','1d'],['2','2d'],['3','3d'],['5','5d'],['7','7d']]}
              value={form.offerExpiry} onChange={v => set('offerExpiry', v)} />
          </Field>
          <Field label="At time">
            <select {...input('offerExpiryTime')}>
              {['8:00 AM','9:00 AM','10:00 AM','12:00 PM','3:00 PM','5:00 PM','8:00 PM','11:59 PM']
                .map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </Section>
    </div>,

    // Step 3
    <div key="3">
      <Section title="Contingencies">
        {CONTINGENCIES.map(c => (
          <label key={c.id} className="check-row">
            <input type="checkbox" checked={form.contingencies.includes(c.id)}
              onChange={() => toggleArr('contingencies', c.id)} />
            <span className="check-label">{c.label}</span>
            <span className="check-note">{c.note}</span>
          </label>
        ))}
      </Section>
      <Section title="Items included">
        <div className="toggle-group toggle-group--wrap">
          {ITEMS.map(item => (
            <button key={item} type="button"
              className={`tog ${form.includedItems.includes(item) ? 'tog--on' : ''}`}
              onClick={() => toggleArr('includedItems', item)}>
              {item}
            </button>
          ))}
        </div>
      </Section>
    </div>,

    // Step 4 — Parties + Generate
    <div key="4">
      <Section title="Seller information">
        <Field label="Seller name(s)"><input {...input('sellerName')} placeholder="Robert & Linda Johnson" /></Field>
        <div className="row-2">
          <Field label="Seller brokerage"><input {...input('sellerBrokerage')} placeholder="Pacific Coast Realty" /></Field>
          <Field label="Seller agent"><input {...input('sellerAgent')} placeholder="Maria Torres" /></Field>
        </div>
        <Field label="Seller agent DRE #"><input {...input('sellerAgentLicense')} placeholder="02198765" /></Field>
      </Section>
      <Section title="Additional terms (optional)">
        <Field>
          <textarea {...input('additionalTerms')} rows={3} placeholder="e.g. Seller to provide 3-day rent back…" />
        </Field>
      </Section>

      {/* Summary */}
      <div className="summary-card">
        <div className="summary-header">
          <div className="summary-address">{form.propertyAddress || 'Address not entered'}</div>
          <div className="summary-city">{[form.propertyCity,'CA',form.propertyZip].filter(Boolean).join(', ')}</div>
        </div>
        <div className="summary-body">
          <div className="sum-row"><span className="sum-key">Offer price</span><span className="sum-val">{fmtDisplay(form.offerPrice)}</span></div>
          <div className="sum-row"><span className="sum-key">Earnest money</span><span className="sum-val">{fmtDisplay(form.emdAmount)} — {form.emdDays} days</span></div>
          <div className="sum-row"><span className="sum-key">Financing</span><span className="sum-val">{form.financeType}</span></div>
          <div className="sum-row"><span className="sum-key">COE</span><span className="sum-val">{form.coeDays} days</span></div>
          <div className="sum-row"><span className="sum-key">Contingencies</span><span className="sum-val">{conLabels.length ? conLabels.join(', ') : 'None (clean offer)'}</span></div>
          <div className="sum-row"><span className="sum-key">Seller</span><span className="sum-val">{form.sellerName || '—'}</span></div>
        </div>
      </div>

      <button
        className={`pdf-btn ${status === 'generating' ? 'pdf-btn--loading' : ''}`}
        onClick={handleGenerate}
        disabled={status === 'generating'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9 15 12 18 15 15"/>
        </svg>
        {status === 'generating' ? 'Filling PDF…' : status === 'done' ? 'Downloaded! Generate again?' : 'Generate & download RPA PDF'}
      </button>

      {status === 'error'   && <div className="status-error">Error: {errMsg}</div>}
      {status === 'done'    && <div className="status-success">PDF downloaded successfully.</div>}

      <div className="remap-hint">
        Fields in wrong position?{' '}
        <button className="remap-link" onClick={onRemap}>Re-open field mapper</button>
      </div>

      <button className="reset-btn" onClick={() => { setForm(INITIAL); setStatus('idle'); goStep(0); }}>
        Start new offer
      </button>
    </div>,
  ];

  const s = STEPS[step];
  return (
    <div className="generator">
      <div className="progress-track">
        {STEPS.map((_,i) => (
          <div key={i} className={`progress-seg ${i < step ? 'done' : i === step ? 'active' : ''}`} />
        ))}
      </div>
      <div className="step-header">
        <span className="step-label">{s.label}</span>
        <h1 className="step-title">{s.title}</h1>
        <p className="step-sub">{s.sub}</p>
      </div>
      <div className="step-body">{steps[step]}</div>
      <div className="step-nav">
        <button className="btn btn--ghost" onClick={() => goStep(step-1)}
          style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>← Back</button>
        <span className="step-counter">{s.label}</span>
        {step < STEPS.length - 1
          ? <button className="btn btn--primary" onClick={() => goStep(step+1)}>Continue →</button>
          : <span />}
      </div>
    </div>
  );
}
