importScripts('jsQR.js');

self.onmessage = ({data: {pixels, width, height}}) => {
  const qr = self.jsQR(new Uint8ClampedArray(pixels), width, height, {inversionAttempts: 'attemptBoth'});
  self.postMessage(qr?.data ?? null);
};
