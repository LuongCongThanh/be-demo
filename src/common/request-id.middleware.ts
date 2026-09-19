import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';

// Chỉ nhận id upstream nếu đúng hình dạng an toàn (không xuống dòng/ký tự
// điều khiển, không quá dài) — id này sẽ được echo lại ở response header và
// nối trực tiếp vào mọi dòng log của request (AppLogger.stringifyMessage),
// nên không được tin tưởng vô điều kiện giá trị do client tự gửi lên.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_.-]{1,128}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Nếu upstream (load balancer, gateway...) đã gắn sẵn request id đúng
    // hình dạng an toàn thì giữ nguyên để trace xuyên suốt nhiều service —
    // ngược lại (thiếu, hoặc client tự gửi giá trị bất thường) tự sinh mới.
    const upstreamId = req.headers[REQUEST_ID_HEADER]?.toString();
    const requestId = upstreamId && SAFE_REQUEST_ID.test(upstreamId) ? upstreamId : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    RequestContext.run(requestId, next);
  }
}
