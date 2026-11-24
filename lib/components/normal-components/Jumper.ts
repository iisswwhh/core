import { NormalComponent } from "lib/components/base-components/NormalComponent"
import { jumperProps, resolveManufacturerPartNumber } from "@tscircuit/props"
import { normalizeDegrees } from "@tscircuit/math-utils"
import { Port } from "../primitive-components/Port"
import type { SourceTrace } from "circuit-json"
import {
  createDeclaredJumperBridgeTraces,
  attachDeclaredJumperBridgeTraces,
} from "lib/utils/components/declared-jumper-bridge-traces"
import type { BaseSymbolName } from "lib/utils/constants"
import {
  getAllDimensionsForSchematicBox,
  type SchematicBoxDimensions,
} from "lib/utils/schematic/getAllDimensionsForSchematicBox"
import { underscorifyPortArrangement } from "lib/soup/underscorifyPortArrangement"
import { underscorifyPinStyles } from "lib/soup/underscorifyPinStyles"

export class Jumper<PinLabels extends string = never> extends NormalComponent<
  typeof jumperProps,
  PinLabels
> {
  schematicDimensions: SchematicBoxDimensions | null = null
  private bridgeSourceTraces: SourceTrace[] = []

  override doInitialSourceParentAttachment() {
    super.doInitialSourceParentAttachment()
    for (const sourceTrace of this.bridgeSourceTraces)
      this.root!.db.source_trace.delete(sourceTrace.source_trace_id)
    this.bridgeSourceTraces = []
  }

  doInitialSourceAddConnectivityMapKey() {
    this.bridgeSourceTraces = createDeclaredJumperBridgeTraces(this)
  }

  get config() {
    // Jumpers always render as generic schematic boxes instead of using
    // solderjumper-specific symbols.
    return {
      schematicSymbolName: undefined,
      componentName: "Jumper",
      zodProps: jumperProps,
      shouldRenderAsSchematicBox: true,
    }
  }

  _getSchematicPortArrangement() {
    const arrangement = super._getSchematicPortArrangement()
    if (arrangement && Object.keys(arrangement).length > 0) return arrangement

    const pinCount =
      this._parsedProps.pinCount ??
      (Array.isArray(this._parsedProps.pinLabels)
        ? this._parsedProps.pinLabels.length
        : this._parsedProps.pinLabels
          ? Object.keys(this._parsedProps.pinLabels).length
          : this.getPortsFromFootprint().length)

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
