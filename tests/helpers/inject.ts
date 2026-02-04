import http from 'http';
import { PassThrough } from 'stream';
import type { Express } from 'express';

interface InjectOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface InjectResponse {
  status: number;
  headers: http.OutgoingHttpHeaders;
  text: string;
}

export async function inject(app: Express, options: InjectOptions): Promise<InjectResponse> {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage(new PassThrough());
    req.method = options.method.toUpperCase();
    req.url = options.url;
    req.headers = options.headers || {};

    const res = new http.ServerResponse(req);
    const socket = new PassThrough();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.assignSocket(socket as any);

    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = ((chunk: unknown) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return originalWrite(chunk as never);
    }) as typeof res.write;

    res.end = ((chunk?: unknown) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      originalEnd(chunk as never);
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        text: Buffer.concat(chunks).toString('utf-8'),
      });
    }) as typeof res.end;

    res.on('error', (err) => reject(err));

    app.handle(req, res);

    if (options.body) {
      req.push(options.body);
    }
    req.push(null);
  });
}
