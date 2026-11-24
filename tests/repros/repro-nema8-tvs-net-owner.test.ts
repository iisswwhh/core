import { expect, test } from "bun:test"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbNoteText } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"
import fixture from "../fixtures/nema8-tvs-sample/circuit.json"

test("a NEMA8 route assigned to the VM source net cannot declare two GND endpoints", async () => {
  const db = su(structuredClone(fixture) as AnyCircuitElement[])
  const vm = db.source_net.insert({ name: "VM", member_source_group_ids: [] })
  db.source_trace.update("source_trace_8", {
    connected_source_net_ids: [vm.source_net_id],
  })
  const savedTrace = db.pcb_trace.list()[0]
  const capacitorGround = db.pcb_port.get("pcb_port_156")!
  const trace = db.pcb_trace.update(savedTrace.pcb_trace_id, {
    source_trace_id: vm.source_net_id,
    route: [
      {
        route_type: "wire",
        x: capacitorGround.x,
        y: capacitorGround.y,
        layer: "top",
        width: 0.56,
        start_pcb_port_id: capacitorGround.pcb_port_id,
      },
      ...savedTrace.route.slice(1),
    ],
  })

  expect(() => getSourceTraceIdForRoutedTrace({ db, trace })).toThrow(
    "Autorouted trace assigned to VM declares endpoints outside its intended source net: C_VM_HF1.pin2, D_VM_TVS.pin2",
  )
  const groundSourceTrace = db.source_trace
    .list()
    .find((sourceTrace) =>
      sourceTrace.connected_source_port_ids.includes(
        capacitorGround.source_port_id,
      ),
    )!
  expect(() =>
    getSourceTraceIdForRoutedTrace({
      db,
      trace: {
        ...trace,
        source_trace_id: groundSourceTrace.source_trace_id,
        connection_name: vm.source_net_id,
      },
    }),
  ).toThrow("conflicting source connections")

  const resultNote: PcbNoteText = {
    type: "pcb_note_text",
    pcb_note_text_id: "source_net_owner_result",
    anchor_position: { x: 0, y: -5.05 },
    anchor_alignment: "center",
    layer: "top",
    font: "tscircuit2024",
    font_size: 0.3,
    color: "#0f172a",
    text: "Source net VM with two GND endpoints: rejected",
  }
  await expect(
    convertCircuitJsonToPcbSvg([...db.toArray(), resultNote], {
      width: 1000,
      height: 700,
      backgroundColor: "#fff",
      colorOverrides: {
        silkscreen: { top: "#64748b" },
        boardOutline: "#cbd5e1",
      },
      includeVersion: false,
      showPinNumbers: true,
      shouldDrawRatsNest: false,
      viewport: { minX: -9.5, maxX: 9.5, minY: -6.5, maxY: 6.5 },
    }),
  ).toMatchSvgSnapshot(import.meta.path, undefined, {
    diffThresholdPercent: 0,
  })
})
