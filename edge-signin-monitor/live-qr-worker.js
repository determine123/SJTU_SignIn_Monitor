importScripts('jsQR.js');

let region = 0;

function hideCode(pixels, width, height, location) {
  const corners = [location.topLeftCorner, location.topRightCorner,
    location.bottomLeftCorner, location.bottomRightCorner];
  const left = Math.max(0, Math.floor(Math.min(...corners.map(point => point.x))) - 2);
  const right = Math.min(width, Math.ceil(Math.max(...corners.map(point => point.x))) + 2);
  const top = Math.max(0, Math.floor(Math.min(...corners.map(point => point.y))) - 2);
  const bottom = Math.min(height, Math.ceil(Math.max(...corners.map(point => point.y))) + 2);
  for (let y = top; y < bottom; y++) pixels.fill(255, (y * width + left) * 4, (y * width + right) * 4);
}

function scanRegion(pixels, width, height, index) {
  // Overlap adjacent regions to retain codes near the center boundaries.
  const cropWidth = Math.min(width, Math.ceil(width * 0.65));
  const cropHeight = Math.min(height, Math.ceil(height * 0.65));
  const left = index % 2 ? width - cropWidth : 0;
  const top = index >= 2 ? height - cropHeight : 0;
  const crop = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y++) {
    const source = ((y + top) * width + left) * 4;
    crop.set(pixels.subarray(source, source + cropWidth * 4), y * cropWidth * 4);
  }
  return self.jsQR(crop, cropWidth, cropHeight, {inversionAttempts: 'attemptBoth'});
}

self.onmessage = ({data: {pixels, width, height}}) => {
  const frame = new Uint8ClampedArray(pixels);
  const found = new Set();
  for (let pass = 0; pass < 3; pass++) {
    const qr = self.jsQR(frame, width, height, {inversionAttempts: pass || region === 0 ? 'attemptBoth' : 'dontInvert'});
    if (!qr || found.has(qr.data)) break;
    found.add(qr.data);
    hideCode(frame, width, height, qr.location);
  }
  const extra = scanRegion(frame, width, height, region);
  region = (region + 1) % 4;
  if (extra) found.add(extra.data);
  self.postMessage([...found]);
};
