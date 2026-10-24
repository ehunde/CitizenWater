import { captureLocation, reverseGeocode } from './location.js';
import { deleteReport, getReports, saveReport } from './storage.js';
import { nearestUtility } from './utility-matcher.js';

const $ = (selector) => document.querySelector(selector);
const reportDialog = $('#report-dialog');
const reportForm = $('#report-form');
const detailDialog = $('#detail-dialog');
const archiveDialog = $('#archive-dialog');
const cameraDialog = $('#camera-dialog');
const cameraVideo = $('#camera-video');
const cameraStatus = $('#camera-status');
const capturePhotoButton = $('#capture-photo');
const libraryPhotoInput = $('#photo-library');
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
let followUpOfId = null;
let utilities = [];
let utilityDirectoryAvailable = false;
let sharedMode = false;
let toastTimer;
let selectedPhoto = null;
let photoPreviewUrl = null;
let cameraStream = null;
let cameraRequestId = 0;

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
  saveButton.disabled = !(currentLocation && selectedPhoto && descriptionInput.value.trim());
}

function updateMatch() {
  selectedUtility = currentLocation ? nearestUtility(currentLocation, utilities) : null;
  if (!selectedUtility) {
    utilityCard.hidden = !currentLocation;
    utilityCard.replaceChildren();
    if (currentLocation) {
      const title = document.createElement('strong');
      title.textContent = utilityDirectoryAvailable ? 'No utility contact is listed' : 'Utility list is unavailable right now';
      const detail = document.createElement('span');
      detail.textContent = utilityDirectoryAvailable
        ? 'The report can be saved on this device, but no email destination is available. We will not guess one.'
        : 'Save the report on this device and reconnect to find a listed utility. No destination will be guessed.';
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
  const utility = utilities.find((item) => item.id === report.utilityId) || report.utilitySnapshot;
  meta.textContent = `${dateLabel(report.createdAt)}${utility ? ` · ${utility.name}` : ''}${report.linkedToReportId ? ' · Follow-up' : ''}`;
  const status = document.createElement('span');
  status.className = 'status-pill';
  status.textContent = report.status === 'fixed' ? 'Fixed' : report.status === 'submitted' ? 'Awaiting follow-up' : report.status === 'unknown' ? 'Pending email handoff' : 'Pending';
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
  const waiting = active.filter((report) => report.status === 'pending' || report.status === 'unknown').length;
  const notice = $('#online-notice');
  notice.hidden = navigator.onLine && waiting === 0;
  notice.textContent = !navigator.onLine
    ? 'You are offline. Reports stay saved in this browser; email is unavailable until you reconnect.'
    : waiting ? `${waiting} saved report${waiting === 1 ? ' is' : 's are'} waiting for you to review. Nothing is sent automatically.` : '';
}

async function loadUtilityDirectory() {
  const response = await fetch('/api/utilities');
  if (!response.ok) throw new Error('Utility list could not be loaded.');
  utilities = await response.json();
  utilityDirectoryAvailable = true;

  // Reports saved while offline can be matched once the sample directory is available again.
  const reports = await getReports();
  for (const report of reports) {
    if ((report.status !== 'pending' && report.status !== 'unknown') || report.utilityId ||
        !Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)) continue;
    const utility = nearestUtility(report, utilities);
    if (!utility) continue;
    report.utilityId = utility.id;
    report.recipientEmail = utility.email || null;
    report.utilitySnapshot = {
      name: utility.name,
      serviceArea: utility.serviceArea,
      email: utility.email || null,
      directoryLabel: utility.directoryLabel
    };
    await saveReport(report);
  }
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
  if (report.status === 'pending' || report.status === 'unknown') {
    const label = document.createElement('label');
    label.htmlFor = 'detail-description';
    label.textContent = 'Review or edit the report';
    const edit = document.createElement('textarea');
    edit.id = 'detail-description';
    edit.rows = 4;
    edit.maxLength = 600;
    edit.value = report.description || '';
    edit.required = true;
    edit.placeholder = 'Describe what you noticed.';
    edit.addEventListener('change', async () => {
      report.description = edit.value.trim();
      await saveReport(report);
    });
    body.append(label, edit);
  } else {
    const copy = document.createElement('p');
    copy.className = 'detail-copy';
    copy.textContent = report.description || 'No description added.';
    body.append(copy);
  }
  const facts = document.createElement('dl');
  facts.className = 'detail-facts';
  const utility = utilities.find((item) => item.id === report.utilityId) || report.utilitySnapshot;
  const fields = [
    ['Saved', dateLabel(report.createdAt)],
    ['Status', report.status === 'fixed' ? 'Marked fixed by you' : report.status === 'submitted' ? 'Awaiting follow-up' : report.status === 'unknown' ? 'Pending; email handoff was not confirmed' : 'Pending on this device'],
    ['Latest check', report.lastCheckedAt ? `${report.resolutionNote || 'Still open when checked by you'} · ${dateLabel(report.lastCheckedAt)}` : 'No follow-up check recorded'],
    ['Location', Number.isFinite(report.latitude) && Number.isFinite(report.longitude) ? `${report.locationName ? `${report.locationName} · ` : ''}${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}` : 'Not captured'],
    ['Utility', utility?.name || 'No listed contact'],
    ...(utility?.serviceArea ? [['Sample service area', utility.serviceArea]] : []),
    ['Email destination', utility?.email || 'Not available'],
    ['Contact note', utility?.directoryLabel || 'Check that this listed contact serves the location.'],
    ...(report.linkedToReportId ? [['Follow-up', 'This report follows an earlier report on this device.']] : [])
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
  note.id = 'report-storage-note';
  note.textContent = report.status === 'fixed'
    ? 'This status is your update; the app has not independently verified the repair.'
    : report.status === 'submitted'
      ? report.handoffMethod === 'email-app'
        ? 'You marked the email as sent. CitizenWater cannot confirm delivery or whether the utility read it.'
        : 'This report is marked as sent. CitizenWater cannot confirm delivery or whether the utility read it.'
      : report.shareUrl
        ? 'This report and photo are stored in Supabase behind a private link. CitizenWater will open an email draft for you; it will not send automatically.'
        : 'This report is saved only in this browser. CitizenWater will open an email draft for you; it will not send automatically.';
  body.append(facts, note);
  $('#mark-fixed').hidden = report.status !== 'submitted';
  $('#mark-still-open').hidden = report.status !== 'submitted';
  $('#create-follow-up').hidden = report.status !== 'submitted';
  $('#submit-report').hidden = report.status !== 'pending' && report.status !== 'unknown';
  $('#submit-report').disabled = !utility?.email;
  $('#copy-report-details').hidden = report.status !== 'pending' && report.status !== 'unknown';
  $('#mark-email-sent').hidden = (report.status !== 'pending' && report.status !== 'unknown') || !report.emailDraftOpenedAt;
  $('#submission-status').textContent = report.status === 'submitted'
    ? 'Marked as sent. Check back after contacting the utility; this app receives no reply automatically.'
    : !utility?.email
      ? 'No utility email is listed. This report stays pending here; CitizenWater will not invent a destination.'
      : report.emailDraftOpenedAt
        ? 'Email draft opened. Review the recipient and message, then tap Send in your email app. Return here and choose “I sent the email” to track follow-up.'
        : 'Open a draft addressed to the listed utility. You will review and send it yourself; nothing is sent automatically.';
  $('#delete-report').textContent = report.status === 'pending' ? 'Delete report' : 'Delete report';
  detailDialog.showModal();
}

function resetForm() {
  reportForm.reset();
  selectedPhoto = null;
  libraryPhotoInput.value = '';
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = null;
  followUpOfId = null;
  $('#dialog-title').textContent = 'Tell us what you noticed';
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
    locationStatus.textContent = `Coordinates found · ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)} · Finding place name…`;
    try {
      currentLocation.locationName = await reverseGeocode(currentLocation);
      locationStatus.textContent = `${currentLocation.locationName} · ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`;
    } catch (error) {
      locationStatus.textContent = `Place name unavailable · ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`;
      console.warn('Could not look up the location name:', error);
    }
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

function reportEmailBody(report, utility, shareLink = '') {
  const location = Number.isFinite(report.latitude) && Number.isFinite(report.longitude)
    ? `${report.locationName ? `${report.locationName} · ` : ''}${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
    : 'Not captured';
  const mapLink = Number.isFinite(report.latitude) && Number.isFinite(report.longitude)
    ? `https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=16/${report.latitude}/${report.longitude}`
    : 'Not available';
  return [
    'Water problem report',
    '',
    `Description: ${report.description || ''}`,
    `Location: ${location}`,
    `Map: ${mapLink}`,
    `Suggested utility: ${utility?.name || 'Not available'}`,
    `Service area: ${utility?.serviceArea || 'Not available'}`,
    ...(shareLink ? [`Private report and photo: ${shareLink}`, `This private link expires ${dateLabel(report.shareExpiresAt)}.`] : ['Private photo link unavailable. The report photo is not included.']),
    '',
    'The location and utility match are approximate. Please verify the details.'
  ].join('\n');
}

async function fileAsBase64(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('The saved photo data is unavailable. Re-select the original photo before trying again.');
  }
  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new Error('Firefox could not read the saved photo file. Re-select the original photo before trying again.');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function preparePrivateShare(report) {
  if (!report.photo) return null;
  let step = 'checking the internet connection';
  try {
    if (!navigator.onLine) throw new Error('The device appears to be offline.');
    if (!report.shareToken) {
      step = 'creating a private link token';
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      report.shareToken = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    step = 'reading the photo for upload';
    const photoBase64 = await fileAsBase64(report.photo);
    const payload = {
      id: report.id,
      createdAt: report.createdAt,
      status: report.status,
      description: report.description,
      latitude: report.latitude,
      longitude: report.longitude,
      locationName: report.locationName || null,
      locationCapturedAt: report.locationCapturedAt || null,
      photoMimeType: report.photoMimeType || report.photo.type || 'image/jpeg',
      photoBase64,
      utilityId: report.utilityId || null,
      recipientEmail: report.recipientEmail || null,
      utilitySnapshot: report.utilitySnapshot || null,
      linkedToReportId: report.linkedToReportId || null,
      emailDraftOpenedAt: report.emailDraftOpenedAt || null,
      handoffMethod: report.handoffMethod || null,
      submittedAt: report.submittedAt || null,
      lastCheckedAt: report.lastCheckedAt || null,
      fixedAt: report.fixedAt || null,
      resolutionNote: report.resolutionNote || null
    };

    step = 'sending the report and photo to the CitizenWater server';
    const response = await fetch('/api/reports/share', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${report.shareToken}`
      },
      body: JSON.stringify(payload)
    });
    step = 'reading the server response';
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `The server returned HTTP ${response.status}.`);
    report.shareToken = result.token;
    report.shareUrl = result.url;
    report.shareExpiresAt = result.expiresAt;
    step = 'saving the private link in this browser';
    let localSaveWarning = '';
    try {
      await saveReport(report);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'the browser gave no error details';
      localSaveWarning = `The private link was created, but this browser could not save it for future updates (${reason}).`;
      console.warn('Cloud report link could not be saved locally:', error);
    }
    return { url: result.url, warning: localSaveWarning };
  } catch (error) {
    const reason = error instanceof Error
      ? error.message
      : error == null
        ? 'the browser provided no error details'
        : String(error);
    throw new Error(`Private report sharing failed while ${step}: ${reason}`);
  }
}

