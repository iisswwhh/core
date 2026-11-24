import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("a footprint via resolves its pin selector within its own component", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={14} height={8} routingDisabled>
      <chip
        name="U_VM"
        pcbX={-3}
        pinLabels={{ pin1: ["VM"] }}
        connections={{ pin1: "net.VM" }}
        footprint={
          <footprint>
            <smtpad portHints={["pin1"]} width={2} height={2} shape="rect" />
            <via holeDiameter={0.3} outerDiameter={0.6} connectsTo=".pin1" />
          </footprint>
        }
      />
      <pcbnotetext pcbX={-3} pcbY={1.5} fontSize={0.35} text="U_VM.VM" />
      <pcbnotetext pcbX={3} pcbY={1.5} fontSize={0.35} text="U_GND.GND" />
      <chip
        name="U_GND"
        pcbX={3}
        pinLabels={{ pin1: ["GND"] }}
        connections={{ pin1: "net.GND" }}
        footprint={
          <footprint>
            <smtpad portHints={["pin1"]} width={2} height={2} shape="rect" />
            <via holeDiameter={0.3} outerDiameter={0.6} connectsTo=".pin1" />
          </footprint>
        }
      />
      <pcbnotetext
        pcbY={-3}
        fontSize={0.4}
        text="FOOTPRINT VIA PIN SELECTORS STAY LOCAL"
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const { db } = circuit
  const vm = db.source_component.getWhere({ name: "U_VM" })!
  const ground = db.source_component.getWhere({ name: "U_GND" })!
  const vmPort = db.source_port.getWhere({
    source_component_id: vm.source_component_id,
  })!
  const groundPort = db.source_port.getWhere({
    source_component_id: ground.source_component_id,
  })!
  const sourceVias = db.source_manually_placed_via.list()

  expect(
    db.source_trace.get(sourceVias[0].source_trace_id!)
      ?.connected_source_port_ids,
  ).toEqual([vmPort.source_port_id])
  expect(
    db.source_trace.get(sourceVias[1].source_trace_id!)
      ?.connected_source_port_ids,
  ).toEqual([groundPort.source_port_id])
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
