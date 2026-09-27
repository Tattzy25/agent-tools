import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer(env) {
  const server = new McpServer({
    name: "Agent Tools",
    version: "1.0.0"
  });

  server.registerTool(
    "get_browser_session_id",
    {
      description: "Get a browser session ID",
      inputSchema: {}
    },
    async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      const response = await fetch(env.GET_BROWSER_ID_URL, {
        method: "POST",
        headers
      });
      const data = await response.json();
      return {
        content: [
          {
            text: JSON.stringify(data),
            type: "text"
          }
        ]
      };
    }
  );

  server.registerTool(
    "acquire_browser_session",
    {
      description: "Acquire and connect to a browser session",
      inputSchema: {
        keep_alive: z.number().min(10000).max(1200000).optional(),
        lab: z.boolean().optional(),
        recording: z.boolean().optional(),
        guardrails: z.string().optional()
      }
    },
    async ({ keep_alive, lab, recording }) => {
      const params = new URLSearchParams();
      if (keep_alive) params.set("keep_alive", String(keep_alive));
      if (lab) params.set("lab", "true");
      if (recording) params.set("recording", "true");
      const qs = params.toString();
      const response = await fetch(
        qs ? `${env.ACQ_BROWSER_SESSION_URL}?${qs}` : env.ACQ_BROWSER_SESSION_URL,
        { method: "GET", headers: {} }
      );
      const data = await response.json();
      return {
        content: [
          {
            text: JSON.stringify(data),
            type: "text"
          }
        ]
      };
    }
  );

  server.registerTool(
    "connect_to_session",
    {
      description: "Connect to a browser session",
      inputSchema: {
        session_id: z.string().describe("Browser session ID to connect to"),
        keep_alive: z.number().min(10000).max(1200000).optional(),
        lab: z.boolean().optional(),
        recording: z.boolean().optional()
      }
    },
    async ({ session_id, keep_alive, lab, recording }) => {
      const params = new URLSearchParams();
      if (keep_alive) params.set("keep_alive", String(keep_alive));
      if (lab) params.set("lab", "true");
      if (recording) params.set("recording", "true");
      const qs = params.toString();
      const response = await fetch(
        qs ? `${env.CONNECT_TO_SESSION_URL}?${qs}` : env.CONNECT_TO_SESSION_URL,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id })
        }
      );
      const data = await response.json();
      return {
        content: [
          {
            text: JSON.stringify(data),
            type: "text"
          }
        ]
      };
    }
  );

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
} satisfies ExportedHandler;
