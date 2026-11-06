import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createInterface, Interface } from 'node:readline';
import { Writable } from 'node:stream';

/**
 * Hỏi mật khẩu mà không echo ký tự ra màn hình — mật khẩu không bao giờ đi
 * qua argv (shell history, `ps`). Dùng một readline duy nhất cho mọi câu hỏi:
 * khi stdin là pipe, readline đầu tiên sẽ đọc hết buffer, nên tạo readline mới
 * cho câu sau sẽ treo rồi thoát im lặng. Tách thành provider để test stub.
 */
@Injectable()
export class PasswordPrompt implements OnModuleDestroy {
  private rl?: Interface;
  private muted = false;
  private readonly lines: string[] = [];
  private readonly waiting: { resolve: (line: string) => void; reject: (err: Error) => void }[] = [];
  private closed = false;

  async ask(question: string): Promise<string> {
    const rl = this.ensureInterface();
    this.muted = false;
    rl.setPrompt(question);
    rl.prompt();
    this.muted = true;
    try {
      return await this.nextLine();
    } finally {
      this.muted = false;
      process.stdout.write('\n');
    }
  }

  onModuleDestroy(): void {
    this.rl?.close();
  }

  private nextLine(): Promise<string> {
    const line = this.lines.shift();
    if (line !== undefined) return Promise.resolve(line);
    if (this.closed) return Promise.reject(new Error('stdin closed before a password was entered'));
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  private ensureInterface(): Interface {
    if (this.rl) return this.rl;
    const output = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        if (!this.muted) process.stdout.write(chunk);
        callback();
      },
    });
    this.rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY ?? false });
    this.rl.on('line', (line) => {
      const waiter = this.waiting.shift();
      if (waiter) waiter.resolve(line);
      else this.lines.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      for (const waiter of this.waiting.splice(0))
        waiter.reject(new Error('stdin closed before a password was entered'));
    });
    return this.rl;
  }
}
