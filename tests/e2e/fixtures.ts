// TRD §12.4: Local HTTP server for serving the 30-site fixture corpus
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

export interface FixtureServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export async function startFixtureServer(requestedPort = 3000): Promise<FixtureServer> {
  const root = path.resolve(process.cwd(), 'tests/fixtures/sites');

  const server = http.createServer((req, res) => {
    const rawUrl = req.url ?? '/';
    const cleanUrl = rawUrl.split('?')[0]?.split('#')[0] ?? '/';
    let filePath = path.join(root, cleanUrl);

    // If directory requested, serve index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Error');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port if requested port is in use
        resolve(startFixtureServer(requestedPort + 1));
      } else {
        reject(err);
      }
    });

    server.listen(requestedPort, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : requestedPort;
      const url = `http://127.0.0.1:${actualPort}`;

      resolve({
        url,
        port: actualPort,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}
