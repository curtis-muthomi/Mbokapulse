export type Platform = 'Instagram' | 'TikTok' | 'Facebook' | 'YouTube' | 'X' | 'LinkedIn' | 'Other'
export type Provenance = 'manual' | 'imported' | 'public'
export type Sentiment = 'positive' | 'negative' | 'neutral'
export type Theme = 'question' | 'complaint' | 'praise' | 'worker concern' | 'employer need' | 'feature request'

export interface Post {
  id: string
  url: string
  platform: Platform
  caption: string
  author: string
  publishedAt: string
  contentType: string
  topic: string
  campaign: string
  views: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  clicks: number | null
  collectedAt: string
  notes: string
  provenance: Partial<Record<keyof Post, Provenance>>
  isDemo?: boolean
}

export interface ResearchComment {
  id: string
  postId: string
  text: string
  sentiment: Sentiment
  themes: Theme[]
  corrected: boolean
  createdAt: string
  provenance: Provenance
  isDemo?: boolean
}

export interface AdCampaign {
  id: string
  name: string
  platform: Platform
  startDate: string
  endDate: string
  impressions: number | null
  reach: number | null
  clicks: number | null
  spend: number | null
  conversions: number | null
  engagement: number | null
  provenance: Provenance
  isDemo?: boolean
}

export interface AppData {
  posts: Post[]
  comments: ResearchComment[]
  ads: AdCampaign[]
}

export const EMPTY_DATA: AppData = { posts: [], comments: [], ads: [] }
export const STORAGE_KEY = 'mbokapulse-research-v1'

export const SENTIMENT_WORDS: Record<Sentiment, string[]> = {
  positive: ['love', 'great', 'good', 'amazing', 'helpful', 'thank', 'congrats', 'congratulations', 'nice', 'excellent', 'proud', 'well done', 'bravo', '❤️', '😊'],
  negative: ['bad', 'poor', 'terrible', 'hate', 'disappointed', 'problem', 'issue', 'scam', 'late', 'unfair', 'difficult', 'failed', 'broken', 'expensive', '😡'],
  neutral: [],
}

const THEME_WORDS: Record<Theme, string[]> = {
  question: ['?', 'how', 'what', 'when', 'where', 'which', 'can i', 'do you', 'is there'],
  complaint: ['problem', 'issue', 'bad', 'late', 'difficult', 'not working', 'failed', 'expensive', 'disappointed'],
  praise: ['love', 'great', 'good', 'amazing', 'helpful', 'thank', 'excellent', 'proud', 'bravo'],
  'worker concern': ['worker', 'salary', 'wage', 'pay', 'employment', 'worker rights', 'working conditions'],
  'employer need': ['employer', 'hire', 'hiring', 'recruit', 'staff', 'candidate', 'talent', 'business'],
  'feature request': ['please add', 'would like', 'should add', 'feature', 'suggestion', 'wish you', 'it would be nice'],
}

export function analyzeComment(text: string): { sentiment: Sentiment; themes: Theme[] } {
  const normalized = text.toLocaleLowerCase()
  const score = (words: string[]) => words.reduce((total, word) => total + (normalized.includes(word) ? 1 : 0), 0)
  const positive = score(SENTIMENT_WORDS.positive)
  const negative = score(SENTIMENT_WORDS.negative)
  const sentiment: Sentiment = positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'
  const themes = (Object.entries(THEME_WORDS) as [Theme, string[]][])
    .filter(([, words]) => score(words) > 0)
    .map(([theme]) => theme)
  return { sentiment, themes }
}

export function engagementRate(post: Post): number | null {
  if (post.reach !== null && post.reach > 0 && post.likes !== null && post.shares !== null && post.comments !== null) {
    return ((post.likes + post.comments + post.shares) / post.reach) * 100
  }
  if (post.reach === null && post.views !== null && post.views > 0 && post.likes !== null && post.shares !== null && post.comments !== null) {
    return ((post.likes + post.comments + post.shares) / post.views) * 100
  }
  return null
}

export function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)))
  return date.getUTCFullYear() === Number(yearText) &&
    date.getUTCMonth() === Number(monthText) - 1 &&
    date.getUTCDate() === Number(dayText)
}

export function validUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : new Intl.NumberFormat().format(value)
}

export function localDate(): string {
  const date = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function uniqueId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function loadData(): AppData {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return EMPTY_DATA
  const parsed: unknown = JSON.parse(saved)
  if (!parsed || typeof parsed !== 'object') throw new Error('Saved research data is malformed.')
  const value = parsed as Partial<AppData>
  if (!Array.isArray(value.posts) || !Array.isArray(value.comments) || !Array.isArray(value.ads)) {
    throw new Error('Saved research data has an unexpected format.')
  }
  return { posts: value.posts, comments: value.comments, ads: value.ads }
}

export function campaignMetrics(ad: AdCampaign) {
  return {
    ctr: ad.impressions !== null && ad.impressions > 0 && ad.clicks !== null ? (ad.clicks / ad.impressions) * 100 : null,
    cpc: ad.clicks !== null && ad.clicks > 0 && ad.spend !== null ? ad.spend / ad.clicks : null,
    conversionRate: ad.clicks !== null && ad.clicks > 0 && ad.conversions !== null ? (ad.conversions / ad.clicks) * 100 : null,
  }
}
