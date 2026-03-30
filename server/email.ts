import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendInviteEmail(opts: {
  toEmail: string;
  toName: string;
  senderName: string;
  password: string;
  appUrl: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping invite email");
    return { skipped: true };
  }

  const { toEmail, toName, senderName, password, appUrl } = opts;

  const { data, error } = await resend.emails.send({
    from: "NutriCRM <onboarding@resend.dev>",
    to: [toEmail],
    subject: "Seu acesso ao NutriCRM foi criado",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
        <h2 style="color:#1e293b;margin-bottom:8px;">Bem-vindo ao NutriCRM, ${toName}!</h2>
        <p style="color:#475569;margin-bottom:24px;">${senderName} criou uma conta para voce no sistema de CRM.</p>

        <div style="background:#fff;border-radius:8px;padding:20px 24px;border:1px solid #e2e8f0;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Seus dados de acesso</p>
          <p style="margin:4px 0;color:#1e293b;"><strong>Link:</strong> <a href="${appUrl}" style="color:#2563eb;">${appUrl}</a></p>
          <p style="margin:4px 0;color:#1e293b;"><strong>Email:</strong> ${toEmail}</p>
          <p style="margin:4px 0;color:#1e293b;"><strong>Senha:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${password}</code></p>
        </div>

        <p style="color:#94a3b8;font-size:12px;">Recomendamos alterar sua senha apos o primeiro acesso.</p>
      </div>
    `,
  });

  if (error) {
    console.error("[Email] Failed to send invite:", error);
    throw new Error("Falha ao enviar email de convite");
  }

  return { sent: true, id: data?.id };
}
