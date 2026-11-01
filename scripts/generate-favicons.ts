import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      const bit = (byte ^ crc) & 1;
      crc >>>= 1;
      if (bit) crc ^= 0xedb88320;
      byte >>>= 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function renderDeployXIconPixels(size: number): Buffer {
  // Returns RGBA scanline buffer with filter byte 0 at start of each line
  const rowLen = 1 + size * 4;
  const rawData = Buffer.alloc(rowLen * size);

  const radius = size * 0.22;

  // Render rounded dark rectangle with "DX" in center
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Check rounded corner boundary
      const dx = Math.abs(x - (size - 1) / 2) - ((size - 1) / 2 - radius);
      const dy = Math.abs(y - (size - 1) / 2) - ((size - 1) / 2 - radius);
      let inside = true;
      if (dx > 0 && dy > 0) {
        if (dx * dx + dy * dy > radius * radius) {
          inside = false;
        }
      }

      if (!inside) {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Check border
      const isBorder = (x <= 1 || x >= size - 2 || y <= 1 || y >= size - 2);

      // Check letter shapes (simplified normalized DX rendering)
      const nx = x / size;
      const ny = y / size;

      let isD = false;
      let isX = false;

      // Letter D (nx: 0.22 to 0.48, ny: 0.28 to 0.72)
      if (nx >= 0.22 && nx <= 0.48 && ny >= 0.28 && ny <= 0.72) {
        const spine = nx <= 0.30;
        const outerD = ((nx - 0.28) / 0.20) ** 2 + ((ny - 0.50) / 0.22) ** 2 <= 1.0;
        const innerD = ((nx - 0.26) / 0.12) ** 2 + ((ny - 0.50) / 0.14) ** 2 <= 1.0;
        if (spine || (outerD && !innerD)) {
          isD = true;
        }
      }

      // Letter X (nx: 0.52 to 0.78, ny: 0.28 to 0.72)
      if (nx >= 0.52 && nx <= 0.78 && ny >= 0.28 && ny <= 0.72) {
        const diag1 = Math.abs((nx - 0.52) / 0.26 - (ny - 0.28) / 0.44);
        const diag2 = Math.abs((nx - 0.52) / 0.26 - (1 - (ny - 0.28) / 0.44));
        if (diag1 < 0.16 || diag2 < 0.16) {
          isX = true;
        }
      }

      if (isD || isX) {
        // White foreground
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
      } else if (isBorder) {
        // Border subtle grey
        rawData[pxOffset] = 55;
        rawData[pxOffset + 1] = 58;
        rawData[pxOffset + 2] = 65;
        rawData[pxOffset + 3] = 255;
      } else {
        // Dark background #0e0f12
        rawData[pxOffset] = 14;
        rawData[pxOffset + 1] = 15;
        rawData[pxOffset + 2] = 18;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  return rawData;
}

function generatePng(size: number): Buffer {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdrChunk = createPngChunk("IHDR", ihdrData);

  // IDAT
  const rawScanlines = renderDeployXIconPixels(size);
  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = createPngChunk("IDAT", compressed);

  // IEND
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk]);
}

function generateIco(png32: Buffer): Buffer {
  // 6-byte ICONDIR
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // Reserved
  dir.writeUInt16LE(1, 2); // ICO format
  dir.writeUInt16LE(1, 4); // 1 image

  // 16-byte ICONDIRENTRY
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // Width
  entry.writeUInt8(32, 1); // Height
  entry.writeUInt8(0, 2); // Colors
  entry.writeUInt8(0, 3); // Reserved
  entry.writeUInt16LE(1, 4); // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(png32.length, 8); // Bytes in image
  entry.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

  return Buffer.concat([dir, entry, png32]);
}

async function main() {
  console.log("Generating DeployX Favicon & Tab Branding assets...");

  const png32 = generatePng(32);
  const png180 = generatePng(180);
  const png192 = generatePng(192);
  const icoData = generateIco(png32);

  // Write files
  fs.writeFileSync(path.join(process.cwd(), "public", "favicon.ico"), icoData);
  fs.writeFileSync(path.join(process.cwd(), "app", "favicon.ico"), icoData);
  fs.writeFileSync(path.join(process.cwd(), "public", "apple-touch-icon.png"), png180);
  fs.writeFileSync(path.join(process.cwd(), "public", "icon-192.png"), png192);
  fs.writeFileSync(path.join(process.cwd(), "public", "icon-32.png"), png32);

  console.log("✓ Successfully generated:");
  console.log("  - public/favicon.ico");
  console.log("  - app/favicon.ico");
  console.log("  - public/apple-touch-icon.png");
  console.log("  - public/icon-192.png");
  console.log("  - public/icon-32.png");
}

main().catch(console.error);
