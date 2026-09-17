import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Nếu upstream (load balancer, gateway...) đã gắn sẵn request id thì giữ
    // nguyên để trace xuyên suốt nhiều service — chỉ tự sinh khi chưa có.
    const requestId = req.headers[REQUEST_ID_HEADER]?.toString() || randomUUID();
    res.setHeader('X-Request-Id', requestId);
    RequestContext.run(requestId, next);
  }
}
