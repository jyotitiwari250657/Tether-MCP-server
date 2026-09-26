// Sanity check: rendered icon PNGs must be non-blank (Prompt 14 §2, AC-P14-05).
import sharp from 'sharp';

for (const size of [16, 48, 128]) {
  const img = sharp(`apps/extension/public/icons/icon${size}.png`);
  const stats = await img.stats();
  const meta = await img.metadata();
  const means = stats.channels
    .slice(0, 3)
    .map((c) => c.mean.toFixed(1))
    .join('/');
  const stdev = stats.channels[0].stdev.toFixed(1);
  console.log(
    `${size}x${size} channels R/G/B mean: ${means} stdev: ${stdev} (${meta.width}x${meta.height})`,
  );
  if (stats.channels[0].stdev < 5) {
    console.error(`icon${size}.png looks blank (stdev ${stdev} < 5)`);
    process.exit(1);
  }
}
console.log('icons non-blank: OK');
