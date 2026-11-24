import { expect, test } from "bun:test"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("explicit via pin connections preserve source ownership at either position", async () => {
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
            <via
              pcbX={0}
              pcbY={0}
              holeDiameter={0.3}
              outerDiameter={0.6}
              connectsTo="pin1"
            />
            <via
              pcbX={3}
              pcbY={0}
              holeDiameter={0.3}
              outerDiameter={0.6}
              connectsTo="pin1"
            />
          </footprint>
        }
      />
      <pcbnotetext pcbY={1.5} fontSize={0.35} text="U1.GND" />
      <pcbnotetext
        pcbY={-3}
        fontSize={0.4}
        text="DECLARED VIA PIN CONNECTION: BOTH ON GND"
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const sourceVias = circuit.db.source_manually_placed_via.list()
  const ground = circuit.db.source_net.getWhere({ name: "GND" })!
  const connMap = getFullConnectivityMapFromCircuitJson(
    circuit.getCircuitJson(),
  )
  expect(sourceVias).toHaveLength(2)
  for (const sourceVia of sourceVias) {
    expect(sourceVia.source_trace_id).toBeDefined()
    expect(
      connMap.areIdsConnected(sourceVia.source_trace_id!, ground.source_net_id),
    ).toBe(true)
  }
  for (const pcbVia of circuit.db.pcb_via.list()) {
    expect(pcbVia.source_trace_id).toBeDefined()
    expect(
      connMap.areIdsConnected(pcbVia.pcb_via_id, ground.source_net_id),
    ).toBe(true)
  }
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
