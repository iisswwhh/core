import type { CircuitJsonUtilObjects } from "@tscircuit/circuit-json-util"
import type { PackOutput } from "calculate-packing"
import { isSourceTraceInternalConnection } from "lib/utils/circuit-json/is-source-trace-internal-connection"

/** Internal jumper bridges describe wiring, not component placement constraints. */
export function removeInternalPackingConnections({
  db,
  packOutput,
}: {
  db: CircuitJsonUtilObjects
  packOutput: PackOutput
}) {
  const internalConnections = db.source_component_internal_connection.list()
  if (internalConnections.length === 0) return

  const placementTraces = db.source_trace.list().filter((sourceTrace) => {
    return (
      sourceTrace.connected_source_port_ids.length === 2 &&
      sourceTrace.connected_source_net_ids.length === 0 &&
      !isSourceTraceInternalConnection(sourceTrace, internalConnections)
    )
  })

  packOutput.weightedConnections = packOutput.weightedConnections?.filter(
    ({ padIds }) => {
      const sourcePortIds = padIds.map((padId) => {
        const pad = db.pcb_smtpad.get(padId) ?? db.pcb_plated_hole.get(padId)
        if (!pad?.pcb_port_id) return undefined
        return db.pcb_port.get(pad.pcb_port_id)?.source_port_id
      })
      return placementTraces.some((sourceTrace) =>
        sourcePortIds.every(
          (sourcePortId) =>
            sourcePortId &&
            sourceTrace.connected_source_port_ids.includes(sourcePortId),
        ),
      )
    },
  )
}
