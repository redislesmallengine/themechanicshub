import { test } from "node:test";
import assert from "node:assert/strict";
import { describeEquipment, equipmentMakeModel, machineHeading, splitMachineHeading } from "./equipment-label.ts";

// Run with:  node --test src/lib/equipment-label.test.ts

test("the type comes first, then make and model", () => {
  assert.equal(describeEquipment({ make: "Ariens", model: "921022", equipmentType: { name: "Snowblower" } }), "Snowblower — Ariens 921022");
});

test("a missing half is left out", () => {
  assert.equal(describeEquipment({ make: "Ariens", model: null, equipmentType: null }), "Ariens");
  assert.equal(describeEquipment({ make: null, model: null, equipmentType: { name: "Generator" } }), "Generator");
  assert.equal(describeEquipment({ make: " ", model: "", equipmentType: null }, "Unnamed equipment"), "Unnamed equipment");
  assert.equal(equipmentMakeModel({ make: "Yardworks", model: "Briggs 7.25" }), "Yardworks Briggs 7.25");
});

test("a machine heading round-trips into title and subtitle", () => {
  const h = machineHeading({ make: "Champion", model: "11250/9000 watts", equipmentType: { name: "Generator" } }, "WO-1074");
  assert.deepEqual(splitMachineHeading(h), { title: "Generator", subtitle: "Champion 11250/9000 watts · WO-1074" });
});

test("a heading without a type still names the machine; older one-line headings are kept as they were", () => {
  assert.deepEqual(splitMachineHeading(machineHeading({ make: "Ariens", model: "921022" }, "WO-1")), { title: "Ariens 921022", subtitle: "WO-1" });
  assert.deepEqual(splitMachineHeading("Yardworks / Briggs 7.25 · WO-1075"), { title: "Yardworks / Briggs 7.25 · WO-1075", subtitle: null });
});
