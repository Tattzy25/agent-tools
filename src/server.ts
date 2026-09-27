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
      const response = await fetch(env.GET_BROWSER_ID_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        }
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
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
        content: [{ type: "text", text: JSON.stringify({ status: "connected" }) }]
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
        content: [{ type: "text", text: JSON.stringify({ status: "connected", sessionId: session_id }) }]
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
        headers: { "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
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
        headers: { "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
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
        headers: { "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
      };
    }
  );

  server.registerTool(
    "mint_live_view_url",
    {
      description: "Generate time-limited URLs to view a remote browser session",
      inputSchema: {
        session_id: z.string().describe("Browser session ID"),
        expiresInMs: z.number().min(60000).max(3600000).optional().describe("How long the live view URLs remain valid in milliseconds (60000-3600000, default 5 minutes)"),
        mode: z.enum(["devtools", "tab", "full"]).optional().describe("UI mode: devtools (Chrome DevTools), tab (single tab view), full (multi-tab browser)"),
        targetId: z.string().optional().describe("Target ID (page) to connect to. If omitted, auto-resolves to the first active page"),
        readonly: z.boolean().optional().describe("Set to true for a view-only link")
      }
    },
    async ({ session_id, expiresInMs, mode, targetId, readonly }) => {
      const body = {};
      if (expiresInMs) body.expiresInMs = expiresInMs;
      if (mode) body.mode = mode;
      if (targetId) body.targetId = targetId;
      if (readonly) body.guardrails = { mode: "readonly" };
      const response = await fetch(`${env.LIVE_VIEW_URL}/${session_id}/live_view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
      };
    }
  );

  server.registerTool(
    "get_accessibility_tree",
    {
      description: "Get the accessibility tree of a page. Navigate to a URL or provide HTML content.",
      inputSchema: {
        url: z.string().optional().describe("URL to navigate to"),
        html: z.string().optional().describe("HTML content to render"),
        interestingOnly: z.boolean().optional().describe("Only return semantically meaningful nodes"),
        root: z.string().optional().describe("CSS selector to scope the tree to a subtree"),
        cacheTTL: z.number().min(0).max(86400).optional().describe("Cache TTL in seconds (default 5, set 0 to disable)"),
        waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("When to consider navigation complete"),
        timeout: z.number().max(60000).optional().describe("Navigation timeout in milliseconds (max 60000)"),
        userAgent: z.string().optional().describe("Custom user agent string"),
        setJavaScriptEnabled: z.boolean().optional().describe("Enable or disable JavaScript"),
        actionTimeout: z.number().max(120000).optional().describe("Max duration for browser action after page load in milliseconds (max 120000)"),
        waitForSelector: z.string().optional().describe("CSS selector to wait for before proceeding"),
        waitForTimeout: z.number().max(120000).optional().describe("Timeout to wait before continuing in milliseconds (max 120000)")
      }
    },
    async ({ url, html, interestingOnly, root, cacheTTL, waitUntil, timeout, userAgent, setJavaScriptEnabled, actionTimeout, waitForSelector, waitForTimeout }) => {
      const body = {};
      if (url) body.url = url;
      if (html) body.html = html;
      if (interestingOnly !== undefined) body.interestingOnly = interestingOnly;
      if (root) body.root = root;
      if (waitUntil || timeout) {
        body.gotoOptions = {};
        if (waitUntil) body.gotoOptions.waitUntil = waitUntil;
        if (timeout) body.gotoOptions.timeout = timeout;
      }
      if (userAgent) body.userAgent = userAgent;
      if (setJavaScriptEnabled !== undefined) body.setJavaScriptEnabled = setJavaScriptEnabled;
      if (actionTimeout) body.actionTimeout = actionTimeout;
      if (waitForSelector) body.waitForSelector = { selector: waitForSelector };
      if (waitForTimeout) body.waitForTimeout = waitForTimeout;
      const qs = cacheTTL !== undefined ? `?cacheTTL=${cacheTTL}` : "";
      const response = await fetch(`${env.ACCESSIBILITY_TREE_URL}${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
      };
    }
  );
  
    server.registerTool(
    "get_html_content",
    {
      description: "Fetch rendered HTML content from a URL or HTML content",
      inputSchema: {
        url: z.string().optional().describe("URL to navigate to"),
        html: z.string().optional().describe("HTML content to render"),
        cacheTTL: z.number().min(0).max(86400).optional().describe("Cache TTL in seconds (default 5, set 0 to disable)"),
        waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().describe("When to consider navigation complete"),
        timeout: z.number().max(60000).optional().describe("Navigation timeout in milliseconds (max 60000)"),
        userAgent: z.string().optional().describe("Custom user agent string"),
        setJavaScriptEnabled: z.boolean().optional().describe("Enable or disable JavaScript"),
        actionTimeout: z.number().max(120000).optional().describe("Max duration for browser action after page load in milliseconds (max 120000)"),
        waitForSelector: z.string().optional().describe("CSS selector to wait for before proceeding"),
        waitForTimeout: z.number().max(120000).optional().describe("Timeout to wait before continuing in milliseconds (max 120000)")
      }
    },
    async ({ url, html, cacheTTL, waitUntil, timeout, userAgent, setJavaScriptEnabled, actionTimeout, waitForSelector, waitForTimeout }) => {
      const body = {};
      if (url) body.url = url;
      if (html) body.html = html;
      if (waitUntil || timeout) {
        body.gotoOptions = {};
        if (waitUntil) body.gotoOptions.waitUntil = waitUntil;
        if (timeout) body.gotoOptions.timeout = timeout;
      }
      if (userAgent) body.userAgent = userAgent;
      if (setJavaScriptEnabled !== undefined) body.setJavaScriptEnabled = setJavaScriptEnabled;
      if (actionTimeout) body.actionTimeout = actionTimeout;
      if (waitForSelector) body.waitForSelector = { selector: waitForSelector };
      if (waitForTimeout) body.waitForTimeout = waitForTimeout;
      const qs = cacheTTL !== undefined ? `?cacheTTL=${cacheTTL}` : "";
      const response = await fetch(`${env.CONTENT_URL}${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data) }]
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
