/** Port gửi email giao dịch; chỉ khai báo các email mà module đang gửi. */
export abstract class MailSender {
  abstract sendVerificationEmail(to: string, code: string): Promise<void>;
  abstract sendPasswordResetEmail(to: string, rawToken: string): Promise<void>;
}
