import * as p from "core/properties"
import {isArray} from "core/util/types"
import {sort_by, includes, intersection} from "core/util/array"

import {Tool} from "./tool"
import {GestureTool} from "./gestures/gesture_tool"
import {InspectTool} from "./inspectors/inspect_tool"

import {ToolbarBase, ToolbarBaseView, GestureType} from "./toolbar_base"

// XXX: add appropriate base classes to get rid of this
export type Drag = Tool
export type Inspection = Tool
export type Scroll = Tool
export type Tap = Tool

type ActiveGestureToolsProps = {
  active_drag: p.Property<Drag | "auto" | null>
  active_scroll: p.Property<Scroll | "auto" | null>
  active_tap: p.Property<Tap | "auto" | null>
  active_multi: p.Property<GestureTool | null>
}

type ActiveToolsProps = ActiveGestureToolsProps & {
  active_inspect: p.Property<Inspection | Inspection[] | "auto" | null>
}

export namespace Toolbar {
  export type Attrs = p.AttrsOf<Props>

  export type Props = ToolbarBase.Props & ActiveToolsProps
}

export interface Toolbar extends Toolbar.Attrs {}

const _get_active_attr = (et: string): keyof ActiveGestureToolsProps | null => {
  switch (et) {
    case 'tap': return 'active_tap'
    case 'pan': return 'active_drag'
    case 'pinch':
    case 'scroll': return 'active_scroll'
    case 'multi': return 'active_multi'
  }
  return null
}

const _supports_auto = (et: string) => {
  return et == 'tap' || et == 'pan'
}

export class Toolbar extends ToolbarBase {
  properties: Toolbar.Props

  constructor(attrs?: Partial<Toolbar.Attrs>) {
    super(attrs)
  }

  static initClass(): void {
    this.prototype.default_view = ToolbarBaseView

    this.define<Toolbar.Props>({
      active_drag:     [ p.Any, 'auto' ],
      active_inspect:  [ p.Any, 'auto' ],
      active_scroll:   [ p.Any, 'auto' ],
      active_tap:      [ p.Any, 'auto' ],
      active_multi:    [ p.Any, null   ],
    })
  }

  connect_signals(): void {
    super.connect_signals()
    this.connect(this.properties.tools.change, () => this._init_tools())
  }

  protected _init_tools(): void {
    super._init_tools()

    if (this.active_inspect == 'auto') {
      // do nothing as all tools are active be default
    } else if (this.active_inspect instanceof InspectTool) {
      let found = false
      for (const inspector of this.inspectors) {
        if (inspector != this.active_inspect)
          inspector.active = false
        else
          found = true
      }
      if (!found) {
        this.active_inspect = null
      }
    } else if (isArray(this.active_inspect)) {
      const active_inspect = intersection(this.active_inspect, this.inspectors)
      if (active_inspect.length != this.active_inspect.length) {
        this.active_inspect = active_inspect
      }
      for (const inspector of this.inspectors) {
        if (!includes(this.active_inspect, inspector))
          inspector.active = false
      }
    } else if (this.active_inspect == null) {
      for (const inspector of this.inspectors)
        inspector.active = false
    }

    const _activate_gesture = (tool: Tool) => {
      if (tool.active) {
        // tool was activated by a proxy, but we need to finish configuration manually
        this._active_change(tool)
      } else
        tool.active = true
    }

    // Connecting signals has to be done before changing the active state of the tools.
    for (const et in this.gestures) {
      const gesture = this.gestures[et as GestureType]

      gesture.tools = sort_by(gesture.tools, (tool) => tool.default_order)
      for (const tool of gesture.tools) {
        this.connect(tool.properties.active.change, this._active_change.bind(this, tool))
      }
    }

    for (const et in this.gestures) {
      const active_attr = _get_active_attr(et)
      if (active_attr) {
        const active_et = this[active_attr]
        if (active_et == 'auto') {
          const gesture = this.gestures[et as GestureType]
          if (gesture.tools.length != 0 && _supports_auto(et)) {
            _activate_gesture(gesture.tools[0])
          }
        }
        else if (active_et != null) {
          if (includes(this.tools, active_et)) {
            _activate_gesture(active_et)
          } else {
            this[active_attr] = null
          }
        }
      }
    }
  }
}
Toolbar.initClass()
