import type {
  SourceComponentInternalConnection,
  SourceTrace,
} from "circuit-json"

/** Unnamed wiring covered by a component's declared internal connection. */
export function isSourceTraceInternalConnection(
  sourceTrace: SourceTrace,
  internalConnections: SourceComponentInternalConnection[],
) {
  if (sourceTrace.name) return false
  if (sourceTrace.connected_source_net_ids.length > 0) return false
  if (sourceTrace.connected_source_port_ids.length < 2) return false
  return internalConnections.some((internalConnection) =>
    sourceTrace.connected_source_port_ids.every((sourcePortId) =>
      internalConnection.source_port_ids.includes(sourcePortId),
    ),
  )
}
