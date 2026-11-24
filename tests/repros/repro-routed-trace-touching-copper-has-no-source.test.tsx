import { expect, test } from "bun:test"
import { getSourceTraceIdForRoutedTrace } from "lib/components/primitive-components/Group/get-source-trace-id-for-routed-trace"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("an unowned trace cannot inherit its source from copper it touches", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={12} height={8}>
      <resistor name="R1" resistance="1k" footprint="0402" pcbX={-3} />
      <resistor name="R2" resistance="1k" footprint="0402" pcbX={3} />
      <trace from="R1.pin2" to="R2.pin1" pcbStraightLine />
      <pcbnotetext
        text="Touching this trace cannot assign the spur a source owner"
        pcbY={-2}
        fontSize={0.35}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const unownedSpur = circuit.db.pcb_trace.insert({
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      { route_type: "wire", x: 0, y: 2, width: 0.15, layer: "top" },
    ],
  })
  expect(() =>
    getSourceTraceIdForRoutedTrace({ db: circuit.db, trace: unownedSpur }),
  ).toThrow("Autorouted trace has no declared source connection")
  expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
