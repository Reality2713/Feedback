export type FeedbackRow = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  status: string | null;
  upvotes: number;
};

export type FeedbackSort = 'new' | 'popular' | 'trending';

export function parseSort(value: string | null): FeedbackSort {
  if (value === 'popular') return 'popular';
  if (value === 'trending') return 'trending';
  return 'new';
}

export function sortFeedback(rows: FeedbackRow[], sort: FeedbackSort): FeedbackRow[] {
  const copy = [...rows];

  if (sort === 'popular') {
    return copy.sort((a, b) => b.upvotes - a.upvotes);
  }

  if (sort === 'trending') {
    return copy.sort((a, b) => trendingScore(b) - trendingScore(a));
  }

  return copy.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function trendingScore(row: FeedbackRow) {
  const ageHours = Math.max((Date.now() - Date.parse(row.created_at)) / 36e5, 1);
  return row.upvotes / Math.pow(ageHours + 2, 1.3);
}

