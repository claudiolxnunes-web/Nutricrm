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

export async function enviarOrcamentoPorEmail(params: {
  to: string;
  from: string;
  fromName: string;
  quote: any;
  client: any;
  customMessage?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping quote email");
    return { skipped: true };
  }

  const { to, from, fromName, quote, client, customMessage } = params;
  const subject = `Orçamento ${quote.quoteNumber} — ${client.farmName || client.producerName}`;
  const domainFrom = process.env.RESEND_DOMAIN || "onboarding@resend.dev";

  const itensHtml = (quote.items || []).map((item: any) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${item.productName || item.product_name || "-"}</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;">${item.quantity} ${item.unit || "un"}</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;">R$ ${Number(item.unitPrice || item.unit_price || 0).toFixed(2)}</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;">R$ ${Number(item.totalPrice || item.total_price || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#333;">
      <div style="background:#2d7a3a;color:white;padding:24px 28px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:22px;">Orçamento ${quote.quoteNumber}</h2>
        <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">NutriCRM — Nutrição Animal</p>
      </div>

      <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p>Prezado(a) <strong>${client.producerName || client.farmName}</strong>,</p>

        ${customMessage ? `
        <div style="background:#f0fdf4;border-left:4px solid #2d7a3a;padding:14px 18px;border-radius:4px;margin:16px 0;">
          <p style="margin:0;font-style:italic;color:#166534;">"${customMessage}"</p>
          <p style="margin:8px 0 0;font-size:13px;color:#15803d;">— ${fromName}</p>
        </div>` : ""}

        <p>Segue o orçamento solicitado para <strong>${client.farmName || client.producerName}</strong>.</p>

        <h3 style="color:#2d7a3a;margin-top:24px;">Itens do Orçamento</h3>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;border-bottom:2px solid #ddd;">Produto</th>
              <th style="padding:10px;text-align:center;border-bottom:2px solid #ddd;">Qtd</th>
              <th style="padding:10px;text-align:right;border-bottom:2px solid #ddd;">Unit.</th>
              <th style="padding:10px;text-align:right;border-bottom:2px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>${itensHtml}</tbody>
        </table>

        ${Number(quote.discount) > 0 ? `
        <p style="text-align:right;color:#666;font-size:14px;">
          Subtotal: R$ ${(Number(quote.totalValue) + Number(quote.discount)).toFixed(2)}<br/>
          Desconto: -R$ ${Number(quote.discount).toFixed(2)}
        </p>` : ""}

        <div style="text-align:right;margin-top:16px;padding:16px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
          <p style="font-size:13px;color:#166534;margin:0;">VALOR TOTAL</p>
          <p style="font-size:30px;font-weight:bold;color:#2d7a3a;margin:4px 0 0;">R$ ${Number(quote.totalValue).toFixed(2)}</p>
        </div>

        <p style="margin-top:20px;font-size:14px;color:#555;">
          <strong>Validade:</strong> ${quote.validityDays || 30} dias a partir de ${new Date().toLocaleDateString("pt-BR")}
        </p>

        ${quote.notes ? `
        <div style="margin-top:16px;padding:12px 16px;background:#fef9c3;border-radius:6px;font-size:14px;">
          <strong>Observações:</strong> ${quote.notes}
        </div>` : ""}

        <hr style="margin:32px 0 20px;border:none;border-top:1px solid #e5e7eb;"/>

        <div style="font-size:13px;color:#666;">
          <p style="margin:0 0 4px;font-weight:600;color:#333;">${fromName}</p>
          <p style="margin:0;">📧 Responda diretamente para este email</p>
          <p style="margin:8px 0 0;font-size:12px;color:#999;">Enviado via NutriCRM</p>
        </div>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${domainFrom}>`,
    reply_to: [from],
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("[Email] Failed to send quote email:", error);
    throw new Error("Falha ao enviar email do orçamento: " + error.message);
  }

  return { sent: true, id: data?.id };
}

export async function enviarOrcamentoSimplesPorEmail(params: {
  to: string;
  fromName: string;
  orcamento: any;
  customMessage?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping orcamento email");
    return { skipped: true };
  }

  const { to, fromName, orcamento, customMessage } = params;
  const subject = `Orçamento NutriCRM — ${orcamento.clienteNome}`;
  const domainFrom = process.env.RESEND_DOMAIN || "onboarding@resend.dev";

  const produtosHtml = (orcamento.produtos || []).map((prod: any) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${prod.nome || "-"}</td>
      <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;">${prod.quantidade} ${prod.unidade || "KG"}</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;">R$ ${Number(prod.preco || 0).toFixed(2)}</td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;">R$ ${Number(prod.total || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#333;">
      <div style="background:#2563eb;color:white;padding:24px 28px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:22px;">Orçamento NutriCRM</h2>
        <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">Sistema de Gestão Comercial</p>
      </div>

      <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p>Prezado(a) <strong>${orcamento.clienteNome}</strong>,</p>

        ${customMessage ? `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;border-radius:4px;margin:16px 0;">
          <p style="margin:0;font-style:italic;color:#1e40af;">"${customMessage}"</p>
          <p style="margin:8px 0 0;font-size:13px;color:#3b82f6;">— ${fromName}</p>
        </div>` : ""}

        <p>Segue o orçamento solicitado.</p>

        <h3 style="color:#2563eb;margin-top:24px;">Itens do Orçamento</h3>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;border-bottom:2px solid #ddd;">Produto</th>
              <th style="padding:10px;text-align:center;border-bottom:2px solid #ddd;">Qtd</th>
              <th style="padding:10px;text-align:right;border-bottom:2px solid #ddd;">Unit.</th>
              <th style="padding:10px;text-align:right;border-bottom:2px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${produtosHtml}
          </tbody>
        </table>

        <div style="background:#f9fafb;padding:18px 20px;border-radius:6px;margin-top:20px;">
          <p style="margin:0;font-size:14px;color:#6b7280;">Valor Total</p>
          <p style="margin:6px 0 0;font-size:26px;font-weight:bold;color:#111;">R$ ${Number(orcamento.total || 0).toFixed(2)}</p>
        </div>

        <p style="margin-top:24px;font-size:13px;color:#9ca3af;">Este orçamento é válido por 15 dias.</p>
      </div>

      <div style="padding:20px 28px;text-align:center;font-size:12px;color:#9ca3af;">
        <p>Enviado por ${fromName} via NutriCRM</p>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: `NutriCRM <${domainFrom}>`,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("[Email] Failed to send orcamento:", error);
    throw new Error("Falha ao enviar orçamento por email");
  }

  return { sent: true, id: data?.id };
}
