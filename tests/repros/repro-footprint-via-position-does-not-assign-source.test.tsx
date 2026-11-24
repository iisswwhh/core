import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("via position inside or outside a pad cannot declare source ownership", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={12} height={8} routingDisabled>
      <chip
        name="U1"
        pinLabels={{ pin1: ["GND"] }}
        connections={{ pin1: "net.GND" }}
        footprint={
          <footprint>
            <smtpad portHints={["pin1"]} width={2} height={2} shape="rect" />
            <via pcbX={0} pcbY={0} holeDiameter={0.3} outerDiameter={0.6} />
            <via pcbX={3} pcbY={0} holeDiameter={0.3} outerDiameter={0.6} />
          </footprint>
        }
      />
      <pcbnotetext pcbY={1.5} fontSize={0.35} text="U1.GND" />
      <pcbnotetext
        pcbY={-3}
        fontSize={0.4}
        text="NO DECLARED VIA CONNECTION: BOTH UNASSIGNED"
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const sourceVias = circuit.db.source_manually_placed_via.list()
  expect(sourceVias).toHaveLength(2)
  for (const sourceVia of sourceVias) {
    expect(sourceVia.source_trace_id).toBeUndefined()
    expect(sourceVia.source_net_id).toBeUndefined()
  }
  for (const pcbVia of circuit.db.pcb_via.list()) {
    expect(pcbVia.source_trace_id).toBeUndefined()
    expect(pcbVia.source_net_id).toBeUndefined()
    expect(pcbVia.subcircuit_connectivity_map_key).toBeUndefined()
  }
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
