import type { Trace } from "lib/components/primitive-components/Trace/Trace"
import type { Port } from "lib/components/primitive-components/Port"
import type { PcbPortId } from "./circuit-json-id-types"

/** Resolve imported pin identities after the target circuit allocates PCB IDs. */
export function remapInflatedPcbPortId(
  trace: Pick<Trace, "getSubcircuit" | "_inflatedPcbPortSelectors">,
  pcbPortId: PcbPortId | undefined,
) {
  if (!pcbPortId) return undefined
  const selector = trace._inflatedPcbPortSelectors?.get(pcbPortId)
  const port = selector
    ? trace.getSubcircuit().selectOne<Port>(selector, { type: "port" })
    : undefined
  if (!port?.pcb_port_id) {
    throw new Error(
      `Cannot restore imported trace endpoint: ${selector ?? "unnamed pin"} has no PCB port.`,
    )
  }
  return port.pcb_port_id
}
