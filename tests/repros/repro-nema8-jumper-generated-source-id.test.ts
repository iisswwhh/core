import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import {
  type AutoplacedJumper,
  insertAutoplacedJumpers,
} from "lib/components/primitive-components/Group/insert-autoplaced-jumpers"

test("generated source IDs cannot reinterpret router aliases in the full NEMA8 board", () => {
  const db = su(
    JSON.parse(
      gunzipSync(
        readFileSync(
          new URL(
            "../fixtures/nema8-conflicting-autorouter-endpoints/circuit.json.gz",
            import.meta.url,
          ),
        ),
      ).toString("utf8"),
    ) as AnyCircuitElement[],
  )
  const groundJumper: AutoplacedJumper = {
    jumper_footprint: "0603",
    center: { x: 0, y: 0 },
    orientation: "vertical",
    pads: [
      {
        center: { x: -1, y: 0 },
        width: 0.6,
        height: 0.8,
        layer: "top",
        connectedTo: ["source_net_0"],
      },
      {
        center: { x: 1, y: 0 },
        width: 0.6,
        height: 0.8,
        layer: "top",
        connectedTo: ["source_net_0"],
      },
    ],
  }
  const vmJumper: AutoplacedJumper = {
    ...groundJumper,
    pads: [
      {
        ...groundJumper.pads[0],
        connectedTo: ["source_trace_8", "source_trace_154"],
      },
      { ...groundJumper.pads[1], connectedTo: ["source_trace_8"] },
    ],
  }

  expect(db.source_trace.get("source_trace_154")).toBeNull()
  insertAutoplacedJumpers({
    db,
    output_jumpers: [groundJumper, vmJumper],
  })

  expect(
    db.source_trace.get("source_trace_154")?.connected_source_net_ids,
  ).toEqual(["source_net_0"])
  const connMap = getFullConnectivityMapFromCircuitJson(db.toArray())
  expect(connMap.areIdsConnected("source_port_155", "source_port_150")).toBe(
    false,
  )
})
