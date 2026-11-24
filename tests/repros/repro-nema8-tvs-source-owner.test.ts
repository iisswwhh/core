import { expect, test } from "bun:test"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbNoteText } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"
import fixture from "../fixtures/nema8-tvs-sample/circuit.json"

test("a VM-owned NEMA8 trace cannot declare two GND endpoints", async () => {
  const db = su(structuredClone(fixture) as AnyCircuitElement[])
  const savedTrace = db.pcb_trace.list()[0]
  const capacitorGround = db.pcb_port.get("pcb_port_156")!
  const trace = db.pcb_trace.update(savedTrace.pcb_trace_id, {
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
    "Autorouted trace assigned to VM: C_VM_HF1.pin1 to D_VM_TVS.cathode declares endpoints outside its intended source net: C_VM_HF1.pin2, D_VM_TVS.pin2",
  )

  const resultNote: PcbNoteText = {
    type: "pcb_note_text",
    pcb_note_text_id: "source_owner_result",
    anchor_position: { x: 0, y: -5.05 },
    anchor_alignment: "center",
    layer: "top",
    font: "tscircuit2024",
    font_size: 0.3,
    color: "#0f172a",
    text: "VM-owned trace with two GND endpoints: rejected",
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
