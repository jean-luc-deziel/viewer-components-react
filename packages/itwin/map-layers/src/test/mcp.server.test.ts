/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { server } from "../mcp/server";
import { setViewportAccessor } from "../mcp/viewport";

setViewportAccessor(() => undefined);

describe("MCP server registration", () => {
  let client: Client;

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "test-client", version: "1.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("server lists all 9 expected tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain("open_map_layers_widget");
    expect(names).toContain("toggle_background_map");
    expect(names).toContain("set_base_map_type");
    expect(names).toContain("set_map_transparency");
    expect(names).toContain("toggle_terrain");
    expect(names).toContain("get_map_layer_info");
    expect(names).toContain("attach_map_layer");
    expect(names).toContain("detach_map_layer");
    expect(names).toContain("set_map_layer_visibility");
    expect(names).toHaveLength(9);
  });

  it("calling a tool with no viewport returns an error response (not a crash)", async () => {
    const result = await client.callTool({ name: "get_map_layer_info", arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text).error).toContain("No active viewport");
  });

  it("toggle_background_map rejects invalid input", async () => {
    await expect(
      client.callTool({ name: "toggle_background_map", arguments: { enabled: "yes" } }),
    ).rejects.toThrow();
  });
});
