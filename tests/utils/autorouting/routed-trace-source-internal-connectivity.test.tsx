import { expect, test } from "bun:test"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"
import type { Port } from "lib/components/primitive-components/Port"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("routed endpoints respect declared internal source connections", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={12} height={8} routingDisabled>
      <interconnect name="J1" standard="0603" />
      <resistor name="R1" resistance="1k" footprint="0402" pcbX={-3} />
      <resistor name="R2" resistance="1k" footprint="0402" pcbX={3} />
      <trace from=".R1 > .pin1" to=".J1 > .pin1" pcbStraightLine />
      <trace from=".J1 > .pin2" to=".R2 > .pin1" pcbStraightLine />
      <pcbnotetext
        pcbY={-2}
        fontSize={0.4}
        text="J1 explicitly connects both source branches"
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const startPort = circuit.selectOne(".R1 > .pin1") as Port
  const endPort = circuit.selectOne(".R2 > .pin1") as Port
  const startPcbPort = circuit.db.pcb_port.get(startPort.pcb_port_id!)!
  const endPcbPort = circuit.db.pcb_port.get(endPort.pcb_port_id!)!
  const sourceTraceId = circuit.db.source_trace.list()[0].source_trace_id
  expect(
    getSourceTraceIdForRoutedTrace({
      db: circuit.db,
      trace: {
        type: "pcb_trace",
        pcb_trace_id: "declared_internal_connection_route",
        source_trace_id: sourceTraceId,
        route: [
          {
            route_type: "wire",
            x: startPcbPort.x,
            y: startPcbPort.y,
            width: 0.15,
            layer: "top",
            start_pcb_port_id: startPort.pcb_port_id!,
          },
          {
            route_type: "wire",
            x: endPcbPort.x,
            y: endPcbPort.y,
            width: 0.15,
            layer: "top",
            end_pcb_port_id: endPort.pcb_port_id!,
          },
        ],
      },
    }),
  ).toBe(sourceTraceId)
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
