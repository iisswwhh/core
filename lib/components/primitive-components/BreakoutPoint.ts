import { breakoutPointProps } from "@tscircuit/props"
import { BaseBreakoutPoint } from "./BaseBreakoutPoint"
import type { Port } from "./Port"
import type { Net } from "./Net"

export class BreakoutPoint extends BaseBreakoutPoint<
  typeof breakoutPointProps
> {
  get config() {
    return {
      componentName: "BreakoutPoint",
      zodProps: breakoutPointProps,
    }
  }

  _matchConnection(): void {
    if (this.matchedPort) return
    const { connection } = this._parsedProps
    const subcircuit = this.getSubcircuit()
    if (!subcircuit) return
    this.matchedPort = subcircuit.selectOne(connection, {
      type: "port",
    }) as Port
    if (!this.matchedPort) {
      this.matchedNet = subcircuit.selectOne(connection, { type: "net" }) as Net
    }
    if (!this.matchedPort && !this.matchedNet) {
      this.renderError(`Could not find connection target "${connection}"`)
    }
  }

  doInitialSourceAddConnectivityMapKey(): void {
    this._matchConnection()
    // A manual breakout can extend an otherwise unconnected pin. Declare that
    // source connection before asking the router to produce its copper.
    if (this.matchedPort && !this._getSourceTraceIdForPort(this.matchedPort)) {
      const sourceTrace = this.root!.db.source_trace.insert({
        connected_source_port_ids: [this.matchedPort.source_port_id!],
        connected_source_net_ids: [],
        display_name: `${this._parsedProps.connection} breakout`,
        subcircuit_id: this.getSubcircuit().subcircuit_id!,
      })
      this.matchedSourceTraceId = sourceTrace.source_trace_id
    }
  }

  doInitialPcbPrimitiveRender(): void {
    this._matchConnection()
    this._renderPcbBreakoutPoint()
  }
}
