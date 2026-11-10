const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev', 'Pastor', 'Chief', 'Other'];
const RELIGIONS = ['Christian', 'Muslim', 'Traditionalist', 'Bahai', 'None', 'Other'];
const PAYMENTS = ['Cash', 'Employer', 'Insurance', 'Free', 'Other'];
const RELATIONSHIPS = ['Father', 'Mother', 'Husband', 'Wife', 'Son', 'Daughter', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Cousin', 'Friend', 'Self', 'Other'];
const SEXES = [
  ['M', 'Male'],
  ['F', 'Female'],
  ['O', 'Other'],
  ['U', 'Unknown'],
];
const TISSUE_IDS = ['necrotic', 'sloughy', 'granulating', 'epithelialising', 'hypergranulating', 'hematoma', 'boneTendon'];
const CHECK_KEYS = ['exudateLevels', 'exudateTypes', 'periwound', 'infectionSigns', 'objectives', 'healingFactors'];

const $ = (sel) => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function emptyDemographics() {
  return {
    hospitalNumber: '', title: '', givenName: '', middleName: '', familyName: '',
    gender: '', birthdate: '', telephone: '', nationalId: '',
    country: '', region: '', division: '', subdivision: '', village: '', quarter: '',
    villageOfOrigin: '', occupation: '', employer: '', employerNumber: '',
    religion: '', church: '', paymentMethod: '',
    contactName: '', contactRelationship: '', contactPhone: '',
    responsibleParty: '', responsiblePartyRelationship: '',
  };
}

function emptyTissue() {
  return Object.fromEntries(TISSUE_IDS.map((id) => [id, '']));
}

function emptyAssessment() {
  return {
    id: uid(),
    date: today(),
    woundNumber: '',
    etiology: '',
    location: '',
    consent: false,
    length: '', lengthUnit: 'cm',
    width: '', widthUnit: 'cm',
    depth: '', depthUnit: 'cm',
    tracking: '',
    trackingSize: '',
    trackingUnit: 'cm',
    trackingPosition: '',
    tissue: emptyTissue(),
    exudateLevels: [],
    exudateTypes: [],
    periwound: [],
    infectionSigns: [],
    objectives: [],
    analgesia: '',
    analgesiaType: '',
    assessor: '',
    reassessDate: '',
    healingFactors: [],
    healingOther: '',
    allergies: '',
    productsRemoved: '',
    dressingReason: '',
    dressingEvaluation: '',
    dressingSign: '',
    photos: [],
    narrative: '',
  };
}

function emptyPlan(from) {
  return {
    id: uid(),
    date: today(),
    woundNumber: from?.woundNumber || '',
    cleansing: '',
    dressing: '',
    rationale: '',
    frequency: '',
    discussed: '',
    discussComment: '',
    signName: '',
    designation: '',
  };
}

function normalizeAssessment(raw) {
  const next = { ...emptyAssessment(), ...(raw || {}) };
  next.id = raw?.id || next.id;
  next.tissue = { ...emptyTissue(), ...(raw?.tissue || {}) };
  CHECK_KEYS.forEach((key) => { next[key] = Array.isArray(raw?.[key]) ? [...raw[key]] : []; });
  next.photos = Array.isArray(raw?.photos) ? raw.photos : [];
  next.consent = Boolean(raw?.consent);
  return next;
}

function normalizePlan(raw) {
  return { ...emptyPlan(), ...(raw || {}), id: raw?.id || uid() };
}

function blankPatient() {
  return { id: uid(), demographics: emptyDemographics(), plans: [], assessments: [emptyAssessment()] };
}

const store = { selected: 'demographics', patients: [], patientId: '', assessmentId: '' };
let schema = null;
let saveTimer = null;

(function seedWorkspace() {
  const patient = blankPatient();
  store.patients = [patient];
  store.patientId = patient.id;
  store.assessmentId = patient.assessments[0].id;
}());

function currentPatient() {
  return store.patients.find((item) => item.id === store.patientId) || store.patients[0];
}

function currentAssessment() {
  const patient = currentPatient();
  return patient.assessments.find((item) => item.id === store.assessmentId) || patient.assessments[0];
}

function patientName(patient) {
  const d = patient.demographics;
  return [d.givenName, d.familyName].filter(Boolean).join(' ') || d.hospitalNumber || 'New patient';
}

function hasIdentity(patient) {
  const d = patient.demographics || {};
  return [d.givenName, d.familyName, d.hospitalNumber].some((value) => (value || '').trim());
}

function assessmentHasContent(item) {
  if (!item) return false;
  return Boolean(
    (item.woundNumber || '').trim() ||
    (item.etiology || '').trim() ||
    (item.location || '').trim() ||
    (item.length || '').trim() ||
    (item.narrative || '').trim() ||
    (item.photos || []).length ||
    CHECK_KEYS.some((key) => (item[key] || []).length)
  );
}

function patientIsListed(patient) {
  return hasIdentity(patient) || patient.assessments.some(assessmentHasContent) || (patient.plans || []).some((plan) => (plan.dressing || plan.cleansing || '').trim());
}

function assessmentLabel(item) {
  const wound = (item.woundNumber || '').trim() ? `Wound ${item.woundNumber}` : 'Wound not numbered';
  return [item.date, wound, item.location].filter(Boolean).join(' · ');
}

function selectOptions(values, current, placeholder) {
  const label = placeholder || 'Select…';
  const options = [`<option value="">${esc(label)}</option>`].concat((values || []).map((value) => (
    `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(value)}</option>`
  )));
  return options.join('');
}

function textField(label, bind, value, placeholder) {
  return `<div class="field"><label>${esc(label)}</label><input type="text" data-bind="${esc(bind)}" value="${esc(value)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''} /></div>`;
}

function codedField(label, bind, value, options) {
  return `<div class="field"><label>${esc(label)}</label><select data-bind="${esc(bind)}">${selectOptions(options, value)}</select></div>`;
}

function sexField() {
  const d = currentPatient().demographics;
  const options = ['<option value="">Select…</option>'].concat(SEXES.map(([value, label]) => (
    `<option value="${value}"${d.gender === value ? ' selected' : ''}>${label}</option>`
  )));
  return `<div class="field"><label>Sex</label><select data-bind="demographics.gender">${options.join('')}</select></div>`;
}

function checkList(group, options, selected) {
  return `<div class="check-list">${options.map((option) => {
    const id = typeof option === 'string' ? option : option.id;
    const label = typeof option === 'string' ? option : option.label;
    const on = (selected || []).includes(id);
    return `<label><input type="checkbox" data-check="${esc(group)}" value="${esc(id)}"${on ? ' checked' : ''} /> ${esc(label)}</label>`;
  }).join('')}</div>`;
}

function unitSelect(bind, value) {
  return `<select data-bind="${esc(bind)}">${(schema.units || ['cm', 'mm']).map((unit) => (
    `<option value="${esc(unit)}"${unit === value ? ' selected' : ''}>${esc(unit)}</option>`
  )).join('')}</select>`;
}

function measureField(label, valueBind, value, unitBind, unit) {
  return `<div class="field"><label>${esc(label)}</label><div class="measure"><input type="number" min="0" step="0.1" data-bind="${esc(valueBind)}" value="${esc(value)}" />${unitSelect(unitBind, unit)}</div></div>`;
}

function optionLabel(options, id) {
  const found = (options || []).find((option) => (typeof option === 'string' ? option : option.id) === id);
  if (!found) return id;
  return typeof found === 'string' ? found : found.label;
}

function listText(ids, options) {
  return (ids || []).map((id) => optionLabel(options, id)).filter(Boolean).join(', ');
}

function renderDemographics() {
  const d = currentPatient().demographics;
  return `
    <h2>Demographics</h2>
    <p class="lede">Register the patient once. Each wound assessment for this patient uses this same record. Nothing is sent off this computer.</p>
    <h3 class="section-title">Name & identity</h3>
    <div class="grid">
      ${textField('Hospital number', 'demographics.hospitalNumber', d.hospitalNumber)}
      ${codedField('Title', 'demographics.title', d.title, TITLES)}
      ${textField('Given name', 'demographics.givenName', d.givenName)}
      ${textField('Middle name', 'demographics.middleName', d.middleName)}
      ${textField('Family name', 'demographics.familyName', d.familyName)}
      ${sexField()}
      <div class="field"><label>Date of birth</label><input type="date" data-bind="demographics.birthdate" value="${esc(d.birthdate)}" /></div>
      ${textField('Telephone', 'demographics.telephone', d.telephone)}
      ${textField('National ID', 'demographics.nationalId', d.nationalId)}
    </div>
    <h3 class="section-title">Address</h3>
    <div class="grid">
      ${textField('Country', 'demographics.country', d.country)}
      ${textField('Region', 'demographics.region', d.region)}
      ${textField('Division', 'demographics.division', d.division)}
      ${textField('Subdivision', 'demographics.subdivision', d.subdivision)}
      ${textField('Village', 'demographics.village', d.village)}
      ${textField('Quarter', 'demographics.quarter', d.quarter)}
    </div>
    <h3 class="section-title">Additional information (MBH)</h3>
    <div class="grid">
      ${textField('Village of origin', 'demographics.villageOfOrigin', d.villageOfOrigin)}
      ${textField('Occupation', 'demographics.occupation', d.occupation)}
      ${textField('Employer', 'demographics.employer', d.employer)}
      ${textField('Employer #', 'demographics.employerNumber', d.employerNumber)}
      ${codedField('Religion', 'demographics.religion', d.religion, RELIGIONS)}
      ${textField('Church', 'demographics.church', d.church)}
      ${codedField('Payment method', 'demographics.paymentMethod', d.paymentMethod, PAYMENTS)}
    </div>
    <h3 class="section-title">Next of kin & responsible party</h3>
    <div class="grid">
      ${textField('Contact name', 'demographics.contactName', d.contactName)}
      ${codedField('Contact relationship', 'demographics.contactRelationship', d.contactRelationship, RELATIONSHIPS)}
      ${textField('Contact phone', 'demographics.contactPhone', d.contactPhone)}
      ${textField('Responsible party', 'demographics.responsibleParty', d.responsibleParty)}
      ${codedField('RP relationship', 'demographics.responsiblePartyRelationship', d.responsiblePartyRelationship, RELATIONSHIPS)}
    </div>`;
}

function renderAssessment() {
  const item = currentAssessment();
  const patient = currentPatient();
  return `
    <h2>Wound assessment</h2>
    <p class="lede">Complete on the first visit and at every dressing change for ${esc(patientName(patient))}.</p>
    <div class="grid">
      <div class="field"><label>Date of assessment</label><input type="date" data-bind="assessment.date" value="${esc(item.date)}" /></div>
      ${textField('Wound number', 'assessment.woundNumber', item.woundNumber)}
      ${textField('Wound location', 'assessment.location', item.location)}
      ${textField('Assessor initials', 'assessment.assessor', item.assessor)}
      <div class="field"><label>Re-assessment date</label><input type="date" data-bind="assessment.reassessDate" value="${esc(item.reassessDate)}" /></div>
    </div>
    <h3 class="section-title">How and when this wound began</h3>
    <div class="field wide"><label>Wound etiology</label><textarea class="short" data-bind="assessment.etiology">${esc(item.etiology)}</textarea></div>
    <div class="check-list" style="margin-top:1rem">
      <label><input type="checkbox" data-bind="assessment.consent"${item.consent ? ' checked' : ''} /> The patient has consented to this clinical data being recorded digitally.</label>
    </div>
    ${patient.assessments.length > 1 ? '<div class="row-actions"><button type="button" class="btn btn-danger" data-action="remove-assessment">Remove this assessment</button></div>' : ''}`;
}

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function priorAssessment() {
  const current = currentAssessment();
  const wound = (current.woundNumber || '').trim();
  if (!wound) return null;
  const others = currentPatient().assessments.filter((item) => item.id !== current.id && (item.woundNumber || '').trim() === wound);
  others.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return others.find((item) => (item.date || '') <= (current.date || '9999-99-99')) || others[0] || null;
}

function sizePhrase(item) {
  const part = (value, unit, name) => (value === '' || value == null ? '' : `${name} ${value} ${unit || 'cm'}`);
  return [part(item.length, item.lengthUnit, 'length'), part(item.width, item.widthUnit, 'width'), part(item.depth, item.depthUnit, 'depth')].filter(Boolean).join(', ');
}

function progressLines(current, prior) {
  if (!prior) return [];
  const lines = [];
  [['length', 'lengthUnit', 'Length'], ['width', 'widthUnit', 'Width'], ['depth', 'depthUnit', 'Depth']].forEach(([field, unitField, label]) => {
    const now = numberOrNull(current[field]);
    const then = numberOrNull(prior[field]);
    if (now == null || then == null) return;
    if ((current[unitField] || 'cm') !== (prior[unitField] || 'cm')) return;
    const delta = Math.round((now - then) * 100) / 100;
    const sign = delta > 0 ? '+' : '';
    lines.push(`${label} ${sign}${delta} ${current[unitField] || 'cm'}`);
  });
  return lines;
}

function renderBed() {
  const item = currentAssessment();
  const prior = priorAssessment();
  const entered = schema.tissueTypes.filter((type) => item.tissue[type.id] !== '' && item.tissue[type.id] != null);
  const sum = entered.reduce((total, type) => total + (Number(item.tissue[type.id]) || 0), 0);
  const sumNote = !entered.length ? '' : `<p class="${sum === 100 ? 'hint' : 'warn'}">Tissue percentages total ${sum}${sum === 100 ? '.' : '. The bed is expected to total 100%.'}</p>`;
  const priorSize = prior ? sizePhrase(prior) : '';
  const change = prior ? progressLines(item, prior) : [];
  const progress = prior && (priorSize || change.length) ? `<p class="statement">Previous ${esc(prior.date || 'visit')}${priorSize ? `: ${esc(priorSize)}` : ''}.${change.length ? ` Change: ${esc(change.join('; '))}.` : ''}</p>` : '';
  return `
    <h2>Wound bed</h2>
    <p class="lede">Enter the size and the percentage of each tissue on the wound bed.</p>
    ${progress}
    <div class="grid">
      ${measureField('Length', 'assessment.length', item.length, 'assessment.lengthUnit', item.lengthUnit)}
      ${measureField('Width', 'assessment.width', item.width, 'assessment.widthUnit', item.widthUnit)}
      ${measureField('Depth', 'assessment.depth', item.depth, 'assessment.depthUnit', item.depthUnit)}
    </div>
    <h3 class="section-title">Tracking / undermining</h3>
    <div class="grid">
      <div class="field"><label>Is the wound tracking or undermining?</label><select data-bind="assessment.tracking">${selectOptions(schema.yesNo, item.tracking)}</select></div>
      ${item.tracking === 'Yes' ? measureField('Distance', 'assessment.trackingSize', item.trackingSize, 'assessment.trackingUnit', item.trackingUnit) : ''}
      ${item.tracking === 'Yes' ? textField('Position in the wound', 'assessment.trackingPosition', item.trackingPosition) : ''}
    </div>
    <h3 class="section-title">Tissue type (%)</h3>
    <div class="grid">
      ${schema.tissueTypes.map((type) => `<div class="field"><label>${esc(type.label)}</label><input type="number" min="0" max="100" step="1" data-tissue="${esc(type.id)}" value="${esc(item.tissue[type.id])}" /></div>`).join('')}
    </div>
    ${sumNote}`;
}

function renderChecks(title, lede, group, options, extra) {
  const item = currentAssessment();
  return `
    <h2>${esc(title)}</h2>
    <p class="lede">${lede}</p>
    ${extra || ''}
    ${checkList(group, options, item[group])}`;
}

function renderExudate() {
  const item = currentAssessment();
  return `
    <h2>Wound exudate</h2>
    <p class="lede">Tick every level and type that applies.</p>
    <h3 class="section-title">Level</h3>
    ${checkList('exudateLevels', schema.exudateLevels, item.exudateLevels)}
    <h3 class="section-title">Type</h3>
    ${checkList('exudateTypes', schema.exudateTypes, item.exudateTypes)}`;
}

function renderInfection() {
  const item = currentAssessment();
  const count = item.infectionSigns.length;
  const banner = count >= 2 ? '<p class="statement">Two or more signs are marked. This may indicate infection.</p>' : '<p class="hint">Two or more of these signs may indicate possible infection.</p>';
  return renderChecks('Signs of infection', 'Tick each sign present at this dressing change.', 'infectionSigns', schema.infectionSigns, banner);
}

function renderObjectives() {
  const item = currentAssessment();
  return `
    <h2>Treatment objectives</h2>
    <p class="lede">Tick each objective for this wound.</p>
    ${checkList('objectives', schema.objectives, item.objectives)}
    <h3 class="section-title">Analgesia</h3>
    <div class="grid">
      <div class="field"><label>Analgesia required</label><select data-bind="assessment.analgesia">${selectOptions(schema.yesNo, item.analgesia)}</select></div>
      ${textField('Type of analgesia / anesthesia', 'assessment.analgesiaType', item.analgesiaType)}
    </div>`;
}

function renderFactors() {
  const item = currentAssessment();
  return `
    <h2>Factors which could delay healing</h2>
    <p class="lede">Tick every factor that applies to this patient.</p>
    ${checkList('healingFactors', schema.healingFactors, item.healingFactors)}
    <div class="grid" style="margin-top:1rem">
      ${textField('Other factor', 'assessment.healingOther', item.healingOther)}
    </div>
    <h3 class="section-title">Allergies and sensitivities</h3>
    <div class="field"><label>Allergies & sensitivities</label><textarea class="short" data-bind="assessment.allergies">${esc(item.allergies)}</textarea></div>`;
}

function renderPlan(plan) {
  return `
    <h2>Wound treatment plan</h2>
    <p class="lede">Complete on the first assessment and when the cleansing method or dressing regime changes. A routine dressing change does not need a new plan.</p>
    <div class="grid">
      <div class="field"><label>Date</label><input type="date" data-kind="plan" data-id="${plan.id}" data-field="date" value="${esc(plan.date)}" /></div>
      <div class="field"><label>Wound number</label><input type="text" data-kind="plan" data-id="${plan.id}" data-field="woundNumber" value="${esc(plan.woundNumber)}" /></div>
      <div class="field"><label>Frequency</label><input type="text" data-kind="plan" data-id="${plan.id}" data-field="frequency" value="${esc(plan.frequency)}" /></div>
      <div class="field"><label>Care plan discussed with patient / carer</label><select data-kind="plan" data-id="${plan.id}" data-field="discussed">${selectOptions(schema.yesNo, plan.discussed)}</select></div>
      <div class="field"><label>Comment</label><input type="text" data-kind="plan" data-id="${plan.id}" data-field="discussComment" value="${esc(plan.discussComment)}" /></div>
      <div class="field"><label>Sign / print name</label><input type="text" data-kind="plan" data-id="${plan.id}" data-field="signName" value="${esc(plan.signName)}" /></div>
      <div class="field"><label>Designation</label><input type="text" data-kind="plan" data-id="${plan.id}" data-field="designation" value="${esc(plan.designation)}" /></div>
    </div>
    <h3 class="section-title">Cleansing, dressing, and rationale</h3>
    <div class="field"><label>Cleansing method</label><textarea class="short" data-kind="plan" data-id="${plan.id}" data-field="cleansing">${esc(plan.cleansing)}</textarea></div>
    <div class="field"><label>Dressing choice</label><textarea class="short" data-kind="plan" data-id="${plan.id}" data-field="dressing">${esc(plan.dressing)}</textarea></div>
    <div class="field"><label>Rationale</label><textarea class="short" data-kind="plan" data-id="${plan.id}" data-field="rationale">${esc(plan.rationale)}</textarea></div>
    <div class="row-actions"><button type="button" class="btn btn-danger" data-action="remove-plan" data-id="${plan.id}">Remove this plan</button></div>`;
}

function renderDressing() {
  const item = currentAssessment();
  return `
    <h2>Dressing change</h2>
    <p class="lede">Complete at every dressing change.</p>
    <div class="grid">
      <div class="field"><label>Date</label><input type="date" data-bind="assessment.date" value="${esc(item.date)}" /></div>
      ${textField('Wound number', 'assessment.woundNumber', item.woundNumber)}
      ${textField('Products removed (sheets / ribbons)', 'assessment.productsRemoved', item.productsRemoved)}
      ${textField('Sign and print name', 'assessment.dressingSign', item.dressingSign)}
    </div>
    <h3 class="section-title">Reason and evaluation</h3>
    <div class="field"><label>Reason for dressing change</label><textarea class="short" data-bind="assessment.dressingReason" placeholder="Include whether a swab or photograph was taken">${esc(item.dressingReason)}</textarea></div>
    <div class="field"><label>Evaluation / comment</label><textarea class="short" data-bind="assessment.dressingEvaluation">${esc(item.dressingEvaluation)}</textarea></div>`;
}

function renderImages() {
  const item = currentAssessment();
  const cards = item.photos.map((photo) => `
    <article class="photo-card">
      <img src="${photo.dataUrl}" alt="${esc(photo.caption || photo.name || 'Wound photo')}" />
      <input type="text" data-photo-caption="${photo.id}" value="${esc(photo.caption)}" placeholder="Caption" />
      <div class="row-actions"><button type="button" class="btn btn-danger" data-action="remove-photo" data-id="${photo.id}">Remove</button></div>
    </article>`).join('');
  return `
    <h2>Images</h2>
    <p class="lede">Import wound photographs from this computer. They stay in this browser with the assessment.</p>
    <input id="photo-input" type="file" accept="image/*" multiple />
    ${cards ? `<div class="photos">${cards}</div>` : '<div class="empty">No photographs yet.</div>'}`;
}

function renderNarrative() {
  const item = currentAssessment();
  return `
    <h2>Free text</h2>
    <p class="lede">Anything that does not fit the wound form, at the end of this assessment.</p>
    <div class="field"><label>Narrative</label><textarea data-bind="assessment.narrative">${esc(item.narrative)}</textarea></div>`;
}

function line(label, value) {
  return value ? `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>` : '';
}

function renderPreview() {
  const patient = currentPatient();
  const d = patient.demographics;
  const item = currentAssessment();
  const prior = priorAssessment();
  const change = prior ? progressLines(item, prior) : [];
  const plans = patient.plans.filter((plan) => !(item.woundNumber || '').trim() || plan.woundNumber === item.woundNumber || !(plan.woundNumber || '').trim());
  const photos = item.photos.map((photo) => `<figure><img src="${photo.dataUrl}" alt="${esc(photo.caption || photo.name || 'Wound photo')}" /><figcaption>${esc(photo.caption || photo.name || '')}</figcaption></figure>`).join('');
  const who = [d.title, d.givenName, d.middleName, d.familyName].filter(Boolean).join(' ');
  return `
    <h2>Preview</h2>
    <article class="note">
      <p><strong>${esc(who || patientName(patient))}</strong>${d.hospitalNumber ? ` · ${esc(d.hospitalNumber)}` : ''}${d.gender ? ` · ${esc(SEXES.find((pair) => pair[0] === d.gender)?.[1] || d.gender)}` : ''}${d.birthdate ? ` · ${esc(d.birthdate)}` : ''}</p>
      <h3>Wound assessment ${esc(item.date || '')}</h3>
      ${line('Wound', [item.woundNumber && `No. ${item.woundNumber}`, item.location].filter(Boolean).join(', '))}
      ${line('Etiology', item.etiology)}
      ${line('Size', sizePhrase(item))}
      ${item.tracking === 'Yes' ? line('Tracking / undermining', [item.trackingSize && `${item.trackingSize} ${item.trackingUnit || 'cm'}`, item.trackingPosition].filter(Boolean).join(', ')) : (item.tracking === 'No' ? line('Tracking / undermining', 'No') : '')}
      ${line('Tissue', schema.tissueTypes.map((type) => (item.tissue[type.id] !== '' && item.tissue[type.id] != null ? `${type.label} ${item.tissue[type.id]}%` : '')).filter(Boolean).join('; '))}
      ${prior ? `<p class="statement">Compared with ${esc(prior.date || 'the previous visit')}${sizePhrase(prior) ? ` (${esc(sizePhrase(prior))})` : ''}.${change.length ? ` ${esc(change.join('; '))}.` : ''}</p>` : ''}
      ${line('Exudate level', listText(item.exudateLevels, schema.exudateLevels))}
      ${line('Exudate type', listText(item.exudateTypes, schema.exudateTypes))}
      ${line('Peri-wound skin', listText(item.periwound, schema.periwound))}
      ${line('Infection signs', listText(item.infectionSigns, schema.infectionSigns))}
      ${item.infectionSigns.length >= 2 ? '<p class="statement">Two or more infection signs are marked.</p>' : ''}
      ${line('Objectives', listText(item.objectives, schema.objectives))}
      ${line('Analgesia', [item.analgesia, item.analgesiaType].filter(Boolean).join(' — '))}
      ${line('Factors delaying healing', [listText(item.healingFactors, schema.healingFactors), item.healingOther].filter(Boolean).join('; '))}
      ${line('Allergies', item.allergies)}
      ${line('Consent recorded', item.consent ? 'Yes' : '')}
      ${line('Assessor', item.assessor)}
      ${line('Re-assessment', item.reassessDate)}
      <h3>Dressing change</h3>
      ${line('Products removed', item.productsRemoved)}
      ${line('Reason', item.dressingReason)}
      ${line('Evaluation', item.dressingEvaluation)}
      ${line('Signed', item.dressingSign)}
      ${plans.length ? `<h3>Treatment plan</h3>${plans.map((plan) => `<h4>Wound ${esc(plan.woundNumber || '—')} · ${esc(plan.date || '')}</h4>${line('Cleansing', plan.cleansing)}${line('Dressing', plan.dressing)}${line('Rationale', plan.rationale)}${line('Frequency', plan.frequency)}${line('Discussed', [plan.discussed, plan.discussComment].filter(Boolean).join(' — '))}${line('Signed', [plan.signName, plan.designation].filter(Boolean).join(', '))}`).join('')}` : ''}
      ${item.narrative ? `<h3>Free text</h3><p>${esc(item.narrative)}</p>` : ''}
      ${photos ? `<h3>Images</h3>${photos}` : ''}
    </article>`;
}

function renderMain() {
  const main = $('#main');
  const scroll = main.scrollTop;
  const key = store.selected;
  let html = '';
  if (key === 'demographics') html = renderDemographics();
  else if (key === 'assessment') html = renderAssessment();
  else if (key === 'bed') html = renderBed();
  else if (key === 'exudate') html = renderExudate();
  else if (key === 'periwound') html = renderChecks('Peri-wound skin', 'Tick every description that applies.', 'periwound', schema.periwound);
  else if (key === 'infection') html = renderInfection();
  else if (key === 'objectives') html = renderObjectives();
  else if (key === 'factors') html = renderFactors();
  else if (key === 'dressing') html = renderDressing();
  else if (key === 'images') html = renderImages();
  else if (key === 'narrative') html = renderNarrative();
  else if (key === 'preview') html = renderPreview();
  else if (key.startsWith('plan:')) {
    const plan = currentPatient().plans.find((item) => item.id === key.slice(5));
    html = plan ? renderPlan(plan) : '<div class="empty">This treatment plan is no longer in the chart.</div>';
  }
  main.innerHTML = html;
  main.scrollTop = scroll;
}

function treeButton(id, label, sub) {
  const active = store.selected === id ? ' active' : '';
  return `<button type="button" class="tree-label${active}" data-select="${esc(id)}"><span><strong>${esc(label)}</strong>${sub ? `<br><small>${esc(sub)}</small>` : ''}</span></button>`;
}

function bedSummary(item) {
  return sizePhrase(item) || 'Size and tissue';
}

function renderTree() {
  const patient = currentPatient();
  const item = currentAssessment();
  const visible = store.patients.filter(patientIsListed);
  const patients = visible.map((entry) => `<button type="button" class="tree-item${entry.id === patient.id ? ' active' : ''}" data-action="open-patient" data-id="${entry.id}"><span>${esc(patientName(entry))}</span></button>`).join('');
  const assessments = patient.assessments.map((entry) => `<button type="button" class="tree-item${entry.id === item.id ? ' active' : ''}" data-action="open-assessment" data-id="${entry.id}"><span>${esc(assessmentLabel(entry))}</span></button>`).join('');
  const plans = patient.plans.map((plan) => {
    const label = [plan.date, plan.woundNumber ? `Wound ${plan.woundNumber}` : 'New plan', plan.dressing].filter(Boolean).join(' · ');
    return `<button type="button" class="tree-item${store.selected === `plan:${plan.id}` ? ' active' : ''}" data-select="plan:${plan.id}"><span>${esc(label)}</span></button>`;
  }).join('');
  $('#tree').innerHTML = `
    <div class="tree-section">
      <div class="tree-label static"><span><strong>Patients</strong><br><small>${visible.length} registered</small></span></div>
      ${patients}
      <button type="button" class="tree-add" data-action="add-patient">+ Register patient</button>
    </div>
    <div class="tree-section">
      ${treeButton('demographics', 'Demographics', patientName(patient) === 'New patient' ? '' : patientName(patient))}
      <div class="tree-label static"><span><strong>Assessments</strong><br><small>One patient, each dressing change</small></span></div>
      ${assessments}
      <button type="button" class="tree-add" data-action="add-assessment">+ Add assessment</button>
    </div>
    <div class="tree-section">
      ${treeButton('assessment', 'Wound assessment', item.date || 'Date')}
      ${treeButton('bed', 'Wound bed', bedSummary(item))}
      ${treeButton('exudate', 'Exudate', listText(item.exudateLevels, schema.exudateLevels) || 'Level and type')}
      ${treeButton('periwound', 'Peri-wound skin', listText(item.periwound, schema.periwound) || 'Surrounding skin')}
      ${treeButton('infection', 'Infection signs', item.infectionSigns.length ? `${item.infectionSigns.length} marked` : 'None marked')}
      ${treeButton('objectives', 'Treatment objectives', listText(item.objectives, schema.objectives) || 'Goals')}
      ${treeButton('factors', 'Healing factors', listText(item.healingFactors, schema.healingFactors) || 'Delays and allergies')}
      <div class="tree-label static"><span><strong>Treatment plan</strong><br><small>When the regime changes</small></span></div>
      ${plans}
      <button type="button" class="tree-add" data-action="add-plan">+ Add treatment plan</button>
      ${treeButton('dressing', 'Dressing change', item.dressingSign || 'This visit')}
    </div>
    <div class="tree-section">${treeButton('images', 'Images', item.photos.length ? `${item.photos.length} photo${item.photos.length === 1 ? '' : 's'}` : 'Import photos')}</div>
    <div class="tree-section">${treeButton('narrative', 'Free text', item.narrative ? 'Narrative entered' : 'End of assessment')}</div>`;
}

function render() {
  renderTree();
  renderMain();
}

function addPatient() {
  const draft = store.patients.find((item) => !patientIsListed(item));
  const patient = draft || blankPatient();
  if (!draft) store.patients.push(patient);
  store.patientId = patient.id;
  store.assessmentId = patient.assessments[0].id;
  store.selected = 'demographics';
  render();
  scheduleSave();
}

function addAssessment() {
  const previous = currentAssessment();
  const item = emptyAssessment();
  if (previous) {
    item.woundNumber = previous.woundNumber;
    item.etiology = previous.etiology;
    item.location = previous.location;
    item.healingFactors = [...previous.healingFactors];
    item.healingOther = previous.healingOther;
    item.allergies = previous.allergies;
    item.consent = previous.consent;
    item.lengthUnit = previous.lengthUnit;
    item.widthUnit = previous.widthUnit;
    item.depthUnit = previous.depthUnit;
    item.trackingUnit = previous.trackingUnit;
  }
  currentPatient().assessments.push(item);
  store.assessmentId = item.id;
  store.selected = 'assessment';
  render();
  scheduleSave();
}

function addPlan() {
  const plan = emptyPlan(currentAssessment());
  currentPatient().plans.push(plan);
  store.selected = `plan:${plan.id}`;
  render();
  scheduleSave();
}

function openPatient(id) {
  const patient = store.patients.find((item) => item.id === id);
  if (!patient || !patient.assessments.length) return;
  store.patientId = patient.id;
  if (!patient.assessments.some((item) => item.id === store.assessmentId)) {
    store.assessmentId = patient.assessments[patient.assessments.length - 1].id;
  }
  store.selected = 'demographics';
  render();
}

function openAssessment(id) {
  if (!currentPatient().assessments.some((item) => item.id === id)) return;
  store.assessmentId = id;
  store.selected = 'assessment';
  render();
}

function removeAssessment() {
  const patient = currentPatient();
  if (patient.assessments.length < 2) return;
  const label = assessmentLabel(currentAssessment());
  if (!confirm(`Remove ${label}? The patient registration stays.`)) return;
  const removed = store.assessmentId;
  patient.assessments = patient.assessments.filter((item) => item.id !== removed);
  store.assessmentId = patient.assessments[0].id;
  store.selected = 'assessment';
  render();
  scheduleSave();
}

function removePlan(id) {
  const patient = currentPatient();
  patient.plans = patient.plans.filter((plan) => plan.id !== id);
  store.selected = 'objectives';
  render();
  scheduleSave();
}

function assignBind(target) {
  const value = target.type === 'checkbox' ? target.checked : target.value;
  const [root, field] = target.dataset.bind.split('.');
  if (root === 'demographics') currentPatient().demographics[field] = value;
  if (root === 'assessment') currentAssessment()[field] = value;
}

function onEdit(event) {
  const target = event.target;
  if (!target.dataset || target.id === 'photo-input') return;
  if (target.type === 'checkbox' && event.type === 'input') return;
  let structural = target.tagName === 'SELECT' || target.type === 'checkbox' || (target.type === 'number' && event.type === 'change');
  if (target.dataset.check) {
    const item = currentAssessment();
    const key = target.dataset.check;
    const list = item[key] || [];
    item[key] = target.checked ? list.concat(list.includes(target.value) ? [] : [target.value]) : list.filter((value) => value !== target.value);
  } else if (target.dataset.tissue) {
    currentAssessment().tissue[target.dataset.tissue] = target.value;
    structural = event.type === 'change';
  } else if (target.dataset.photoCaption) {
    const photo = currentAssessment().photos.find((item) => item.id === target.dataset.photoCaption);
    if (photo) photo.caption = target.value;
    structural = false;
  } else if (target.dataset.kind === 'plan') {
    const plan = currentPatient().plans.find((item) => item.id === target.dataset.id);
    if (!plan) return;
    plan[target.dataset.field] = target.value;
    structural = target.tagName === 'SELECT';
  } else if (target.dataset.bind) {
    assignBind(target);
  } else return;
  renderTree();
  if (structural) renderMain();
  scheduleSave();
}

async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image'));
      img.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function importPhotos(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await shrinkImage(file);
    currentAssessment().photos.push({ id: uid(), name: file.name, caption: '', dataUrl });
  }
  render();
  scheduleSave();
}

