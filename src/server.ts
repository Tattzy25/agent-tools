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
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
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
        keep_alive: z.number().min(10000).max(1200000).optional().describe("Keep-alive time in milliseconds (10000-1200000)"),
        lab: z.boolean().optional().describe("Use experimental browser"),
        recording: z.boolean().optional().describe("Enable session recording")
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
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            "Upgrade": "websocket"
          }
        }
      );
      const ws = response.webSocket;
      ws.accept();
      return {
        content: [
          {
            text: JSON.stringify({ status: "connected" }),
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
        keep_alive: z.number().min(10000).max(1200000).optional().describe("Keep-alive time in milliseconds (10000-1200000)"),
        lab: z.boolean().optional().describe("Use experimental browser"),
        recording: z.boolean().optional().describe("Enable session recording")
      }
    },
    async ({ session_id, keep_alive, lab, recording }) => {
      const params = new URLSearchParams();
      if (keep_alive) params.set("keep_alive", String(keep_alive));
      if (lab) params.set("lab", "true");
      if (recording) params.set("recording", "true");
      const qs = params.toString();
      const url = `${env.CONNECT_TO_SESSION_URL}/${session_id}${qs ? `?${qs}` : ""}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Upgrade": "websocket"
        }
      });
      const ws = response.webSocket;
      ws.accept();
      return {
        content: [
          {
            text: JSON.stringify({ status: "connected", sessionId: session_id }),
            type: "text"
          }
        ]
      };
    }
  );

  server.registerTool(
    "close_browser_session",
    {
      description: "Close a browser session",
      inputSchema: {
        session_id: z.string().describe("Browser session ID to close")
      }
    },
    async ({ session_id }) => {
      const response = await fetch(`${env.CLOSE_SESSION_URL}/${session_id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        }
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
    "get_browser_version",
    {
      description: "Get browser version metadata",
      inputSchema: {
        session_id: z.string().describe("Browser session ID")
      }
    },
    async ({ session_id }) => {
      const response = await fetch(`${env.BROWSER_VERSION_URL}/${session_id}/json/version`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        }
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
    "get_cdp_protocol",
    {
      description: "Get the Chrome DevTools Protocol schema including all domains, commands, events, and types",
      inputSchema: {
        session_id: z.string().describe("Browser session ID")
      }
    },
    async ({ session_id }) => {
      const response = await fetch(`${env.CDP_PROTOCOL_URL}/${session_id}/json/protocol`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        }
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
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
} satisfies ExportedHandler;
