import { COLORS } from '../draw/styles.js';

/**
 * Rasterizes an exported SVG (`saveSVG`) to a PNG at `scale` × its size, on the diagram's white
 * fill, so a PNG looks like the SVG in every viewer and stays light in every mode.
 */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const { width, height } = svgSize(svg);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.width = width;
    image.height = height;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render the SVG.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available.');
    context.fillStyle = COLORS.fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG generation failed.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function svgSize(svg: string): { width: number; height: number } {
  const width = /width="(\d+(?:\.\d+)?)"/.exec(svg);
  const height = /height="(\d+(?:\.\d+)?)"/.exec(svg);
  return { width: width ? Number(width[1]) : 1000, height: height ? Number(height[1]) : 700 };
}

/** Blob -> Base64 (without the data-URL prefix), e.g. to post it to a VS Code extension host. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the export blob.'));
    reader.readAsDataURL(blob);
  });
}
