import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";

test("--list prints the devices as a JSON array, without a terminal", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [new URL("../bin/rex-sim.mjs", import.meta.url).pathname, "--list"]);
  const devices = JSON.parse(stdout);
  assert.ok(Array.isArray(devices));
  for (const d of devices) assert.ok(d.id && d.name && ["ios", "android"].includes(d.platform));
});
