import type { CircuitJsonUtilObjects } from "@tscircuit/circuit-json-util"
import type { PcbTrace, SourcePort, SourceTrace } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import type {
  SimplifiedPcbTrace,
  SrjConnectionName,
} from "lib/utils/autorouting/SimpleRouteJson"

type RoutedTrace = (PcbTrace | SimplifiedPcbTrace) & {
  source_trace_id?: SourceTrace["source_trace_id"]
  connection_name?: SrjConnectionName
  connectsTo?: SimplifiedPcbTrace["connectsTo"]
}
type SourcePortId = SourcePort["source_port_id"]

function getDeclaredSourcePortIdsFromRoutedTrace(
  db: CircuitJsonUtilObjects,
  trace: RoutedTrace,
) {
  const sourcePortIds = new Set<SourcePortId>()

  for (const pcbPortId of trace.connectsTo ?? []) {
    const sourcePortId = db.pcb_port.get(pcbPortId)?.source_port_id
    if (sourcePortId) sourcePortIds.add(sourcePortId)
  }

  for (const point of trace.route) {
    if (point.route_type !== "wire") continue
    for (const pcbPortId of [point.start_pcb_port_id, point.end_pcb_port_id]) {
      if (!pcbPortId) continue
      const sourcePortId = db.pcb_port.get(pcbPortId)?.source_port_id
      if (sourcePortId) sourcePortIds.add(sourcePortId)
    }
  }

  return [...sourcePortIds]
}

function getSourcePortDisplayName(
  db: CircuitJsonUtilObjects,
  sourcePortId: SourcePortId,
) {
  const sourcePort = db.source_port.get(sourcePortId)
  const sourceComponent = sourcePort?.source_component_id
    ? db.source_component.get(sourcePort.source_component_id)
    : undefined
  return `${sourceComponent?.name ?? "unnamed component"}.${sourcePort?.name ?? "unnamed pin"}`
}

export function getSourceTraceIdForRoutedTrace({
  db,
  trace,
}: {
  db: CircuitJsonUtilObjects
  trace: RoutedTrace
}) {
  const connMap = getFullConnectivityMapFromCircuitJson(db.toArray())
  const declaredSourcePortIds = getDeclaredSourcePortIdsFromRoutedTrace(
    db,
    trace,
  )
  const declaredEndpointNetIds = new Set(
    declaredSourcePortIds.flatMap((sourceId) => {
      const netId = connMap.getNetConnectedToId(sourceId)
      return netId ? [netId] : []
    }),
  )
  if (declaredEndpointNetIds.size > 1) {
    throw new Error(
      `Autorouted trace declares endpoints on different intended nets: ${declaredSourcePortIds
        .map((sourcePortId) => getSourcePortDisplayName(db, sourcePortId))
        .join(", ")}`,
    )
  }
  // The router's connection name identifies the requested source connection.
  // Missing ownership stays missing; endpoint geometry cannot supply intent.
  const sourceOwnerId = trace.source_trace_id ?? trace.connection_name
  const sourceOwner = sourceOwnerId
    ? (db.source_trace.get(sourceOwnerId) ?? db.source_net.get(sourceOwnerId))
    : undefined
  if (!sourceOwner) {
    throw new Error(
      "Autorouted trace has no declared source connection. Preserve its source owner or input connection name.",
    )
  }
  const declaredOwnerId =
    sourceOwner.type === "source_trace"
      ? sourceOwner.source_trace_id
      : sourceOwner.source_net_id
  const declaredOwnerConnectivityNetId = declaredOwnerId
    ? connMap.getNetConnectedToId(declaredOwnerId)
    : undefined
  const requestedSourceOwner = trace.connection_name
    ? (db.source_trace.get(trace.connection_name) ??
      db.source_net.get(trace.connection_name))
    : undefined
  if (
    requestedSourceOwner &&
    trace.connection_name &&
    connMap.getNetConnectedToId(trace.connection_name) !==
      declaredOwnerConnectivityNetId
  ) {
    throw new Error(
      "Autorouted trace declares conflicting source connections. Preserve the requested source owner.",
    )
  }
  if (
    declaredOwnerConnectivityNetId &&
    [...declaredEndpointNetIds].some(
      (netId) => netId !== declaredOwnerConnectivityNetId,
    )
  ) {
    const ownerSourceNet =
      sourceOwner.type === "source_net"
        ? sourceOwner
        : connMap
            .getIdsConnectedToNet(declaredOwnerConnectivityNetId)
            .map((sourceId) => db.source_net.get(sourceId))
            .find((sourceNet) => sourceNet)
    const ownerDisplayName =
      ownerSourceNet?.name ??
      sourceOwner.name ??
      (sourceOwner.type === "source_trace"
        ? sourceOwner.display_name
        : undefined) ??
      "unnamed source connection"
    throw new Error(
      `Autorouted trace assigned to ${ownerDisplayName} declares endpoints outside its intended source net: ${declaredSourcePortIds
        .map((sourcePortId) => getSourcePortDisplayName(db, sourcePortId))
        .join(", ")}`,
    )
  }
  if (sourceOwner.type === "source_trace") return sourceOwner.source_trace_id

  const routedNetSourceTraces = connMap
    .getIdsConnectedToNet(declaredOwnerConnectivityNetId!)
    .flatMap((sourceId) => {
      const sourceTrace = db.source_trace.get(sourceId)
      return sourceTrace ? [sourceTrace] : []
    })
  // A net with one source trace can retain that trace's routing constraints.
  if (routedNetSourceTraces.length === 1)
    return routedNetSourceTraces[0].source_trace_id
  // A declared endpoint can identify a unique branch within this already
  // validated net (for example, a constrained pin-to-plane connection).
  // Shared endpoints remain net-owned; touching copper never identifies intent.
  const endpointSourceTraces = routedNetSourceTraces.filter((sourceTrace) =>
    declaredSourcePortIds.some((sourcePortId) =>
      sourceTrace.connected_source_port_ids.includes(sourcePortId),
    ),
  )
  if (endpointSourceTraces.length === 1)
    return endpointSourceTraces[0].source_trace_id
  return sourceOwner.source_net_id
}
