import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(await readFile(new URL("../config/family-dashboard.schema.json", import.meta.url), "utf8"));
const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("the draft 2020-12 schema accepts the public v3 example", () => {
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
});

test("the schema rejects older contracts and unknown fields", () => {
  const validate = new Ajv2020({ strict: true }).compile(schema);
  const old = structuredClone(example);
  old.schema_version = 1;
  assert.equal(validate(old), false);

  old.schema_version = 2;
  assert.equal(validate(old), false);

  const unknown = structuredClone(example);
  unknown.display.unrecognised = true;
  assert.equal(validate(unknown), false);
});
