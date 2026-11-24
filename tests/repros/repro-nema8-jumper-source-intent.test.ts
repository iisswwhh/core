import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"
import {
  type AutoplacedJumper,
  insertAutoplacedJumpers,
} from "lib/components/primitive-components/Group/insert-autoplaced-jumpers"

test("conflicting jumper ownership cannot modify the full NEMA8 source graph", () => {
  const circuitJson = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "../fixtures/nema8-conflicting-autorouter-endpoints/circuit.json.gz",
          import.meta.url,
        ),
      ),
    ).toString("utf8"),
  ) as AnyCircuitElement[]
  const db = su(circuitJson)
  const originalCircuitJson = structuredClone(db.toArray())
  const validJumper: AutoplacedJumper = {
    jumper_footprint: "0603",
    center: { x: 0, y: 0 },
    orientation: "vertical",
    pads: [
      {
        center: { x: -1, y: 0 },
        width: 0.6,
        height: 0.8,
        layer: "top",
        connectedTo: ["source_trace_8"],
      },
      {
        center: { x: 1, y: 0 },
        width: 0.6,
        height: 0.8,
        layer: "top",
        connectedTo: ["source_trace_8"],
      },
    ],
  }
  const conflictingJumper: AutoplacedJumper = {
    ...validJumper,
    pads: [
      {
        ...validJumper.pads[0],
        connectedTo: ["source_trace_8", "source_net_0"],
      },
      validJumper.pads[1],
    ],
  }

  expect(() =>
    insertAutoplacedJumpers({
      db,
      output_jumpers: [validJumper, conflictingJumper],
    }),
  ).toThrow("Autoplaced jumper would connect different intended source nets")
  expect(db.toArray()).toEqual(originalCircuitJson)
})
