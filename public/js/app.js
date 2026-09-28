import { captureLocation } from './location.js';
import { deleteReport, getReports, saveReport } from './storage.js';
import { nearestUtility } from './utility-matcher.js';

const $ = (selector) => document.querySelector(selector);
const reportDialog = $('#report-dialog');
const reportForm = $('#report-form');
const detailDialog = $('#detail-dialog');
const archiveDialog = $('#archive-dialog');
const photoInput = $('#photo');
const descriptionInput = $('#description');
const saveButton = $('#save-report');
const locationStatus = $('#location-status');
const formError = $('#form-error');
const utilityCard = $('#utility-match');
const photoPreview = $('#photo-preview');
const photoImage = $('#photo-image');
const reportList = $('#report-list');
const archiveList = $('#archive-list');
const objectUrls = new Map();

let currentLocation = null;
let selectedUtility = null;
let openReport = null;
let utilities = [];
let toastTimer;

function dateLabel(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function setError(message = '') {
  formError.textContent = message;
  formError.hidden = !message;
}

function updateSaveState() {
  saveButton.disabled = !(currentLocation && photoInput.files?.[0] && descriptionInput.value.trim());
}

function updateMatch() {
  selectedUtility = currentLocation ? nearestUtility(currentLocation, utilities) : null;
  if (!selectedUtility) {
    utilityCard.hidden = !currentLocation;
    utilityCard.replaceChildren();
    if (currentLocation) {
      const title = document.createElement('strong');
      title.textContent = 'No utility contact is listed';
      const detail = document.createElement('span');
      detail.textContent = 'The report can be saved on this device, but no email destination is available. We will not guess one.';
      utilityCard.append(title, detail);
    }
    return;
  }

  utilityCard.hidden = false;
  utilityCard.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = selectedUtility.name;
  const distance = document.createElement('span');
  distance.textContent = `${selectedUtility.distanceKm < 10 ? selectedUtility.distanceKm.toFixed(1) : Math.round(selectedUtility.distanceKm)} km from an approximate sample point in ${selectedUtility.serviceArea}.`;
  const email = document.createElement('span');
  email.textContent = selectedUtility.email ? `Water fault email: ${selectedUtility.email}` : 'No email contact is listed.';
  const caveat = document.createElement('span');
  caveat.className = 'match-caveat';
  caveat.textContent = `${selectedUtility.directoryLabel} This estimate does not verify which utility is responsible for this location.`;
  utilityCard.append(title, distance, email, caveat);
}

function imageUrl(report) {
  if (!report.photo) return '';
  if (!objectUrls.has(report.id)) objectUrls.set(report.id, URL.createObjectURL(report.photo));
  return objectUrls.get(report.id);
}

function makeReportCard(report) {
  const card = document.createElement('article');
  card.className = 'report-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open report: ${report.description || 'Water problem'}`);
  const img = document.createElement('img');
  img.className = 'report-thumb';
  img.alt = '';
  const url = imageUrl(report);
  if (url) img.src = url;
  const content = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'report-title';
  title.textContent = report.description || 'Water problem report';
  const meta = document.createElement('p');
  meta.className = 'report-meta';
  const utility = utilities.find((item) => item.id === report.utilityId);
  meta.textContent = `${dateLabel(report.createdAt)}${utility ? ` · ${utility.name}` : ''}`;
  const status = document.createElement('span');
  status.className = 'status-pill';
  status.textContent = report.status === 'fixed' ? 'Fixed' : 'Pending';
  content.append(title, meta);
  card.append(img, content, status);
  const open = () => showReport(report);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
  return card;
}

async function refreshReports() {
  const all = await getReports();
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = all.filter((report) => report.status !== 'fixed');
  const archived = all.filter((report) => report.status === 'fixed');
  reportList.replaceChildren(...active.map(makeReportCard));
  archiveList.replaceChildren(...archived.map(makeReportCard));
  $('#active-count').textContent = String(active.length);
  $('#empty-state').hidden = active.length > 0;
  $('#archive-empty').hidden = archived.length > 0;
  const waiting = active.filter((report) => report.status === 'pending').length;
  const notice = $('#online-notice');
  notice.hidden = !(navigator.onLine && waiting > 0);
  notice.textContent = waiting ? `${waiting} saved report${waiting === 1 ? ' is' : 's are'} waiting for you to review. Nothing is sent automatically.` : '';
}

function showReport(report) {
  openReport = report;
  const body = $('#detail-body');
  body.replaceChildren();
  if (report.photo) {
    const img = document.createElement('img');
    img.className = 'detail-photo';
    img.alt = 'Photo saved with this report';
    img.src = imageUrl(report);
    body.append(img);
  }
  const copy = document.createElement('p');
  copy.className = 'detail-copy';
  copy.textContent = report.description || 'No description added.';
  const facts = document.createElement('dl');
  facts.className = 'detail-facts';
  const utility = utilities.find((item) => item.id === report.utilityId);
  const fields = [
    ['Saved', dateLabel(report.createdAt)],
    ['Status', report.status === 'fixed' ? 'Marked fixed by you' : report.status === 'submitted' ? 'Awaiting follow-up' : 'Pending on this device'],
    ['Location', Number.isFinite(report.latitude) && Number.isFinite(report.longitude) ? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}` : 'Not captured'],
    ['Utility', utility?.name || 'No listed contact'],
    ['Email', utility?.email || 'Not available']
  ];
  for (const [label, value] of fields) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    facts.append(row);
  }
  const note = document.createElement('p');
  note.className = 'field-hint';
  note.textContent = report.status === 'fixed' ? 'This status is your update; the app has not independently verified the repair.' : 'This report is saved only on this device. It has not been sent to the utility.';
  body.append(copy, facts, note);
  $('#mark-fixed').hidden = report.status === 'pending' || report.status === 'fixed';
  $('#delete-report').textContent = report.status === 'pending' ? 'Delete report' : 'Delete report';
  detailDialog.showModal();
}

function resetForm() {
  reportForm.reset();
  currentLocation = null;
  selectedUtility = null;
  photoPreview.hidden = true;
  photoImage.removeAttribute('src');
  locationStatus.textContent = 'Location has not been requested.';
  $('#latitude').value = '';
  $('#longitude').value = '';
  utilityCard.hidden = true;
  utilityCard.replaceChildren();
  setError();
  updateSaveState();
}

async function requestLocation() {
  const button = $('#get-location');
  button.disabled = true;
  locationStatus.textContent = 'Checking your current location…';
  setError();
  try {
    currentLocation = await captureLocation();
    $('#latitude').value = String(currentLocation.latitude);
    $('#longitude').value = String(currentLocation.longitude);
    locationStatus.textContent = `Location ready · ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`;
    updateMatch();
  } catch (error) {
    currentLocation = null;
    locationStatus.textContent = 'Location is needed before this report can be routed.';
    setError(error.message);
    updateMatch();
  } finally {
    button.disabled = false;
    updateSaveState();
  }
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (!file) {
    photoPreview.hidden = true;
    updateSaveState();
    return;
  }
  if (!file.type.startsWith('image/')) {
    photoInput.value = '';
    setError('Choose an image file for the report photo.');
    updateSaveState();
    return;
  }
  setError();
  photoImage.src = URL.createObjectURL(file);
  photoPreview.hidden = false;
  updateSaveState();
});
$('#change-photo').addEventListener('click', () => photoInput.click());
descriptionInput.addEventListener('input', updateSaveState);
$('#get-location').addEventListener('click', requestLocation);
$('#start-report').addEventListener('click', () => { resetForm(); reportDialog.showModal(); });
$('#close-dialog').addEventListener('click', () => reportDialog.close());
$('#cancel-report').addEventListener('click', () => reportDialog.close());
$('#close-detail').addEventListener('click', () => detailDialog.close());
$('#close-archive').addEventListener('click', () => archiveDialog.close());
$('#show-archive').addEventListener('click', () => archiveDialog.showModal());
$('#mark-fixed').addEventListener('click', async () => {
  if (!openReport) return;
  openReport.status = 'fixed';
  openReport.fixedAt = new Date().toISOString();
  await saveReport(openReport);
  detailDialog.close();
  await refreshReports();
  showToast('Marked fixed. This is your update, not an independent check.');
});
$('#delete-report').addEventListener('click', async () => {
  if (!openReport || !window.confirm('Delete this report and its saved photo from this device?')) return;
  await deleteReport(openReport.id);
  const url = objectUrls.get(openReport.id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(openReport.id);
  openReport = null;
  detailDialog.close();
  await refreshReports();
  showToast('Report deleted from this device.');
});
reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saveButton.disabled) return;
  saveButton.disabled = true;
  setError();
  try {
    const photo = photoInput.files[0];
    const now = new Date().toISOString();
    await saveReport({
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      photo,
      photoMimeType: photo.type,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      locationCapturedAt: currentLocation.capturedAt,
      category: null,
      description: descriptionInput.value.trim(),
      utilityId: selectedUtility?.id || null,
      recipientEmail: selectedUtility?.email || null,
      providerMessageId: null,
      submittedAt: null,
      fixedAt: null,
      resolutionNote: null
    });
    reportDialog.close();
    resetForm();
    await refreshReports();
    showToast('Report saved on this device. Nothing has been sent.');
  } catch (error) {
    setError('We could not save this report on your device. Check available storage and try again.');
    console.error('Could not save report:', error);
    updateSaveState();
  }
});

window.addEventListener('online', refreshReports);
window.addEventListener('offline', refreshReports);

try {
  const response = await fetch('/api/utilities');
  if (!response.ok) throw new Error('Utility list could not be loaded.');
  utilities = await response.json();
  await refreshReports();
} catch (error) {
  $('#empty-state').hidden = false;
  $('#empty-state h3').textContent = 'Your reports are ready to start';
  $('#empty-state p').textContent = 'The demo utility directory did not load. You can still save a report; no contact will be guessed.';
  console.error('Could not load utility directory:', error);
}
