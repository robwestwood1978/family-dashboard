import assert from "node:assert/strict";
import test from "node:test";
import { readPngDimensions, wrapPngAsSvg } from "../src/wrap-floorplan-raster.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("reads the dimensions from a PNG IHDR header", () => {
  assert.deepEqual(readPngDimensions(ONE_PIXEL_PNG), { width: 1, height: 1 });
});

test("wraps a PNG in the inert SVG asset contract", () => {
  const svg = wrapPngAsSvg(ONE_PIXEL_PNG);
  assert.match(svg, /^<svg[^>]+viewBox="0 0 1 1"/);
  assert.match(svg, /href="data:image\/png;base64,[A-Za-z0-9+/=]+"/);
  assert.match(svg, /<\/svg>\n$/);
  assert.doesNotMatch(svg, /<script|javascript:|\b(?:href|xlink:href)="https?:/i);
});

test("rejects non-PNG input", () => {
  assert.throws(() => readPngDimensions(Buffer.from("not a PNG")), /complete PNG image/);
});
