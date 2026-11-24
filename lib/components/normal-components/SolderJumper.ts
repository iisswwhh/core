import { NormalComponent } from "lib/components/base-components/NormalComponent"
import {
  solderjumperProps,
  resolveManufacturerPartNumber,
} from "@tscircuit/props"
import { normalizeDegrees } from "@tscircuit/math-utils"
import { Port } from "../primitive-components/Port"
import type { SourceTrace } from "circuit-json"
import {
  createDeclaredJumperBridgeTraces,
  attachDeclaredJumperBridgeTraces,
} from "lib/utils/components/declared-jumper-bridge-traces"
import type { SchematicBoxDimensions } from "lib/utils/schematic/getAllDimensionsForSchematicBox"

export class SolderJumper<
  PinLabels extends string = never,
> extends NormalComponent<typeof solderjumperProps, PinLabels> {
  schematicDimensions: SchematicBoxDimensions | null = null
  private bridgeSourceTraces: SourceTrace[] = []

  override doInitialSourceParentAttachment() {
    super.doInitialSourceParentAttachment()
    for (const sourceTrace of this.bridgeSourceTraces)
      this.root!.db.source_trace.delete(sourceTrace.source_trace_id)
    this.bridgeSourceTraces = createDeclaredJumperBridgeTraces(this)
  }

  private _getPinCountFromFootprintString(footprint: string): 2 | 3 | null {
    const match = footprint.match(/^solderjumper([23])(?:_|$)/)
    if (!match) return null
    return Number(match[1]) as 2 | 3
  }

  // Used during footprint resolution before ports can be selected.
  private _getPinNumberFromBridgedPinsProp(pinName: string): number | null {
    const numericPinMatch = pinName.match(/^(?:pin)?(\d+)$/i)
    if (numericPinMatch) return Number(numericPinMatch[1])

    const pinLabels = this._parsedProps.pinLabels ?? this.props.pinLabels
    if (Array.isArray(pinLabels)) {
      const labelIndex = pinLabels.findIndex((label) => label === pinName)
      return labelIndex >= 0 ? labelIndex + 1 : null
    }

    if (pinLabels && typeof pinLabels === "object") {
      for (const [pinKey, labelOrLabels] of Object.entries(pinLabels)) {
        const labels = Array.isArray(labelOrLabels)
          ? labelOrLabels
          : [labelOrLabels]
        if (!labels.includes(pinName)) continue

        const pinNumberMatch = pinKey.match(/^(?:pin)?(\d+)$/i)
        return pinNumberMatch ? Number(pinNumberMatch[1]) : null
      }
    }

    return null
  }

  private _getBridgedPinNumbersForFootprint(pinCount: 2 | 3): number[] {
    const props = this._parsedProps ?? this.props
    if (Array.isArray(props.bridgedPins) && props.bridgedPins.length > 0) {
      return Array.from(
        new Set(
          props.bridgedPins
            .flat()
            .map((pinName: string) =>
              this._getPinNumberFromBridgedPinsProp(pinName),
            )
            .filter(
              (pinNumber): pinNumber is number =>
                pinNumber !== null && pinNumber >= 1 && pinNumber <= pinCount,
            ),
        ),
      ).sort((a, b) => a - b)
    }

    if (!props.bridged) return []
    return Array.from({ length: pinCount }, (_, index) => index + 1)
  }

  resolveFootprint() {
    const footprint = super.resolveFootprint()
    if (typeof footprint !== "string") return footprint

    const pinCount = this._getPinCountFromFootprintString(footprint)
    if (!pinCount) return footprint

    // Respect explicit low-level footprint variants like solderjumper3_bridged23.
    if (/_bridged\d+/.test(footprint)) return footprint

    const bridgedPinNumbers = this._getBridgedPinNumbersForFootprint(pinCount)
    if (bridgedPinNumbers.length === 0) return footprint

    return footprint.replace(
      /^solderjumper[23]/,
      `solderjumper${pinCount}_bridged${bridgedPinNumbers.join("")}`,
    )
  }

  _getPinNumberFromBridgedPinName(pinName: string): number | null {
    const port = this.selectOne(`port.${pinName}`, {
      type: "port",
    }) as Port | null
    return port?._parsedProps.pinNumber ?? null
  }

  get defaultInternallyConnectedPinNames(): string[][] {
    if (this._parsedProps.bridged) {
      const pins = this.children
        .filter((c) => c.componentName === "Port")
        .map((p) => (p as Port).name)
      return pins.length > 0 ? [pins] : []
    }
    return this._parsedProps.bridgedPins ?? []
  }

  get config() {
    const props = this._parsedProps ?? this.props
    let resolvedPinCount = props.pinCount
    if (props.pinCount == null && !props.footprint) {
      // If neither pinCount nor a footprint is given, assume two pins
      resolvedPinCount = 2
    }
    if (props.pinCount == null) {
      const nums = (props.bridgedPins ?? [])
        .flat()
        .map((p_str: string) => this._getPinNumberFromBridgedPinName(p_str))
        .filter((n): n is number => n !== null)
      const maxPinFromBridged = nums.length > 0 ? Math.max(...nums) : 0

      const pinCountFromLabels = props.pinLabels
        ? Object.keys(props.pinLabels).length
        : 0

      const finalPinCount = Math.max(maxPinFromBridged, pinCountFromLabels)

      // This logic is related to available solderjumper2, solderjumper3 symbols
      if (finalPinCount === 2 || finalPinCount === 3) {
        resolvedPinCount = finalPinCount as 2 | 3
      }

      // Fallback: infer from footprint pin count
      if (
        resolvedPinCount == null &&
        props.footprint &&
        [2, 3].includes(this.getPortsFromFootprint().length)
      ) {
        resolvedPinCount = this.getPortsFromFootprint().length as 2 | 3
      }
    }

    let symbolName = ""
    if (resolvedPinCount) {
      symbolName += `solderjumper${resolvedPinCount}`
    } else {
      // Fallback if pinCount couldn't be resolved (e.g. from non-numeric bridgedPins)
      // This might lead to a generic box if "solderjumper" itself isn't a symbol.
      symbolName = "solderjumper"
    }

    let bridgedPinNumbers: number[] = []
    if (Array.isArray(props.bridgedPins) && props.bridgedPins.length > 0) {
      // Normalize pin names (e.g., "pin1" to "1"), then get unique sorted numbers
      bridgedPinNumbers = Array.from(
        new Set(
          (props.bridgedPins as string[][])
            .flat()
            .map((pinName) => this._getPinNumberFromBridgedPinName(pinName))
            .filter((n): n is number => n !== null),
        ),
      ).sort((a, b) => a - b)
    } else if (props.bridged && resolvedPinCount) {
      bridgedPinNumbers = Array.from(
        { length: resolvedPinCount },
        (_, i) => i + 1,
      )
    }

    if (bridgedPinNumbers.length > 0) {
      symbolName += `_bridged${bridgedPinNumbers.join("")}`
    }
    return {
      schematicSymbolName: props.symbolName ?? symbolName,
      componentName: "SolderJumper",
      zodProps: solderjumperProps,
      shouldRenderAsSchematicBox: true,
    }
  }

  _getSchematicPortArrangement() {
    const arrangement = super._getSchematicPortArrangement()
    if (arrangement && Object.keys(arrangement).length > 0) return arrangement

    let pinCount =
      this._parsedProps.pinCount ??
      (Array.isArray(this._parsedProps.pinLabels)
        ? this._parsedProps.pinLabels.length
        : this._parsedProps.pinLabels
          ? Object.keys(this._parsedProps.pinLabels).length
          : this.getPortsFromFootprint().length)

    if (pinCount == null && !this._parsedProps.footprint) {
      pinCount = 2
    }

    const direction = this._parsedProps.schDirection ?? "right"

    return {
      leftSize: direction === "left" ? pinCount : 0,
      rightSize: direction === "right" ? pinCount : 0,
    }
  }

  doInitialSourceRender(): void {
    const { db } = this.root!
    const { _parsedProps: props } = this
    const { pcbX, pcbY } = this.getResolvedPcbPositionProp()

    const source_component = db.source_component.insert({
      ftype: "simple_chip", // TODO unknown or jumper
      name: this.name,
      manufacturer_part_number: resolveManufacturerPartNumber(props),
      supplier_part_numbers: props.supplierPartNumbers,
      are_pins_interchangeable: true,
      display_name: props.displayName,
    })
    this.source_component_id = source_component.source_component_id!
  }

  doInitialPcbComponentRender() {
    if (this.root?.pcbDisabled) return
    const { db } = this.root!
    const { _parsedProps: props } = this
    const { pcbX, pcbY } = this.getResolvedPcbPositionProp()
    const globalTransformRotation = this.getGlobalTransformRotation()

    const pcb_component = db.pcb_component.insert({
      footprint_origin: this._getGlobalPcbPositionBeforeLayout(),
      center: { x: pcbX, y: pcbY },
      width: 2, // Default width, adjust as needed
      height: 3, // Default height, adjust as needed
      layer: props.layer ?? "top",
      rotation: normalizeDegrees(globalTransformRotation),
      insertion_direction: this._getPcbComponentInsertionDirection(
        props.layer ?? "top",
        globalTransformRotation,
      ),
      source_component_id: this.source_component_id!,
      subcircuit_id: this.getSubcircuit().subcircuit_id ?? undefined,
      do_not_place: props.doNotPlace ?? false,
      obstructs_within_bounds: props.obstructsWithinBounds ?? true,
      is_allowed_to_be_off_board: props.allowOffBoard ?? false,
      metadata: props.kicadFootprintMetadata
        ? { kicad_footprint: props.kicadFootprintMetadata }
        : undefined,
    })

    this.pcb_component_id = pcb_component.pcb_component_id
  }

  doInitialPcbPortAttachment() {
    attachDeclaredJumperBridgeTraces({
      component: this,
      sourceTraces: this.bridgeSourceTraces,
    })
  }
}
