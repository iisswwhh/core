import type { SourceTrace } from "circuit-json"
import type { NormalComponent } from "lib/components/base-components/NormalComponent"

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

/** Associate footprint bridge copper with its already-declared source bridge. */
export function assignDeclaredJumperBridgeTraces({
  component,
  sourceTraces,
}: {
  component: NormalComponent
  sourceTraces: SourceTrace[]
}) {
  const { db } = component.root!
  for (const trace of db.pcb_trace.list({
    pcb_component_id: component.pcb_component_id!,
  })) {
    if (trace.source_trace_id) continue
    const sourcePortIds = trace.route.flatMap((point) => {
      if (point.route_type !== "wire") return []
      return [point.start_pcb_port_id, point.end_pcb_port_id].flatMap(
        (pcbPortId) => {
          if (!pcbPortId) return []
          const sourcePortId = db.pcb_port.get(pcbPortId)?.source_port_id
          return sourcePortId ? [sourcePortId] : []
        },
      )
    })
    if (sourcePortIds.length < 2) continue
    const sourceTrace = sourceTraces.find((sourceTrace) =>
      sourcePortIds.every((sourcePortId) =>
        sourceTrace.connected_source_port_ids.includes(sourcePortId),
      ),
    )
    if (sourceTrace)
      db.pcb_trace.update(trace.pcb_trace_id, {
        source_trace_id: sourceTrace.source_trace_id,
      })
  }
}