function chartPayload() {
  return {
    version: 1,
    patientId: store.patientId,
    assessmentId: store.assessmentId,
    patients: store.patients.map((patient) => ({
      id: patient.id,
      demographics: patient.demographics,
      plans: patient.plans,
      assessments: patient.assessments.map((item) => ({
        ...item,
        photos: item.photos.map((photo) => ({ id: photo.id, name: photo.name, caption: photo.caption, dataUrl: photo.dataUrl })),
      })),
    })),
  };
}

function payloadWithoutPhotoData(payload) {
  return {
    ...payload,
    patients: payload.patients.map((patient) => ({
      ...patient,
      assessments: patient.assessments.map((item) => ({
        ...item,
        photos: (item.photos || []).map(({ dataUrl, ...rest }) => rest),
      })),
    })),
  };
}

function scheduleSave() {
  $('#save-state').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveLocal().catch(() => { $('#save-state').textContent = 'Could not save in this browser'; }); }, 350);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wound-care', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('charts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocal() {
  const payload = chartPayload();
  localStorage.setItem('wound-care-doc-v1', JSON.stringify(payloadWithoutPhotoData(payload)));
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('charts', 'readwrite');
    tx.objectStore('charts').put(payload, 'current');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  $('#save-state').textContent = 'Saved in this browser';
}

