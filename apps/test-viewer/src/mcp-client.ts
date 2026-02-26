/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Initializes the map-layers MCP server in-process using InMemoryTransport
 * and exposes an MCP client that the chat widget uses to list and call tools.
 */

import { IModelApp } from "@itwin/core-frontend";
import { server, setViewportAccessor } from "@itwin/map-layers/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

let _client: Client | undefined;

export async function initMcpClient(): Promise<void> {
  // Lazy viewport accessor — always reads the current open view at call time
  setViewportAccessor(() => IModelApp.viewManager.getFirstOpenView() ?? undefined);

  // Connect the server and client via in-memory transport (no network needed)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  _client = new Client({ name: "viewer-chat", version: "1.0" });
  await _client.connect(clientTransport);
}

export function getMcpClient(): Client | undefined {
  return _client;
}
