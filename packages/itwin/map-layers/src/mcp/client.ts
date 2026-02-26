/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { server } from "./server";

/** Minimal interface exposed to consumers so they don't need a direct SDK dependency. */
export interface McpClientLike {
  listTools(): Promise<{ tools: Array<{ name: string; description?: string; inputSchema: object }> }>;
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<{ content: Array<{ text?: string }> }>;
}

/**
 * Creates an MCP {@link Client} connected to the map-layers server via
 * InMemoryTransport.  The caller only sees the {@link McpClientLike} interface,
 * so no direct dependency on `@modelcontextprotocol/sdk` is needed.
 */
export async function createMcpClient(): Promise<McpClientLike> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "viewer-chat", version: "1.0" });
  await client.connect(clientTransport);

  return client as unknown as McpClientLike;
}
