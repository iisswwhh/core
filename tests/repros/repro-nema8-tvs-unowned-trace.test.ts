import { expect, test } from "bun:test"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbNoteText } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"
import fixture from "../fixtures/nema8-tvs-sample/circuit.json"

test("an unowned NEMA8 trace cannot acquire a source owner from its GND endpoints", async () => {
  const db = su(structuredClone(fixture) as AnyCircuitElement[])
  const savedTrace = db.pcb_trace.list()[0]
  const capacitorGround = db.pcb_port.get("pcb_port_156")!
  const trace = db.pcb_trace.update(savedTrace.pcb_trace_id, {
    source_trace_id: undefined,
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
    "Autorouted trace has no declared source connection",
  )

  const resultNote: PcbNoteText = {
    type: "pcb_note_text",
    pcb_note_text_id: "unowned_trace_result",
    anchor_position: { x: 0, y: -5.05 },
    anchor_alignment: "center",
    layer: "top",
    font: "tscircuit2024",
    font_size: 0.3,
    color: "#0f172a",
    text: "Two GND endpoints cannot supply missing source ownership: error",
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
