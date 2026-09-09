const path = require('path');
const Jimp = require('jimp-compact');

const CANVAS = 1024;
const SAFE_ZONE_DIAMETER = CANVAS * 0.645;
const BACKGROUND_CUTOFF = 40;
const ALPHA_THRESHOLD = 8;

const projectRoot = path.resolve(__dirname, '..');
const sourceFile = path.join(projectRoot, 'assets', 'icon.png');
const targetFile = path.join(projectRoot, 'assets', 'adaptive-icon.png');

function isolateMark(image) {
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
    const red = image.bitmap.data[idx];
    const sourceAlpha = image.bitmap.data[idx + 3] / 255;
    const ratio = (red - BACKGROUND_CUTOFF) / (255 - BACKGROUND_CUTOFF);
    const alpha = Math.max(0, Math.min(1, ratio)) * sourceAlpha;

    image.bitmap.data[idx] = 255;
    image.bitmap.data[idx + 1] = 255;
    image.bitmap.data[idx + 2] = 255;
    image.bitmap.data[idx + 3] = Math.round(alpha * 255);
  });
}

function measureBounds(image) {
  let minX = image.bitmap.width;
  let minY = image.bitmap.height;
  let maxX = -1;
  let maxY = -1;

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
    if (image.bitmap.data[idx + 3] <= ALPHA_THRESHOLD) {
      return;
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  if (maxX < 0) {
    throw new Error('Nenhum pixel da marca foi encontrado em assets/icon.png.');
  }

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

(async () => {
  const source = await Jimp.read(sourceFile);
  isolateMark(source);

  const bounds = measureBounds(source);
  const mark = source.clone().crop(bounds.left, bounds.top, bounds.width, bounds.height);

  const diagonal = Math.sqrt(bounds.width ** 2 + bounds.height ** 2);
  const scale = SAFE_ZONE_DIAMETER / diagonal;
  const width = Math.round(bounds.width * scale);
  const height = Math.round(bounds.height * scale);
  mark.resize(width, height, Jimp.RESIZE_BICUBIC);

  const canvas = new Jimp(CANVAS, CANVAS, 0x00000000);
  canvas.composite(mark, Math.round((CANVAS - width) / 2), Math.round((CANVAS - height) / 2));
  await canvas.writeAsync(targetFile);

  console.log(
    `ok assets/adaptive-icon.png — marca ${width}x${height} (${Math.round(
      (height / CANVAS) * 100,
    )}% da altura), diagonal ${Math.round(diagonal * scale)}px em area segura de ${Math.round(
      SAFE_ZONE_DIAMETER,
    )}px`,
  );
})();
