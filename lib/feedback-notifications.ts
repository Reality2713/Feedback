type NotifyStatusParams = {
  toEmail: string;
  feedbackId: string;
  feedbackTitle: string;
  previousStatus: string | null;
  nextStatus: string;
  actorEmail?: string | null;
};

type NotifyCommentParams = {
  toEmail: string;
  feedbackId: string;
  feedbackTitle: string;
  commentBody: string;
  actorEmail?: string | null;
};

function statusLabel(status: string | null | undefined) {
  if (!status || status === 'open') return 'NEW';
  if (status === 'planned') return 'PLANNED';
  if (status === 'in_progress') return 'IN_PROGRESS';
  if (status === 'shipped') return 'SHIPPED';
  return status.toUpperCase();
}

function appBaseUrl() {
  const configured = (process.env.APP_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

function trimComment(comment: string) {
  const clean = comment.replace(/\s+/g, ' ').trim();
  return clean.length > 280 ? `${clean.slice(0, 280)}...` : clean;
}

async function sendEmail(params: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
  } catch {
    // Notification delivery is best-effort.
  }
}

export async function notifyFeedbackStatusChanged(params: NotifyStatusParams) {
  const link = `${appBaseUrl()}/report/${params.feedbackId}`;
  const actor = params.actorEmail || 'Preflight team';
  const previous = statusLabel(params.previousStatus);
  const next = statusLabel(params.nextStatus);

  await sendEmail({
    to: params.toEmail,
    subject: `[Preflight] "${params.feedbackTitle}" moved to ${next}`,
    html: `
      <p>Hi,</p>
      <p>Your feedback status was updated.</p>
      <p><strong>${params.feedbackTitle}</strong></p>
      <p>Status: <strong>${previous}</strong> → <strong>${next}</strong></p>
      <p>Updated by: ${actor}</p>
      <p><a href="${link}">Open report</a></p>
    `,
  });
}

export async function notifyFeedbackCommentAdded(params: NotifyCommentParams) {
  const link = `${appBaseUrl()}/report/${params.feedbackId}`;
  const actor = params.actorEmail || 'Preflight team';

  await sendEmail({
    to: params.toEmail,
    subject: `[Preflight] New comment on "${params.feedbackTitle}"`,
    html: `
      <p>Hi,</p>
      <p>A new comment was added to your feedback.</p>
      <p><strong>${params.feedbackTitle}</strong></p>
      <p>From: ${actor}</p>
      <blockquote>${trimComment(params.commentBody)}</blockquote>
      <p><a href="${link}">Open report</a></p>
    `,
  });
}

export function normalizeProfileEmail(raw: string | null | undefined) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  return value.replace(/\+widget(?=@)/, '');
}
