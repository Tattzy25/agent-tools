import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "Agent Tools",
    version: "1.0.0"
  });

  server.registerTool(
    "get_browser_session_id",
    {
      description: "Get a browser session ID",
      inputSchema: { name: z.string().optional() }
    },
    async ({ name }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      const response = await fetch(env.BROWSER_API_URL, {
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

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer)(request, env, ctx);
  }
} satisfies ExportedHandler;
