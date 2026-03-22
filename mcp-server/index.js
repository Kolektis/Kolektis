#!/usr/bin/env node

/**
 * Kolektis MCP Server
 *
 * Provides Claude with tools to process documents via the Kolektis API.
 * Authenticates via API key (set as environment variable at plugin install time).
 *
 * Tools:
 *   - kolektis_process_pdf    : Send a single PDF for processing
 *   - kolektis_process_batch  : Send multiple PDFs in one call
 *   - kolektis_list_results   : List all results from this session
 *   - kolektis_get_result     : Get full result for a specific document
 *   - kolektis_account_info   : Check account status, credits, and usage
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import FormData from "form-data";

// ─── Configuration ──────────────────────────────────────────────────────────

const API_KEY = process.env.KOLEKTIS_API_KEY;
const API_BASE = process.env.KOLEKTIS_API_URL || "https://www.kolektis.com";

const PROCESS_ENDPOINT = `${API_BASE}/api/plugin/process`;
const ACCOUNT_ENDPOINT = `${API_BASE}/api/account`;

if (!API_KEY) {
  console.error(
    "ERROR: KOLEKTIS_API_KEY is not set. Please configure your API key."
  );
  console.error("Get your key at: https://www.kolektis.com/signup");
  process.exit(1);
}

// ─── State ──────────────────────────────────────────────────────────────────

const sessionResults = new Map(); // filename -> result

// ─── Helpers ────────────────────────────────────────────────────────────────

function authHeaders() {
  return { "X-API-Key": API_KEY };
}

async function processPdf(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (stat.size > 50 * 1024 * 1024) {
    throw new Error(`File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Max: 50 MB.`);
  }

  const fileName = path.basename(absolutePath);
  const form = new FormData();
  form.append("file", fs.createReadStream(absolutePath), {
    filename: fileName,
    contentType: "application/pdf",
  });

  const resp = await fetch(PROCESS_ENDPOINT, {
    method: "POST",
    headers: {
      ...authHeaders(),
      ...form.getHeaders(),
    },
    body: form,
  });

  if (resp.status === 401) {
    throw new Error(
      "Invalid API key. Please check your Kolektis API key at https://www.kolektis.com/account"
    );
  }

  if (resp.status === 402) {
    throw new Error(
      "Insufficient credits. Please top up your account at https://www.kolektis.com/account/billing"
    );
  }

  if (resp.status === 429) {
    throw new Error(
      "Rate limit exceeded. Please wait a moment and try again."
    );
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Processing failed (${resp.status}): ${text}`);
  }

  return await resp.json();
}

async function getAccountInfo() {
  const resp = await fetch(ACCOUNT_ENDPOINT, {
    method: "GET",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Account info failed (${resp.status}): ${text}`);
  }

  return await resp.json();
}

// ─── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "kolektis", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── List tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "kolektis_process_pdf",
      description:
        "Send a PDF file to Kolektis for document processing (text extraction + data structuring). Returns extracted and structured data.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Absolute path to the PDF file to process",
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "kolektis_process_batch",
      description:
        "Send multiple PDF files to Kolektis for processing. Processes sequentially and returns all results.",
      inputSchema: {
        type: "object",
        properties: {
          file_paths: {
            type: "array",
            items: { type: "string" },
            description: "Array of absolute paths to PDF files",
          },
        },
        required: ["file_paths"],
      },
    },
    {
      name: "kolektis_list_results",
      description:
        "List all documents processed in this session with a summary.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "kolektis_get_result",
      description:
        "Get the full processing result (extracted + structured data) for a specific document.",
      inputSchema: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Name of the previously processed PDF file",
          },
        },
        required: ["filename"],
      },
    },
    {
      name: "kolektis_account_info",
      description:
        "Check the Kolektis account status: remaining credits, usage stats, and billing info.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

// ── Call tool ────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── Process single PDF ─────────────────────────────────────────────
      case "kolektis_process_pdf": {
        const result = await processPdf(args.file_path);
        const filename = path.basename(args.file_path);
        sessionResults.set(filename, {
          ...result,
          _processed_at: new Date().toISOString(),
          _source_path: args.file_path,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filename,
                  extracted: result.extracted || result.data?.extracted || null,
                  structured:
                    result.structured || result.data?.structured || null,
                  raw_keys: Object.keys(result),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── Process batch ──────────────────────────────────────────────────
      case "kolektis_process_batch": {
        const results = [];
        for (const filePath of args.file_paths) {
          const filename = path.basename(filePath);
          try {
            const result = await processPdf(filePath);
            sessionResults.set(filename, {
              ...result,
              _processed_at: new Date().toISOString(),
              _source_path: filePath,
            });
            results.push({
              filename,
              success: true,
              keys: Object.keys(result),
            });
          } catch (err) {
            results.push({ filename, success: false, error: err.message });
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  processed: results.length,
                  succeeded: results.filter((r) => r.success).length,
                  failed: results.filter((r) => !r.success).length,
                  details: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── List results ───────────────────────────────────────────────────
      case "kolektis_list_results": {
        const summaries = [];
        for (const [filename, result] of sessionResults) {
          summaries.push({
            filename,
            processed_at: result._processed_at,
            has_extracted: !!(result.extracted || result.data?.extracted),
            has_structured: !!(result.structured || result.data?.structured),
          });
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { total: summaries.length, documents: summaries },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── Get single result ──────────────────────────────────────────────
      case "kolektis_get_result": {
        const result = sessionResults.get(args.filename);
        if (!result) {
          // Try partial match
          const match = [...sessionResults.keys()].find((k) =>
            k.toLowerCase().includes(args.filename.toLowerCase())
          );
          if (match) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(sessionResults.get(match), null, 2),
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `No result found for "${args.filename}". Available: ${[...sessionResults.keys()].join(", ") || "none"}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      }

      // ── Account info ───────────────────────────────────────────────────
      case "kolektis_account_info": {
        const info = await getAccountInfo();
        return {
          content: [
            { type: "text", text: JSON.stringify(info, null, 2) },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kolektis MCP Server running (API key auth)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
