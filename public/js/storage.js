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

export const saveReport = (report) => withStore('readwrite', (store) => store.put(report));
export const getReport = (id) => withStore('readonly', (store) => store.get(id));
export const getReports = () => withStore('readonly', (store) => store.getAll());
export const deleteReport = (id) => withStore('readwrite', (store) => store.delete(id));
