import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("net-owned imported copper retains its geometry when source IDs change", async () => {
  const { circuit: original } = getTestFixture()
  original.add(
    <board width={14} height={8} schematicDisabled>
      <resistor
        name="R1"
        resistance="1k"
        footprint="0402"
        pcbX={-3}
        connections={{ pin1: "net.SIGNAL" }}
      />
      <resistor
        name="R2"
        resistance="1k"
        footprint="0402"
        pcbX={3}
        layer="bottom"
        connections={{ pin1: "net.SIGNAL" }}
      />
    </board>,
  )
  await original.renderUntilSettled()
  const originalTrace = original.db.pcb_trace.list()[0]
  expect(original.db.source_net.get(originalTrace.source_trace_id!)?.name).toBe(
    "SIGNAL",
  )

  const { circuit } = getTestFixture()
  circuit.add(
    <board width={14} height={12} schematicDisabled>
      <net name="OTHER" />
      <resistor name="R_EXTRA" resistance="2k" footprint="0402" pcbY={4} />
      <pcbtrace
        route={[
          { route_type: "wire", x: -3, y: 5, width: 0.1, layer: "top" },
          { route_type: "wire", x: 3, y: 5, width: 0.1, layer: "top" },
        ]}
      />
      <subcircuit name="Imported" circuitJson={original.getCircuitJson()} />
      <pcbnotetext
        text="Imported SIGNAL keeps its net owner and original copper"
        pcbY={-4}
        fontSize={0.45}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  expect(circuit.db.pcb_trace.list()).toHaveLength(2)
  const importedTrace = circuit.db.pcb_trace.list()[1]
  expect(importedTrace.pcb_trace_id).not.toBe(originalTrace.pcb_trace_id)
  expect(importedTrace.source_trace_id).not.toBe(originalTrace.source_trace_id)
  expect(circuit.db.source_net.get(importedTrace.source_trace_id!)?.name).toBe(
    "SIGNAL",
  )
  expect(circuit.db.pcb_via.list()).toHaveLength(1)
  expect(circuit.db.pcb_via.list()[0]).toMatchObject({
    pcb_trace_id: importedTrace.pcb_trace_id,
    x: original.db.pcb_via.list()[0].x,
    y: original.db.pcb_via.list()[0].y,
    hole_diameter: original.db.pcb_via.list()[0].hole_diameter,
    outer_diameter: original.db.pcb_via.list()[0].outer_diameter,
    layers: original.db.pcb_via.list()[0].layers,
  })
  const originalWire = originalTrace.route
    .filter((point) => point.route_type === "wire")
    .map(({ start_pcb_port_id, end_pcb_port_id, ...wire }) => wire)
  const importedWire = importedTrace.route
    .filter((point) => point.route_type === "wire")
    .map(({ start_pcb_port_id, end_pcb_port_id, ...wire }) => wire)
  expect(importedWire).toEqual(originalWire)
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
