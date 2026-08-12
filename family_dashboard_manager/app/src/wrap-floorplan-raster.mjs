import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readPngDimensions(content) {
  if (!Buffer.isBuffer(content) || content.length < 24 || !content.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("floorplan source must be a complete PNG image");
  }
  if (content.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("floorplan PNG is missing its IHDR header");
  }
  const width = content.readUInt32BE(16);
  const height = content.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error("floorplan PNG dimensions must be positive");
  }
  return { width, height };
}

export function wrapPngAsSvg(content) {
  const { width, height } = readPngDimensions(content);
  const data = content.toString("base64");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">`,
    `  <image href="data:image/png;base64,${data}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`,
    "</svg>",
    ""
  ].join("\n");
}

export async function wrapFloorplanRaster(inputPath, outputPath) {
  if (extname(inputPath).toLowerCase() !== ".png" || extname(outputPath).toLowerCase() !== ".svg") {
    throw new Error("usage: node src/wrap-floorplan-raster.mjs <input.png> <output.svg>");
  }
  const content = await readFile(inputPath);
  const svg = wrapPngAsSvg(content);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg, "utf8");
  return { outputPath, sizeBytes: Buffer.byteLength(svg, "utf8"), ...readPngDimensions(content) };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath, ...extra] = process.argv;
  if (!inputPath || !outputPath || extra.length > 0) {
    console.error("usage: node src/wrap-floorplan-raster.mjs <input.png> <output.svg>");
    process.exitCode = 1;
  } else {
    wrapFloorplanRaster(resolve(inputPath), resolve(outputPath))
      .then(({ width, height, sizeBytes }) => {
        console.log(`wrote ${outputPath} (${width}x${height}, ${sizeBytes} bytes)`);
      })
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}
