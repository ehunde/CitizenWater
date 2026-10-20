const DB_NAME = 'citizenwater';
const STORE = 'reports';
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(request?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

// Persist photo bytes rather than a File handle. Firefox can restore a File
// from IndexedDB that still previews correctly but can no longer be read for
// upload after a reload. Plain bytes survive that round trip reliably.
async function persistableReport(report) {
  const { photo, photoData: existingPhotoData, ...fields } = report;
  let photoData = existingPhotoData;
  if (photo) photoData = new Uint8Array(await photo.arrayBuffer());
  return { ...fields, photoData };
}

function hydrateReport(report) {
  if (!report) return report;
  if (report.photoData) {
    const { photoData, ...fields } = report;
    return { ...fields, photo: new Blob([photoData], { type: report.photoMimeType || 'image/jpeg' }) };
  }
  return report;
}

export const saveReport = async (report) => {
  const saved = await persistableReport(report);
  return withStore('readwrite', (store) => store.put(saved));
};
export const getReport = async (id) => hydrateReport(await withStore('readonly', (store) => store.get(id)));
export const getReports = async () => (await withStore('readonly', (store) => store.getAll())).map(hydrateReport);
export const deleteReport = (id) => withStore('readwrite', (store) => store.delete(id));
