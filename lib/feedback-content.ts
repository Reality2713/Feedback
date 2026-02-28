const ATTACHMENTS_MARKER = '[ATTACHMENTS]';

export type ParsedFeedbackContent = {
  type: string;
  priority: string;
  body: string;
  attachments: string[];
  preview: string;
};

function parseHeader(line: string, prefix: string, fallback: string) {
  if (!line.startsWith(prefix)) return fallback;
  const value = line.slice(prefix.length).trim();
  return value || fallback;
}

export function buildFeedbackContent(
  type: string,
  priority: string,
  body: string,
  attachments: string[]
) {
  const lines = [`Type: ${type}`, `Priority: ${priority}`, '', body.trim()];

  if (attachments.length > 0) {
    lines.push('', ATTACHMENTS_MARKER, ...attachments);
  }

  return lines.join('\n');
}

export function parseFeedbackContent(raw: string): ParsedFeedbackContent {
  const lines = raw.split('\n');
  const type = parseHeader(lines[0] || '', 'Type:', 'FEATURE_REQUEST');
  const priority = parseHeader(lines[1] || '', 'Priority:', 'MEDIUM');

  const attachmentMarkerIndex = lines.findIndex((line) => line.trim() === ATTACHMENTS_MARKER);
  const bodyLines = lines.slice(3, attachmentMarkerIndex >= 0 ? attachmentMarkerIndex : undefined);
  const body = bodyLines.join('\n').trim();

  const attachments =
    attachmentMarkerIndex >= 0
      ? lines
          .slice(attachmentMarkerIndex + 1)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('http://') || line.startsWith('https://'))
      : [];

  const preview = body.split('\n').find((line) => line.trim().length > 0) || 'No details provided.';

  return { type, priority, body, attachments, preview };
}
