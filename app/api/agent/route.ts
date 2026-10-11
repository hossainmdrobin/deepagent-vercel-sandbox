
import { createDeepAgent } from "deepagents";
import { tool } from "langchain";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

// export const runtime = "nodejs";
export const maxDuration = 60;

const executeInSandbox = tool(
  async ({ command }) => {
    let sandbox: Sandbox | undefined;

    try {
      sandbox = await Sandbox.create({
        timeout: 2 * 60 * 1000,
      });

      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-lc", command],
      });

      const stdout = await result.stdout();
      const stderr = await result.stderr();

      return JSON.stringify({
        exitCode: result.exitCode,
        stdout: stdout.slice(0, 12000),
        stderr: stderr.slice(0, 4000),
      });
    } finally {
      if (sandbox) {
        await sandbox.stop().catch(console.error);
      }
    }
  },
  {
    name: "execute_in_sandbox",
    description:
      "Run a shell command in an isolated, temporary Vercel Sandbox. Use this to execute code and inspect command output. Files do not persist between calls.",
    schema: z.object({
      command: z.string().min(1).max(2000),
    }),
  },
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      typeof body.message !== "string" ||
      body.message.trim().length === 0 ||
      body.message.length > 4000
    ) {
      return Response.json(
        { error: "Provide a message of 1–4000 characters." },
        { status: 400 },
      );
    }
    const model = new ChatOpenAI({
    model: "gc/grok-4.7",
    temperature: 0,
    apiKey: process.env.OMNIROUTE_API_KEY,
    maxTokens: 1024,
    configuration: {
        baseURL: process.env.OMNIROUTE_BASE_URL?.trim(),
    },
});

    const agent = await createDeepAgent({
      model,
      tools: [executeInSandbox],
      systemPrompt:
        "You are a coding assistant. Use execute_in_sandbox to run commands when needed. Each call creates a fresh sandbox, so do not assume files persist between calls.",
    });

    const result = await agent.invoke({
      messages: [
        { role: "user", content: body.message.trim() },
      ],
    });

    const lastMessage = result.messages[result.messages.length - 1];

    return Response.json({
      success: true,
      response: lastMessage.content,
    });
  } catch (error) {
    console.error("Agent request failed:", error);

    return Response.json(
      { error: "The agent request failed." },
      { status: 500 },
    );
  }
}
