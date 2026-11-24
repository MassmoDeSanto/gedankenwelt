import { exportiereZip } from '../db/aktionen';
import { lokalesDatum } from '../logik/zeit';

/** Erzeugt den ZIP-Export im Browser und speichert ihn wie einen normalen Download. */
export function ladeZipHerunter(): void {
  const url = URL.createObjectURL(new Blob([exportiereZip() as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `gedankenwelt-${lokalesDatum()}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
