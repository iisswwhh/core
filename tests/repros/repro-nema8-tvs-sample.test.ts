import { expect, test } from "bun:test"
import { su } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbNoteText } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"
import fixture from "../fixtures/nema8-tvs-sample/circuit.json"

test("the NEMA8 TVS sample rejects a saved VM route ending on GND", async () => {
  const circuitJson = fixture as AnyCircuitElement[]
  const db = su(circuitJson)
  const trace = db.pcb_trace.list()[0]
  expect(() => getSourceTraceIdForRoutedTrace({ db, trace })).toThrow(
    "Autorouted trace declares endpoints on different intended nets: C_VM_HF1.pin1, D_VM_TVS.pin2",
  )

  const resultNote: PcbNoteText = {
    type: "pcb_note_text",
    pcb_note_text_id: "core_result",
    anchor_position: { x: 0, y: -5.05 },
    anchor_alignment: "center",
    layer: "top",
    font: "tscircuit2024",
    font_size: 0.4,
    color: "#166534",
    text: "REJECTED: VM trace ends on GND",
  }
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, resultNote], {
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