async function loadLocal() {
  try {
    const db = await openDb();
    const stored = await new Promise((resolve, reject) => {
      const tx = db.transaction('charts', 'readonly');
      const request = tx.objectStore('charts').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (stored) applyPayload(stored);
    else applyStoredText();
  } catch (error) {
    applyStoredText();
  }
}

function applyStoredText() {
  const raw = localStorage.getItem('wound-care-doc-v1');
  if (raw) applyPayload(JSON.parse(raw));
}

function applyPayload(payload) {
  if (!payload || !Array.isArray(payload.patients)) return;
  store.patients = payload.patients.map((patient) => ({
    id: patient.id || uid(),
    demographics: { ...emptyDemographics(), ...(patient.demographics || {}) },
    plans: (patient.plans || []).map(normalizePlan),
    assessments: (patient.assessments && patient.assessments.length ? patient.assessments : [emptyAssessment()]).map(normalizeAssessment),
  }));
  if (!store.patients.length) store.patients = [blankPatient()];
  store.patientId = store.patients.some((item) => item.id === payload.patientId) ? payload.patientId : store.patients[0].id;
  const patient = currentPatient();
  store.assessmentId = patient.assessments.some((item) => item.id === payload.assessmentId) ? payload.assessmentId : patient.assessments[0].id;
}

function downloadName() {
  const d = currentPatient().demographics;
  const item = currentAssessment();
  const who = d.hospitalNumber || d.familyName || 'chart';
  const wound = (item.woundNumber || '').trim() ? `-w${item.woundNumber}` : '';
  return `wound-care-${who}-${item.date || 'undated'}${wound}`;
}

function downloadChart() {
  const patient = currentPatient();
  const note = {
    demographics: patient.demographics,
    plans: patient.plans,
    assessment: currentAssessment(),
  };
  const blob = new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${downloadName()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  const headers = ['Record', 'Hospital number', 'Given name', 'Family name', 'Sex', 'Date', 'Wound number', 'Location', 'Etiology', 'Length', 'Length unit', 'Width', 'Width unit', 'Depth', 'Depth unit', 'Tracking', 'Tracking size', 'Tracking unit', 'Tracking position', 'Necrotic %', 'Sloughy %', 'Granulating %', 'Epithelialising %', 'Hypergranulating %', 'Hematoma %', 'Bone/tendon %', 'Exudate level', 'Exudate type', 'Peri-wound', 'Infection signs', 'Objectives', 'Analgesia', 'Analgesia type', 'Assessor', 'Re-assessment date', 'Healing factors', 'Other factor', 'Allergies', 'Consent', 'Products removed', 'Dressing reason', 'Evaluation', 'Dressing sign', 'Narrative', 'Cleansing', 'Dressing choice', 'Rationale', 'Frequency', 'Care plan discussed', 'Discuss comment', 'Plan sign', 'Designation'];
  const rows = [headers];
  store.patients.forEach((patient) => {
    const d = patient.demographics;
    patient.assessments.forEach((item) => {
      rows.push(['Assessment', d.hospitalNumber, d.givenName, d.familyName, d.gender, item.date, item.woundNumber, item.location, item.etiology, item.length, item.lengthUnit, item.width, item.widthUnit, item.depth, item.depthUnit, item.tracking, item.trackingSize, item.trackingUnit, item.trackingPosition, item.tissue.necrotic, item.tissue.sloughy, item.tissue.granulating, item.tissue.epithelialising, item.tissue.hypergranulating, item.tissue.hematoma, item.tissue.boneTendon, listText(item.exudateLevels, schema.exudateLevels), listText(item.exudateTypes, schema.exudateTypes), listText(item.periwound, schema.periwound), listText(item.infectionSigns, schema.infectionSigns), listText(item.objectives, schema.objectives), item.analgesia, item.analgesiaType, item.assessor, item.reassessDate, listText(item.healingFactors, schema.healingFactors), item.healingOther, item.allergies, item.consent ? 'Yes' : 'No', item.productsRemoved, item.dressingReason, item.dressingEvaluation, item.dressingSign, item.narrative, '', '', '', '', '', '', '', '']);
    });
    patient.plans.forEach((plan) => {
      const blank = Array(37).fill('');
      rows.push(['Treatment plan', d.hospitalNumber, d.givenName, d.familyName, d.gender, plan.date, plan.woundNumber].concat(blank, [plan.cleansing, plan.dressing, plan.rationale, plan.frequency, plan.discussed, plan.discussComment, plan.signName, plan.designation]));
    });
  });
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `wound-care-records-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function fillPrint() {
  $('#print-root').innerHTML = `<h1>Mbingo Baptist Hospital — Wound Care</h1>${renderPreview().replace('<h2>Preview</h2>', '')}`;
}

function wire() {
  $('#tree').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    const select = event.target.closest('[data-select]');
    if (action && action.dataset.action === 'add-patient') { addPatient(); return; }
    if (action && action.dataset.action === 'add-assessment') { addAssessment(); return; }
    if (action && action.dataset.action === 'add-plan') { addPlan(); return; }
    if (action && action.dataset.action === 'open-patient') { openPatient(action.dataset.id); return; }
    if (action && action.dataset.action === 'open-assessment') { openAssessment(action.dataset.id); return; }
    if (select) {
      store.selected = select.dataset.select;
      render();
    }
  });
  $('#main').addEventListener('input', onEdit);
  $('#main').addEventListener('change', (event) => {
    if (event.target.id === 'photo-input') {
      importPhotos(event.target.files);
      event.target.value = '';
      return;
    }
    onEdit(event);
  });
  $('#main').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.action === 'remove-assessment') removeAssessment();
    if (button.dataset.action === 'remove-plan') removePlan(button.dataset.id);
    if (button.dataset.action === 'remove-photo') {
      const item = currentAssessment();
      item.photos = item.photos.filter((photo) => photo.id !== button.dataset.id);
      render();
      scheduleSave();
    }
  });
  $('#btn-new').addEventListener('click', addPatient);
  $('#btn-assessment').addEventListener('click', addAssessment);
  $('#btn-preview').addEventListener('click', () => { store.selected = 'preview'; render(); });
  $('#btn-print').addEventListener('click', () => { fillPrint(); window.print(); });
  $('#btn-download').addEventListener('click', downloadChart);
  $('#btn-csv').addEventListener('click', exportCsv);
}

let wired = false;

async function start() {
  if (!schema) {
    const response = await fetch('data/schema.json');
    if (!response.ok) throw new Error('Could not load the wound form');
    schema = await response.json();
    await loadLocal();
  }
  if (!wired) {
    wire();
    wired = true;
  }
  render();
  $('#save-state').textContent = localStorage.getItem('wound-care-doc-v1') ? 'Saved in this browser' : 'Not saved yet';
}

const SESSION_KEY = 'wound-care-session';
const ACCOUNTS = [
  { username: 'woundcare', passwordHash: '0c8484607f38cb4e470ec1c0ea6387b1c52d95d3ce323a9388dd77b6fe1a7335' },
];

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

function showLogin() {
  $('#app').hidden = true;
  $('#login-screen').hidden = false;
}

async function passwordHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function credentialsMatch(username, password) {
  const hash = await passwordHash(password);
  const name = username.trim().toLowerCase();
  return ACCOUNTS.some((account) => account.username === name && account.passwordHash === hash);
}

async function enterApp() {
  const session = readSession();
  if (!session) return showLogin();
  $('#login-screen').hidden = true;
  $('#app').hidden = false;
  $('#session-label').textContent = `${session.username} · ${session.location}`;
  try {
    await start();
  } catch (error) {
    $('#main').innerHTML = `<h2>Could not open the wound form</h2><p>${esc(error.message)}</p><p>Open this program through the local server so <code>data/schema.json</code> can load.</p>`;
  }
}

async function attemptLogin(event) {
  event.preventDefault();
  const username = $('#login-user').value.trim();
  const password = $('#login-pass').value;
  const location = $('#login-location').value;
  const error = $('#login-error');
  if (!username || !password || !location) {
    error.textContent = 'Enter your username, password, and location.';
    error.hidden = false;
    return;
  }
  if (!(await credentialsMatch(username, password))) {
    error.textContent = 'Invalid username or password. Please try again.';
    error.hidden = false;
    $('#login-pass').value = '';
    $('#login-pass').focus();
    return;
  }
  error.hidden = true;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: username.toLowerCase(), location }));
  $('#login-pass').value = '';
  await enterApp();
}

async function signOut() {
  if (schema) {
    clearTimeout(saveTimer);
    try { await saveLocal(); } catch { /* the last successful save remains */ }
  }
  sessionStorage.removeItem(SESSION_KEY);
  $('#login-user').value = '';
  $('#login-pass').value = '';
  $('#login-error').hidden = true;
  showLogin();
  $('#login-user').focus();
}

$('#login-form').addEventListener('submit', (event) => {
  attemptLogin(event).catch(() => {
    const error = $('#login-error');
    error.textContent = 'Could not check the sign-in. Reload the page and try again.';
    error.hidden = false;
  });
});
$('#btn-signout').addEventListener('click', () => { signOut(); });

if (readSession()) enterApp();
else {
  showLogin();
  $('#login-user').focus();
}
