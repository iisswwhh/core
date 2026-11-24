import { expect, test } from "bun:test"
import type { Port } from "lib/components/primitive-components/Port"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("imported trace endpoints refer to the original pins after PCB IDs change", async () => {
  const { circuit: original } = getTestFixture()
  original.add(
    <board width={14} height={8}>
      <resistor name="R1" resistance="1k" footprint="0402" pcbX={-3} />
      <resistor name="R2" resistance="2k" footprint="0402" pcbX={3} />
      <trace from=".R1 .pin2" to=".R2 .pin1" pcbStraightLine />
    </board>,
  )
  await original.renderUntilSettled()

  const { circuit } = getTestFixture()
  circuit.add(
    <board width={14} height={12}>
      <resistor name="R_EXTRA" resistance="3k" footprint="0402" pcbY={4} />
      <subcircuit name="Imported" circuitJson={original.getCircuitJson()} />
      <pcbnotetext
        text="Imported trace keeps R1.2 to R2.1 after pin IDs change"
        pcbY={-4}
        fontSize={0.5}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const importedTrace = circuit.db.pcb_trace.list()[0]
  const startPort = circuit.selectOne(".Imported .R1 .pin2") as Port
  const endPort = circuit.selectOne(".Imported .R2 .pin1") as Port
  expect(importedTrace.route[0]).toMatchObject({
    start_pcb_port_id: startPort.pcb_port_id,
  })
  expect(importedTrace.route.at(-1)).toMatchObject({
    end_pcb_port_id: endPort.pcb_port_id,
  })
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