async function syncCloudStatus(report) {
  if (!report.shareToken) return true;
  const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${report.shareToken}` },
    body: JSON.stringify({
      status: report.status,
      submittedAt: report.submittedAt || null,
      lastCheckedAt: report.lastCheckedAt || null,
      fixedAt: report.fixedAt || null,
      resolutionNote: report.resolutionNote || null,
      handoffMethod: report.handoffMethod || null
    })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'The cloud report could not be updated.');
  }
  return true;
}

async function openEmailDraft() {
  if (!openReport) return;
  const utility = utilities.find((item) => item.id === openReport.utilityId) || openReport.utilitySnapshot;
  if (!utility?.email) {
    $('#submission-status').textContent = 'No listed utility email is available. The report remains saved here.';
    return;
  }
  const editor = $('#detail-description');
  const description = editor ? editor.value.trim() : openReport.description;
  if (!description) {
    $('#submission-status').textContent = 'Add a description before opening an email draft.';
    return;
  }
  const emailTab = window.open('about:blank', '_blank');
  if (!emailTab) {
    $('#submission-status').textContent = 'Firefox blocked the email tab. Allow pop-ups for this app, then try again.';
    return;
  }
  $('#submission-status').textContent = 'Preparing the report and its private photo link. Keep this report open to see the result.';
  openReport.description = description;
  openReport.emailDraftOpenedAt = new Date().toISOString();
  try {
    await saveReport(openReport);
    let shareLink = '';
    let shareWarning = '';
    let shareNotice = '';
    try {
      const shareResult = await preparePrivateShare(openReport);
      shareLink = shareResult?.url || '';
      shareNotice = shareResult?.warning || '';
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : error == null
            ? 'The link request failed without a response from the server. Open the local Supabase diagnostics page to see whether the table and bucket are reachable.'
            : 'The private report link could not be prepared; the browser returned an unrecognized error.';
      shareWarning = `${errorMessage} The email can still open with report details, but the private photo link could not be added.`;
      console.warn('Private report link unavailable:', error);
    }
    const subject = `Water problem report — ${utility.name}`;
    const mailto = `mailto:${encodeURI(utility.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportEmailBody(openReport, utility, shareLink))}`;
    if (shareLink) {
      const storageNote = $('#report-storage-note');
      if (storageNote) storageNote.textContent = 'This report and photo are stored in Supabase behind a private link. CitizenWater will open an email draft for you; it will not send automatically.';
    }
    $('#submission-status').textContent = shareLink
      ? `${shareNotice ? `${shareNotice} ` : ''}Private report and photo link ready. Opening your email app in another tab; the report link expires ${dateLabel(openReport.shareExpiresAt)}. Review the recipient and tap Send there.`
      : `${shareWarning || 'The private report link was not prepared.'} The report stays open here. The email draft contains report details only; try again later to include the private photo link.`;
    emailTab.location.href = mailto;
    $('#mark-email-sent').hidden = false;
  } catch (error) {
    emailTab.close();
    const errorMessage = error instanceof Error ? error.message : 'The email draft could not be prepared.';
    $('#submission-status').textContent = `${errorMessage} Your report remains saved on this device.`;
  }
}

$('#submit-report').addEventListener('click', openEmailDraft);
$('#mark-email-sent').addEventListener('click', async () => {
  if (!openReport || !openReport.emailDraftOpenedAt) return;
  openReport.status = 'submitted';
  openReport.handoffMethod = 'email-app';
  openReport.submittedAt = new Date().toISOString();
  await saveReport(openReport);
  try { await syncCloudStatus(openReport); } catch (error) { showToast(`Saved on this device; cloud status did not update. ${error.message}`); }
  await refreshReports();
  showReport(openReport);
  showToast('Marked as sent by you. Delivery is not confirmed by CitizenWater.');
});
$('#copy-report-details').addEventListener('click', async () => {
  if (!openReport) return;
  const utility = utilities.find((item) => item.id === openReport.utilityId) || openReport.utilitySnapshot;
  const editor = $('#detail-description');
  const description = editor ? editor.value.trim() : openReport.description;
  if (!description) {
    $('#submission-status').textContent = 'Add a description before copying report details.';
    return;
  }
  openReport.description = description;
  await saveReport(openReport);
  try {
    await navigator.clipboard.writeText(`To: ${utility?.email || 'No utility email listed'}\nSubject: Water problem report — ${utility?.name || 'CitizenWater'}\n\n${reportEmailBody(openReport, utility)}`);
    $('#submission-status').textContent = 'Report details copied. Paste them into your email if no email app opens.';
  } catch {
    $('#submission-status').textContent = 'Copy is unavailable in this browser. Use Open email app or select the report text above and copy it.';
  }
});
function useSelectedPhoto(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    selectedPhoto = null;
    photoPreview.hidden = true;
    photoImage.removeAttribute('src');
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
    setError('Choose a JPEG, PNG, or WebP image smaller than 4 MB.');
    updateSaveState();
    return;
  }
  selectedPhoto = file;
  setError();
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = URL.createObjectURL(file);
  photoImage.src = photoPreviewUrl;
  photoPreview.hidden = false;
  updateSaveState();
}

function handlePhotoSelection(event) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = '';
  useSelectedPhoto(file);
}

function stopCamera() {
  cameraRequestId += 1;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraVideo.srcObject = null;
  capturePhotoButton.disabled = true;
}

async function startCamera() {
  cameraDialog.showModal();
  cameraStatus.textContent = 'Allow camera access when your browser asks.';
  capturePhotoButton.disabled = true;
  const requestId = ++cameraRequestId;
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = 'Camera access is unavailable in this browser or connection. Use Choose an existing photo instead.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } }
    });
    if (requestId !== cameraRequestId || !cameraDialog.open) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    if (requestId === cameraRequestId) {
      cameraStatus.textContent = 'Position the camera, then capture your photo.';
      capturePhotoButton.disabled = false;
    }
  } catch (error) {
    if (requestId !== cameraRequestId) return;
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraVideo.srcObject = null;
    const reason = error?.name === 'NotAllowedError'
      ? 'Camera permission was blocked. Allow camera access for CitizenWater in your browser settings, then try again.'
      : error?.name === 'NotFoundError'
        ? 'No camera was found on this device. Use Choose an existing photo instead.'
        : 'The camera could not be started. Close other apps using the camera and try again, or choose an existing photo.';
    cameraStatus.textContent = reason;
  }
}

async function captureCameraPhoto() {
  const width = cameraVideo.videoWidth;
  const height = cameraVideo.videoHeight;
  if (!width || !height) {
    cameraStatus.textContent = 'The camera is not ready yet. Wait a moment and try again.';
    return;
  }
  capturePhotoButton.disabled = true;
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('The camera image could not be created.');
    const photo = new File([blob], `citizenwater-${Date.now()}.jpg`, { type: 'image/jpeg' });
    cameraDialog.close();
    useSelectedPhoto(photo);
  } catch {
    cameraStatus.textContent = 'The photo could not be captured. Try again or choose an existing photo.';
    capturePhotoButton.disabled = false;
  }
}

cameraDialog.addEventListener('close', stopCamera);
$('#take-photo').addEventListener('click', startCamera);
$('#choose-photo').addEventListener('click', () => libraryPhotoInput.click());
$('#change-photo').addEventListener('click', () => libraryPhotoInput.click());
capturePhotoButton.addEventListener('click', captureCameraPhoto);
$('#close-camera').addEventListener('click', () => cameraDialog.close());
$('#cancel-camera').addEventListener('click', () => cameraDialog.close());
libraryPhotoInput.addEventListener('change', handlePhotoSelection);
descriptionInput.addEventListener('input', updateSaveState);
$('#get-location').addEventListener('click', requestLocation);
$('#start-report').addEventListener('click', () => { resetForm(); reportDialog.showModal(); });
$('#close-dialog').addEventListener('click', () => reportDialog.close());
$('#cancel-report').addEventListener('click', () => reportDialog.close());
$('#close-detail').addEventListener('click', () => detailDialog.close());
$('#close-archive').addEventListener('click', () => archiveDialog.close());
$('#show-archive').addEventListener('click', () => archiveDialog.showModal());
$('#mark-still-open').addEventListener('click', async () => {
  if (!openReport) return;
  openReport.lastCheckedAt = new Date().toISOString();
  openReport.resolutionNote = 'Still open when checked by you';
  await saveReport(openReport);
  try { await syncCloudStatus(openReport); } catch (error) { showToast(`Saved on this device; cloud status did not update. ${error.message}`); }
  await refreshReports();
  showReport(openReport);
  showToast('Updated. This is your check; the app has not independently verified the issue.');
});
$('#create-follow-up').addEventListener('click', () => {
  if (!openReport) return;
  const earlierReport = openReport;
  detailDialog.close();
  resetForm();
  followUpOfId = earlierReport.id;
  descriptionInput.value = earlierReport.description || '';
  $('#dialog-title').textContent = 'Report this problem again';
  reportDialog.showModal();
  updateSaveState();
});
$('#mark-fixed').addEventListener('click', async () => {
  if (!openReport) return;
  openReport.status = 'fixed';
  openReport.fixedAt = new Date().toISOString();
  await saveReport(openReport);
  try { await syncCloudStatus(openReport); } catch (error) { showToast(`Saved on this device; cloud status did not update. ${error.message}`); }
  detailDialog.close();
  await refreshReports();
  showToast('Marked fixed. This is your update, not an independent check.');
});
$('#delete-report').addEventListener('click', async () => {
  if (!openReport || !window.confirm(openReport.shareToken
    ? 'Delete this report and its private photo from this device and CitizenWater sharing?'
    : 'Delete this report and its saved photo from this device?')) return;
  if (openReport.shareToken) {
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(openReport.id)}`, {
        method: 'DELETE', headers: { authorization: `Bearer ${openReport.shareToken}` }
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Cloud deletion failed.');
      }
    } catch (error) {
      $('#submission-status').textContent = `${error.message} The local report was kept so you can try again.`;
      return;
    }
  }
  await deleteReport(openReport.id);
  const url = objectUrls.get(openReport.id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(openReport.id);
  openReport = null;
  detailDialog.close();
  await refreshReports();
  showToast('Report deleted from this device and its private share.');
});
reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saveButton.disabled) return;
  saveButton.disabled = true;
  setError();
  try {
    const photo = selectedPhoto;
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
      locationName: currentLocation.locationName || null,
      locationCapturedAt: currentLocation.capturedAt,
      description: descriptionInput.value.trim(),
      utilityId: selectedUtility?.id || null,
      recipientEmail: selectedUtility?.email || null,
      utilitySnapshot: selectedUtility ? {
        name: selectedUtility.name,
        serviceArea: selectedUtility.serviceArea,
        email: selectedUtility.email || null,
        directoryLabel: selectedUtility.directoryLabel
      } : null,
      linkedToReportId: followUpOfId,
      submittedAt: null,
      handoffMethod: null,
      emailDraftOpenedAt: null,
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

window.addEventListener('online', async () => {
  if (sharedMode) return;
  try { await loadUtilityDirectory(); } catch (error) { console.warn('Could not refresh the utility directory:', error); }
  if (currentLocation) updateMatch();
  await refreshReports();
});
window.addEventListener('offline', () => { if (!sharedMode) refreshReports(); });

async function showSharedReport() {
  const token = new URLSearchParams(location.hash.slice(1)).get('share');
  if (!token) return false;
  sharedMode = true;
  $('.topbar').hidden = true;
  $('.layout').hidden = true;
  $('#shared-report-view').hidden = false;
  const title = $('#shared-report-title');
  const message = $('#shared-report-status');
  try {
    const response = await fetch('/api/shared-report', { headers: { authorization: `Bearer ${token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'This report link could not be opened.');
    const report = result.report;
    title.textContent = report.description?.slice(0, 100) || 'Water problem report';
    message.textContent = report.status === 'fixed'
      ? 'The citizen marked this problem fixed. CitizenWater has not independently verified the repair.'
      : report.status === 'submitted'
        ? 'The citizen marked this report as sent. CitizenWater cannot verify email delivery or a utility response.'
        : 'A citizen shared this report. Email delivery has not been confirmed.';
    $('#shared-report-description').textContent = report.description || 'No description was provided.';
    $('#shared-report-photo').src = result.imageUrl;
    const facts = $('#shared-report-facts');
    const location = Number.isFinite(report.latitude) && Number.isFinite(report.longitude)
      ? `${report.location_name ? `${report.location_name} · ` : ''}${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
      : 'Not captured';
    const utility = report.utility_snapshot;
    const rows = [
      ['Reported', dateLabel(report.created_at)],
      ['Location', location],
      ...(utility?.name ? [['Suggested utility', utility.name]] : []),
      ...(utility?.serviceArea ? [['Sample service area', utility.serviceArea]] : []),
      ['Link expires', dateLabel(report.share_expires_at)]
    ];
    facts.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      row.append(term, detail);
      return row;
    }));
    const map = $('#shared-report-map');
    if (Number.isFinite(report.latitude) && Number.isFinite(report.longitude)) {
      map.href = `https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=16/${report.latitude}/${report.longitude}`;
      map.hidden = false;
    } else {
      map.hidden = true;
    }
    $('#shared-report-content').hidden = false;
    message.textContent = `Private report link verified. ${message.textContent}`;
  } catch (error) {
    title.textContent = 'Report link unavailable';
    message.textContent = error.message;
  }
  return true;
}

if (!await showSharedReport()) {
  try { await loadUtilityDirectory(); } catch (error) { console.warn('Could not load utility directory:', error); }
  try { await refreshReports(); } catch (error) {
    $('#empty-state').hidden = false;
    $('#empty-state h3').textContent = 'Saved reports could not be opened';
    $('#empty-state p').textContent = 'Check this browser’s local storage and reload. Reports are stored on this device.';
    console.error('Could not load saved reports:', error);
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch((error) => {
    console.warn('The offline app shell could not be installed:', error);
  });
}
