/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as moq from "typemoq";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ViewportMock } from "./ViewportMock";
import {
  toggleBackgroundMap,
  getMapLayerInfo,
  attachMapLayer,
  detachMapLayer,
  setMapLayerVisibility,
} from "../mcp/tools";

describe("MCP tools smoke tests", () => {
  const vp = new ViewportMock();
  beforeEach(() => vp.setup());
  afterEach(() => vp.reset());

  it("throws when no viewport is available", () => {
    expect(() => toggleBackgroundMap(undefined)).toThrow("No active viewport");
  });

  it("toggleBackgroundMap returns new state", () => {
    // Use a plain object because typemoq proxies block property setters
    const mockVp: any = {};
    Object.defineProperty(mockVp, "viewFlags", {
      get: () => ({ backgroundMap: false, with: (_k: string, v: any) => ({ backgroundMap: v }) }),
      set: () => {},
      configurable: true,
    });
    expect(toggleBackgroundMap(mockVp, true).backgroundMapEnabled).toBe(true);
    expect(toggleBackgroundMap(mockVp, false).backgroundMapEnabled).toBe(false);
  });

  it("getMapLayerInfo returns empty layers by default", () => {
    const result = getMapLayerInfo(vp.object);
    expect(result.backgroundLayers).toHaveLength(0);
    expect(result.overlayLayers).toHaveLength(0);
    expect(result.backgroundMapEnabled).toBe(true);
  });

  it("getMapLayerInfo returns attached layers", () => {
    vp.backgroundLayers.push(
      ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "MyLayer", url: "https://example.com/wms" })!,
    );
    const result = getMapLayerInfo(vp.object);
    expect(result.backgroundLayers).toHaveLength(1);
    expect(result.backgroundLayers[0].name).toBe("MyLayer");
  });

  it("attachMapLayer returns attached=true", () => {
    vp.displayStyleMock.setup((ds) => ds.attachMapLayer(moq.It.isAny())).returns(() => {});
    const result = attachMapLayer(vp.object, "https://example.com/wms", "TestLayer");
    expect(result.attached).toBe(true);
    expect(result.name).toBe("TestLayer");
  });

  it("detachMapLayer removes a layer by name", () => {
    vp.backgroundLayers.push(
      ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: "https://example.com/wms" })!,
    );
    const result = detachMapLayer(vp.object, "TestLayer");
    expect(result.detached).toHaveLength(1);
    expect(result.detached[0]).toContain("TestLayer");
  });

  it("setMapLayerVisibility updates a layer", () => {
    vp.backgroundLayers.push(
      ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: "https://example.com/wms" })!,
    );
    const result = setMapLayerVisibility(vp.object, "TestLayer", false);
    expect(result.visible).toBe(false);
    expect(result.updated).toBe(1);
  });
});
