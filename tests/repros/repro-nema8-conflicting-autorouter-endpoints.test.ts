import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"

const conflictingPcbTraceId =
  "source_trace_3__source_trace_4__source_trace_5__source_trace_6__source_trace_7__source_trace_8__source_trace_9__source_trace_10__source_trace_11_mst7_0"

test("the full NEMA8 board rejects routed traces that contradict source intent", () => {
  const bytes = gunzipSync(
    readFileSync(
      new URL(
        "../fixtures/nema8-conflicting-autorouter-endpoints/circuit.json.gz",
        import.meta.url,
      ),
    ),
  )
  const circuitJson = JSON.parse(bytes.toString("utf8")) as AnyCircuitElement[]
  const db = su(circuitJson)
  const autoroutedPcbTrace = db.pcb_trace.get(conflictingPcbTraceId)!

  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "32f2eaaa2d3878ec108a9f8789e857d26a17b4bebeddd2d4aabfb1d923c373c1",
  )
  expect(circuitJson).toHaveLength(2469)
  expect(db.source_component.list()).toHaveLength(56)
  expect(db.source_trace.list()).toHaveLength(154)
  expect(autoroutedPcbTrace.route[0]).toMatchObject({
    start_pcb_port_id: "pcb_port_155",
  })
  expect(autoroutedPcbTrace.route.at(-1)).toMatchObject({
    end_pcb_port_id: "pcb_port_150",
  })
  expect(db.source_port.get("source_port_155")).toMatchObject({
    subcircuit_connectivity_map_key: "CONTROLLER_PCB_connectivity_net2",
  })
  expect(db.source_port.get("source_port_150")).toMatchObject({
    subcircuit_connectivity_map_key: "CONTROLLER_PCB_connectivity_net33",
  })
  expect(() =>
    getSourceTraceIdForRoutedTrace({
      db,
      trace: autoroutedPcbTrace,
    }),
  ).toThrow(
    "Autorouted trace declares endpoints on different intended nets: C_VM_HF1.pin1, D_VM_TVS.pin2",
  )

  // Even when both endpoints agree with each other, they must agree with VM.
  const capacitorGroundPort = db.pcb_port.get("pcb_port_156")!
  const wrongNetTrace = {
    ...autoroutedPcbTrace,
    source_trace_id: "source_trace_8",
    route: [
      {
        route_type: "wire" as const,
        x: capacitorGroundPort.x,
        y: capacitorGroundPort.y,
        layer: "bottom" as const,
        width: 0.56,
        start_pcb_port_id: capacitorGroundPort.pcb_port_id,
      },
      ...autoroutedPcbTrace.route.slice(1),
    ],
  }
  expect(() =>
    getSourceTraceIdForRoutedTrace({ db, trace: wrongNetTrace }),
  ).toThrow("declares endpoints outside its intended source net")
  expect(() =>
    getSourceTraceIdForRoutedTrace({
      db,
      trace: {
        ...wrongNetTrace,
        source_trace_id: undefined,
        connection_name: undefined,
      },
    }),
  ).toThrow("Autorouted trace has no declared source connection")
})
