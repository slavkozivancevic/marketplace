let count = 0;

export function openLightbox() {
  count++;
}

export function closeLightbox() {
  count--;
}

export function isLightboxOpen() {
  return count > 0;
}