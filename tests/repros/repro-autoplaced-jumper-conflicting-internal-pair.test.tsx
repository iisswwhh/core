import { expect, test } from "bun:test"
import { insertAutoplacedJumpers } from "lib/components/primitive-components/Group/insert-autoplaced-jumpers"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("an internal jumper pair cannot join different intended nets", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={12} height={8} routingDisabled>
      <chip
        name="J1"
        footprint="pinrow2"
        pinLabels={{ pin1: ["VM"], pin2: ["GND"] }}
        connections={{ pin1: "net.VM", pin2: "net.GND" }}
      />
      <pcbnotetext
        pcbY={-3}
        fontSize={0.4}
        text="JUMPER JOINING VM AND GND: REJECTED"
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const { db } = circuit
  const vm = db.source_net.getWhere({ name: "VM" })!
  const ground = db.source_net.getWhere({ name: "GND" })!
  const originalCircuitJson = structuredClone(db.toArray())

  expect(() =>
    insertAutoplacedJumpers({
      db,
      output_jumpers: [
        {
          jumper_footprint: "0603",
          center: { x: 0, y: 0 },
          orientation: "vertical",
          pads: [
            {
              center: { x: -1, y: 0 },
              width: 0.6,
              height: 0.8,
              layer: "top",
              connectedTo: [vm.source_net_id],
            },
            {
              center: { x: 1, y: 0 },
              width: 0.6,
              height: 0.8,
              layer: "top",
              connectedTo: [ground.source_net_id],
            },
          ],
        },
      ],
    }),
  ).toThrow(
    "Autoplaced jumper would connect different intended source nets: VM, GND.",
  )
  expect(db.toArray()).toEqual(originalCircuitJson)
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
