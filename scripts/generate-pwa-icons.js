import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [192, 512];
const backgroundColor = '#ffffff';
const iconColor = '#7E22CE'; // Purple color

async function generateIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
      <text x="50%" y="50%" font-family="Arial" font-size="${size/4}" font-weight="bold" 
            fill="${iconColor}" text-anchor="middle" dominant-baseline="middle">EL</text>
    </svg>
  `;

  const outputPath = join(__dirname, '..', 'public', `pwa-${size}x${size}.png`);
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
  
  console.log(`Generated: ${outputPath}`);
}

async function generateIcons() {
  // Create public directory if it doesn't exist
  const publicDir = join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }

  // Generate icons for each size
  for (const size of sizes) {
    await generateIcon(size);
  }
}

generateIcons().catch(console.error);
