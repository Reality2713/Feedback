const ATTACHMENTS_MARKER = '[ATTACHMENTS]';

export type ParsedFeedbackContent = {
  type: string;
  priority: string;
  source: string;
  reference: string;
  body: string;
  attachments: string[];
  preview: string;
};

type HeaderMap = {
  type: string;
  priority: string;
  source: string;
  reference: string;
};

const DEFAULT_HEADERS: HeaderMap = {
  type: 'FEATURE_REQUEST',
  priority: 'MEDIUM',
  source: 'web',
  reference: '',
};

function parseHeaderLines(lines: string[]) {
  const headers: HeaderMap = { ...DEFAULT_HEADERS };
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] || '';
    const line = raw.trim();
    if (line.length === 0) {
      bodyStartIndex = i + 1;
      break;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      bodyStartIndex = i;
      break;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key === 'type') headers.type = value || DEFAULT_HEADERS.type;
    if (key === 'priority') headers.priority = value || DEFAULT_HEADERS.priority;
    if (key === 'source') headers.source = value || DEFAULT_HEADERS.source;
    if (key === 'reference') headers.reference = value || '';
    bodyStartIndex = i + 1;
  }

  return { headers, bodyStartIndex };
}

export function buildFeedbackContent(
  type: string,
  priority: string,
  source: string,
  reference: string,
  body: string,
  attachments: string[]
) {
  const lines = [
    `Type: ${type}`,
    `Priority: ${priority}`,
    `Source: ${source || DEFAULT_HEADERS.source}`,
    `Reference: ${reference || ''}`,
    '',
    body.trim(),
  ];

  if (attachments.length > 0) {
    lines.push('', ATTACHMENTS_MARKER, ...attachments);
  }

  return lines.join('\n');
}

export function parseFeedbackContent(raw: string): ParsedFeedbackContent {
  const lines = raw.split('\n');
  const { headers, bodyStartIndex } = parseHeaderLines(lines);

  const attachmentMarkerIndex = lines.findIndex((line) => line.trim() === ATTACHMENTS_MARKER);
  const bodyLines = lines.slice(bodyStartIndex, attachmentMarkerIndex >= 0 ? attachmentMarkerIndex : undefined);
  const body = bodyLines.join('\n').trim();

  const attachments =
    attachmentMarkerIndex >= 0
      ? lines
          .slice(attachmentMarkerIndex + 1)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('http://') || line.startsWith('https://'))
      : [];

  const preview = body.split('\n').find((line) => line.trim().length > 0) || 'No details provided.';

  return {
    type: headers.type,
    priority: headers.priority,
    source: headers.source,
    reference: headers.reference,
    body,
    attachments,
    preview,
  };
}
