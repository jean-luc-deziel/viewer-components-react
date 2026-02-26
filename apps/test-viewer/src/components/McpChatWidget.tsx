/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useRef, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { getMcpClient } from "../mcp-client";

// Match the environment prefix used for other Bentley services (e.g. "qa-", "dev-", or "")
const URL_PREFIX: string = process.env.IMJS_URL_PREFIX ?? "";
const GATEWAY_BASE = `https://${URL_PREFIX}aigateway.bentley.com/openai/deployments`;
const DEPLOYMENT = "gpt-4.1";
const API_VERSION = "2024-10-21";

interface Message {
  role: "user" | "assistant";
  text: string;
}

async function getAccessToken(): Promise<string> {
  const token = await IModelApp.getAccessToken();
  // Gateway expects the token without the "Bearer " prefix
  return token.startsWith("Bearer ") ? token.slice(7) : token;
}

export function McpChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    const userText = input.trim();
    if (!userText || loading) return;

    setInput("");
    setLoading(true);

    const next: Message[] = [...messages, { role: "user", text: userText }];
    setMessages(next);

    try {
      const client = getMcpClient();
      if (!client) throw new Error("MCP client not initialized yet.");

      const token = await getAccessToken();
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        console.log("[McpChat] token payload:", JSON.stringify({ iss: payload.iss, aud: payload.aud, scope: payload.scope, scp: payload.scp }, null, 2));
      } catch { console.log("[McpChat] could not decode token"); }

      // Get tool definitions from MCP server and convert to Azure OpenAI format
      const { tools: mcpTools } = await client.listTools();
      const tools = mcpTools.map((t: { name: string; description?: string; inputSchema: Record<string, unknown> }) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          // Azure OpenAI requires "properties" on object schemas even when there are no parameters
          parameters: { ...t.inputSchema, properties: (t.inputSchema.properties as object | undefined) ?? {} },
        },
      }));

      // Build conversation history
      const apiMessages: any[] = [
        {
          role: "system",
          content: "You are a helpful assistant that controls map layers in an iTwin.js 3D viewer. Use the available tools to fulfill the user's requests.",
        },
        ...next.map((m) => ({ role: m.role, content: m.text })),
      ];

      // Agentic loop — keep going until the model stops calling tools
      let assistantText = "";
      while (true) {
        const res = await fetch(`${GATEWAY_BASE}/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: apiMessages, tools, tool_choice: "auto" }),
        });

        console.log("[McpChat] full response:", res);
        const resClone = res.clone();
        const resBody = await resClone.text();
        console.log("[McpChat] response body:", resBody);

        if (!res.ok) {
          const body = await res.text();
          console.error("[McpChat] gateway error", res.status, body);
          throw new Error(`Gateway error: ${res.status} ${body}`);
        }
        const data = await res.json();
        const choice = data.choices[0];
        const message = choice.message;

        // Add assistant message to history
        apiMessages.push(message);

        if (choice.finish_reason === "stop") {
          assistantText = message.content ?? "(no response)";
          break;
        }

        if (choice.finish_reason === "tool_calls") {
          // Execute each tool call via MCP client
          const toolResults: any[] = [];
          for (const toolCall of message.tool_calls ?? []) {
            const args = JSON.parse(toolCall.function.arguments);
            try {
              const result = await client.callTool({ name: toolCall.function.name, arguments: args });
              toolResults.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: (result.content as any)[0]?.text ?? "",
              });
            } catch (e: any) {
              toolResults.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: `Error: ${e.message}`,
              });
            }
          }
          // Feed results back
          apiMessages.push(...toolResults);
          continue;
        }

        break;
      }

      setMessages([...next, { role: "assistant", text: assistantText }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px", gap: "8px" }}>
      {/* Message history */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
        {messages.length === 0 && (
          <div style={{ color: "#888", fontSize: "13px", padding: "8px" }}>
            Ask me to control the map layers. E.g. "toggle terrain on" or "what layers do I have?"
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "#0066cc" : "#2a2a2a",
              color: "#fff",
              borderRadius: "8px",
              padding: "6px 10px",
              maxWidth: "85%",
              fontSize: "13px",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && <div style={{ alignSelf: "flex-start", color: "#888", fontSize: "13px", padding: "4px 8px" }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #444", background: "#1a1a1a", color: "#fff", fontSize: "13px" }}
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void sendMessage();
          }}
          disabled={loading}
        />
        <button
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            background: "#0066cc",
            color: "#fff",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "13px",
          }}
          onClick={() => void sendMessage()}
          disabled={loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
