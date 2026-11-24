import type { PcbPort, SourceTrace } from "circuit-json"
import type { NormalComponent } from "lib/components/base-components/NormalComponent"
import type { PcbPortId } from "lib/utils/circuit-json/circuit-json-id-types"

function resolveJumperTracePortId({
  component,
  pcbPorts,
  pcbPortId,
}: {
  component: NormalComponent
  pcbPorts: PcbPort[]
  pcbPortId: PcbPortId | undefined
}) {
  const pinLabel = pcbPortId?.match(/^\{PIN(.+)\}$/)?.[1]
  if (!pinLabel) return pcbPortId
  const { db } = component.root!
  const pcbPort = pcbPorts.find((pcbPort) => {
    const sourcePort = db.source_port.get(pcbPort.source_port_id)
    return (
      sourcePort?.pin_number?.toString() === pinLabel ||
      sourcePort?.name === pinLabel ||
      sourcePort?.name === `pin${pinLabel}` ||
      sourcePort?.port_hints?.some(
        (hint) => hint === pinLabel || hint === `pin${pinLabel}`,
      )
    )
  })
  if (!pcbPort) {
    throw new Error(
      `Cannot attach jumper bridge: ${component.name ?? "unnamed jumper"}.${pinLabel} has no PCB port.`,
    )
  }
  return pcbPort.pcb_port_id
}

/** Render bridge intent from the jumper's declared internal pin connections. */
export function createDeclaredJumperBridgeTraces(component: NormalComponent) {
  if (component.selectAll("pcbtrace").length === 0) return []
  const { db } = component.root!
  return component._getInternallyConnectedPins().map((ports) =>
    db.source_trace.insert({
      connected_source_port_ids: ports.map((port) => port.source_port_id!),
      connected_source_net_ids: [],
      display_name: `${component.name} internal bridge`,
      subcircuit_id: component.getSubcircuit().subcircuit_id!,
    }),
  )
}

/** Attach declared pin endpoints and source ownership through database updates. */
export function attachDeclaredJumperBridgeTraces({
  component,
  sourceTraces,
}: {
  component: NormalComponent
  sourceTraces: SourceTrace[]
}) {
  const { db } = component.root!
  const pcbPorts = db.pcb_port.list({
    pcb_component_id: component.pcb_component_id!,
  })
  for (const trace of db.pcb_trace.list({
    pcb_component_id: component.pcb_component_id!,
  })) {
    const route = trace.route.map((point) => {
      if (point.route_type !== "wire") return point
      return {
        ...point,
        start_pcb_port_id: resolveJumperTracePortId({
          component,
          pcbPorts,
          pcbPortId: point.start_pcb_port_id,
        }),
        end_pcb_port_id: resolveJumperTracePortId({
          component,
          pcbPorts,
          pcbPortId: point.end_pcb_port_id,
        }),
      }
    })
    const sourcePortIds = route.flatMap((point) => {
      if (point.route_type !== "wire") return []
      return [point.start_pcb_port_id, point.end_pcb_port_id].flatMap(
        (pcbPortId) => {
          if (!pcbPortId) return []
          const sourcePortId = db.pcb_port.get(pcbPortId)?.source_port_id
          return sourcePortId ? [sourcePortId] : []
        },
      )
    })
    const sourceTrace = sourceTraces.find(
      (sourceTrace) =>
        sourcePortIds.length >= 2 &&
        sourcePortIds.every((sourcePortId) =>
          sourceTrace.connected_source_port_ids.includes(sourcePortId),
        ),
    )
    db.pcb_trace.update(trace.pcb_trace_id, {
      route,
      source_trace_id: trace.source_trace_id ?? sourceTrace?.source_trace_id,
    })
  }
}
