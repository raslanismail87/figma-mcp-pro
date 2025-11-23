import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { FigmaClient } from "./figma.js";
import * as dotenv from "dotenv";
import express from "express";
import cors from "cors";

dotenv.config();


const sessions = new Map<string, SSEServerTransport>();

function createServer(token: string) {
    const figma = new FigmaClient(token);
    const server = new Server(
        {
            name: "figma-mcp-server",
            version: "0.1.0",
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "get_file",
                    description: "Retrieve the entire Figma file JSON. Use with caution for large files.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file_key: { type: "string", description: "The key of the Figma file" },
                            depth: { type: "number", description: "Traverse depth (optional)" },
                        },
                        required: ["file_key"],
                    },
                },
                {
                    name: "get_node",
                    description: "Retrieve a specific node from a Figma file.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file_key: { type: "string", description: "The key of the Figma file" },
                            node_id: { type: "string", description: "The ID of the node to retrieve" },
                            depth: { type: "number", description: "Traverse depth (optional)" },
                        },
                        required: ["file_key", "node_id"],
                    },
                },
                {
                    name: "get_image",
                    description: "Render a node as an image.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file_key: { type: "string", description: "The key of the Figma file" },
                            node_id: { type: "string", description: "The ID of the node to render" },
                            format: { type: "string", enum: ["png", "jpg", "svg", "pdf"], description: "Image format" },
                            scale: { type: "number", description: "Image scale" },
                        },
                        required: ["file_key", "node_id"],
                    },
                },
                {
                    name: "get_image_fills",
                    description: "Get image URLs for image fills in a file.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file_key: { type: "string", description: "The key of the Figma file" },
                        },
                        required: ["file_key"],
                    },
                },
                {
                    name: "get_comments",
                    description: "Retrieve comments from a Figma file.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file_key: { type: "string", description: "The key of the Figma file" },
                        },
                        required: ["file_key"],
                    },
                },
            ],
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            const { name, arguments: args } = request.params;

            if (name === "get_file") {
                const schema = z.object({
                    file_key: z.string(),
                    depth: z.number().optional(),
                });
                const { file_key, depth } = schema.parse(args);
                const data = await figma.getFile(file_key, depth);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }

            if (name === "get_node") {
                const schema = z.object({
                    file_key: z.string(),
                    node_id: z.string(),
                    depth: z.number().optional(),
                });
                const { file_key, node_id, depth } = schema.parse(args);
                const data = await figma.getFileNodes(file_key, [node_id], depth);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }

            if (name === "get_image") {
                const schema = z.object({
                    file_key: z.string(),
                    node_id: z.string(),
                    format: z.enum(["png", "jpg", "svg", "pdf"]).optional(),
                    scale: z.number().optional(),
                });
                const { file_key, node_id, format, scale } = schema.parse(args);
                const data = await figma.getImage(file_key, [node_id], format, scale);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }

            if (name === "get_image_fills") {
                const schema = z.object({
                    file_key: z.string(),
                });
                const { file_key } = schema.parse(args);
                const data = await figma.getImageFills(file_key);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }

            if (name === "get_comments") {
                const schema = z.object({
                    file_key: z.string(),
                });
                const { file_key } = schema.parse(args);
                const data = await figma.getComments(file_key);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }

            throw new Error(`Unknown tool: ${name}`);
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    });

    return server;
}

const app = express();
app.use(cors());

app.get("/sse", async (req, res) => {
    const token = req.query.token as string;
    if (!token) {
        res.status(400).send("Missing token query parameter");
        return;
    }

    console.log("Received connection with token");

    const transport = new SSEServerTransport("/messages", res);
    const server = createServer(token);

    await server.connect(transport);

    // Store session
    if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
    }

    req.on("close", () => {
        if (transport.sessionId) {
            sessions.delete(transport.sessionId);
        }
    });
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
        res.status(400).send("Missing sessionId");
        return;
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
        res.status(404).send("Session not found");
        return;
    }

    await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
