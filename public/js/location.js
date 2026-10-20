const placeCache = new Map();
export async function reverseGeocode({ latitude, longitude }) {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({ format: 'jsonv2', lat: String(latitude), lon: String(longitude), addressdetails: '1', zoom: '18', 'accept-language': navigator.language || 'en' });
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Place lookup failed.');
  const result = await response.json();
  const address = result.address || {};
  const locality = address.city || address.town || address.village || address.hamlet || address.municipality || address.county;
  const street = [address.road, address.house_number].filter(Boolean).join(' ');
  const placeName = [street, address.suburb || address.neighbourhood || address.quarter || address.residential, locality, address.state, address.country].filter(Boolean).join(', ') || result.name || result.display_name;
  if (!placeName) throw new Error('No place name was found.');
  placeCache.set(key, placeName);
  return placeName;
}

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
