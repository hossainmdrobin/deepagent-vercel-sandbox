
import { Sandbox } from "@vercel/sandbox";

export async function POST(request: Request) {
  const secret = process.env.AGENT_API_SECRET;

  if (!secret) {
    return Response.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let sandbox: Sandbox | undefined;

  try {
    sandbox = await Sandbox.create({
      ports: [3001],
      timeout: 10 * 60 * 1000,
    });

    const serverCode = `
const http = require("node:http");

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
  });

  res.end(\`
    <!doctype html>
    <html>
      <head>
        <title>Hello World</title>
      </head>
      <body>
        <h1>Hello world!</h1>
        <p>Running on Vercel Sandbox port 3001.</p>
      </body>
    </html>
  \`);
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Server listening on port 3001");
});
`;

    await sandbox.writeFiles([
      {
        path: "server.js",
        content: serverCode,
      },
    ]);

    const result = await sandbox.runCommand({
      cmd: "node",
      args: ["server.js"],
      detached: true,
    });

    if (result.exitCode !== 0) {
      throw new Error("Could not start the demo server");
    }

    return Response.json({
      success: true,
      message: "Hello World server started",
      port: 3001,
      url: sandbox.domain(3001),
    });
  } catch (error) {
    if (sandbox) {
      await sandbox.stop().catch(() => {});
    }

    console.error("Failed to start demo:", error);

    return Response.json(
      { error: "Failed to start the demo server" },
      { status: 500 },
    );
  }
}
