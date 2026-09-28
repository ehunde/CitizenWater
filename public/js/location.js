export function captureLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available in this browser. You can try another browser or device.'));
      return;
    }
    let settled = false;
    let watchdog;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      callback(value);
    };
    watchdog = setTimeout(() => finish(reject, new Error(
      'Your browser did not return a location after 30 seconds. Check Firefox’s permission for localhost and Windows Location Services, then retry.'
    )), 32000);

    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => finish(resolve, { latitude: coords.latitude, longitude: coords.longitude, capturedAt: new Date().toISOString() }),
        (error) => {
          const messages = {
            1: 'Location permission is blocked. In Firefox, allow Location for this localhost site in the address-bar permissions or Location settings, then reload and retry.',
            2: 'Your device could not determine a current location. Check Windows Location Services and try again near a window or with Wi-Fi on.',
            3: 'Your browser could not get a location fix in 30 seconds. Check Firefox’s permission for localhost and Windows Location Services, then retry.'
          };
          finish(reject, new Error(messages[error.code] || 'We could not get your current location. Check browser permissions and try again.'));
        },
        // Utility matching uses an approximate directory point, so a faster
        // browser location is more useful here than waiting for GPS-level precision.
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 0 }
      );
    } catch (error) {
      finish(reject, new Error(`The browser could not start a location request: ${error.message}`));
    }
  });
}
