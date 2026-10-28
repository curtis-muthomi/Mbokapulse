import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownToLine, BarChart3, BriefcaseBusiness, Check, ChevronDown, CircleHelp, FileText,
  Filter, Heart, LayoutDashboard, MessageCircle, MousePointer2, Plus, Search,
  Share2, Sparkles, Trash2, Upload, Eye, X, ExternalLink, Pencil, Download,
} from 'lucide-react'
import Papa from 'papaparse'
import {
  analyzeComment, campaignMetrics, EMPTY_DATA, engagementRate, formatNumber, loadData, localDate, STORAGE_KEY,
  uniqueId, validDate, validUrl,
  type AdCampaign, type AppData, type Platform, type Post, type Provenance, type ResearchComment, type Sentiment, type Theme,
} from './data'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import './App.css'
import './editorial.css'

type Page = 'Overview' | 'Post Analyzer' | 'Comment Intelligence' | 'Trends' | 'Ads Research' | 'Reports'
const NAV: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Post Analyzer', icon: Activity },
  { label: 'Comment Intelligence', icon: MessageCircle },
  { label: 'Trends', icon: BarChart3 },
  { label: 'Ads Research', icon: BriefcaseBusiness },
  { label: 'Reports', icon: FileText },
]
const PLATFORMS: Platform[] = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'X', 'LinkedIn', 'Other']
const CONTENT_TYPES = ['Video', 'Image', 'Carousel', 'Text', 'Story', 'Live', 'Other']
const numberFields = ['views', 'reach', 'likes', 'comments', 'shares', 'clicks'] as const
type PostNumberField = typeof numberFields[number]
const chartColors = ['#d95035', '#7c8c78', '#b28a53', '#758697', '#a76552', '#88857b']
const plural = (count: number, singular: string, multiple = `${singular}s`) => `${count} ${count === 1 ? singular : multiple}`
const engagementLabel = (post: Post) => {
  const rate = engagementRate(post)
  return rate === null ? '—' : `${rate.toFixed(2)}% (${post.reach === null ? 'views' : 'reach'})`
}

const emptyPost = (): Omit<Post, 'id'> => ({
  url: '', platform: 'Instagram', caption: '', author: '', publishedAt: '', contentType: 'Video',
  topic: '', campaign: '', views: null, reach: null, likes: null, comments: null, shares: null,
  clicks: null, collectedAt: localDate(), notes: '', provenance: {},
})
const emptyAd = (): Omit<AdCampaign, 'id'> => ({
  name: '', platform: 'Instagram', startDate: '', endDate: '', impressions: null, reach: null,
  clicks: null, spend: null, conversions: null, engagement: null, provenance: 'manual',
})
const numeric = (value: string): number | null => value.trim() === '' ? null : Number(value)
const safeMetric = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
const themeLabels: Theme[] = ['question', 'complaint', 'praise', 'worker concern', 'employer need', 'feature request']

function App() {
  const [initialState] = useState(() => {
    try { return { data: loadData(), error: '' } }
    catch (error) { return { data: EMPTY_DATA, error: error instanceof Error ? error.message : 'Saved research data could not be read.' } }
  })
  const [data, setData] = useState<AppData>(initialState.data)
  const [storageError, setStorageError] = useState(initialState.error)
  const [storageReady, setStorageReady] = useState(!initialState.error)
  const [page, setPage] = useState<Page>('Overview')
  const [postDraft, setPostDraft] = useState<Omit<Post, 'id'>>(emptyPost)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentPostId, setCommentPostId] = useState('')
  const [adDraft, setAdDraft] = useState<Omit<AdCampaign, 'id'>>(emptyAd)
  const [postError, setPostError] = useState('')
  const [commentError, setCommentError] = useState('')
  const [adError, setAdError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [trendPlatform, setTrendPlatform] = useState('all')
  const [trendTopic, setTrendTopic] = useState('all')
  const [trendType, setTrendType] = useState('all')
  const [trendCampaign, setTrendCampaign] = useState('all')
  const [trendFrom, setTrendFrom] = useState('')
  const [trendTo, setTrendTo] = useState('')
  const [trendMetric, setTrendMetric] = useState<'engagement' | 'views' | 'reach' | 'likes' | 'comments' | 'shares'>('engagement')
  const [reportReady, setReportReady] = useState(false)
  const commentsInput = useRef<HTMLInputElement>(null)
  const adsInput = useRef<HTMLInputElement>(null)

  const updateData = (updater: (current: AppData) => AppData) => {
    setStorageError('')
    setStorageReady(true)
    setData((current) => updater(current))
  }
  useEffect(() => {
    if (!storageReady) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      window.dispatchEvent(new Event('mbokapulse-storage-error'))
    }
  }, [data, storageReady])
  useEffect(() => {
    const showError = () => setStorageError('Could not save to this browser. Check available local storage and export your research as a backup.')
    window.addEventListener('mbokapulse-storage-error', showError)
    return () => window.removeEventListener('mbokapulse-storage-error', showError)
  }, [])

  const filteredPosts = useMemo(() => data.posts.filter((post) =>
    (trendPlatform === 'all' || post.platform === trendPlatform) &&
    (trendTopic === 'all' || post.topic === trendTopic) &&
    (trendType === 'all' || post.contentType === trendType) &&
    (trendCampaign === 'all' || post.campaign === trendCampaign) &&
    (!trendFrom || post.publishedAt >= trendFrom) &&
    (!trendTo || post.publishedAt <= trendTo),
  ), [data.posts, trendPlatform, trendTopic, trendType, trendCampaign, trendFrom, trendTo])
  const sentimentCounts = useMemo(() => (['positive', 'neutral', 'negative'] as Sentiment[]).map((sentiment) => ({
    name: sentiment, value: data.comments.filter((comment) => comment.sentiment === sentiment).length,
  })), [data.comments])
  const trendPostIds = new Set(filteredPosts.map((post) => post.id))
  const trendComments = data.comments.filter((comment) =>
    (!comment.postId || trendPostIds.has(comment.postId)) &&
    (!trendFrom || comment.createdAt >= trendFrom) &&
    (!trendTo || comment.createdAt <= trendTo),
  )
  const trendThemes = themeLabels.map((theme) => ({
    name: theme, count: trendComments.filter((comment) => comment.themes.includes(theme)).length,
  })).sort((a, b) => b.count - a.count)
  const themes = useMemo(() => themeLabels.map((theme) => ({
    name: theme, count: data.comments.filter((comment) => comment.themes.includes(theme)).length,
    comments: data.comments.filter((comment) => comment.themes.includes(theme)).slice(0, 2),
  })).sort((a, b) => b.count - a.count), [data.comments])
  const activePost = selectedPost ? data.posts.find((post) => post.id === selectedPost) : null
  const postsByScore = [...data.posts].sort((a, b) => (engagementRate(b) ?? -1) - (engagementRate(a) ?? -1))
  const activity = [
    ...data.posts.map((post) => ({ id: post.id, kind: 'Post analyzed', detail: post.caption || post.url, date: post.collectedAt, demo: post.isDemo })),
    ...data.comments.map((comment) => ({ id: comment.id, kind: 'Comment analyzed', detail: comment.text, date: comment.createdAt, demo: comment.isDemo })),
    ...data.ads.map((ad) => ({ id: ad.id, kind: 'Campaign recorded', detail: ad.name, date: ad.endDate || ad.startDate, demo: ad.isDemo })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPostError('')
    if (!validUrl(postDraft.url)) { setPostError('Enter a valid http:// or https:// post URL.'); return }
    if (!validDate(postDraft.collectedAt)) { setPostError('Enter a valid metric collection date.'); return }
    if (postDraft.publishedAt && !validDate(postDraft.publishedAt)) { setPostError('Enter a valid publication date or leave it blank.'); return }
    const invalidNumber = numberFields.find((key) => postDraft[key] !== null && (!Number.isFinite(postDraft[key]) || postDraft[key]! < 0))
    if (invalidNumber) { setPostError(`${invalidNumber} must be a non-negative number or left blank.`); return }
    const post: Post = {
      ...postDraft,
      id: editingPost ?? uniqueId(),
      provenance: Object.fromEntries(
        ['url', 'platform', 'caption', 'author', 'publishedAt', 'contentType', 'topic', 'campaign', ...numberFields, 'collectedAt', 'notes']
          .map((key) => [key, postDraft.provenance[key as keyof Post] ?? 'manual']),
      ),
    }
    updateData((current) => ({
      ...current, posts: editingPost
        ? current.posts.map((item) => item.id === editingPost ? { ...post, isDemo: item.isDemo } : item)
        : [post, ...current.posts],
    }))
    setEditingPost(null)
    setPostDraft(emptyPost())
    setNotice(editingPost ? 'Post research updated.' : 'Post research saved.')
  }
  function editPost(post: Post) {
    const { id, ...draft } = post
    setPostDraft(draft)
    setEditingPost(id)
    setPage('Post Analyzer')
    setPostError('')
  }
  function removePost(post: Post) {
    if (!window.confirm('Delete this post and its associated comments? This cannot be undone.')) return
    updateData((current) => ({
      ...current, posts: current.posts.filter((item) => item.id !== post.id),
      comments: current.comments.filter((comment) => comment.postId !== post.id),
    }))
    if (selectedPost === post.id) setSelectedPost(null)
  }
  function addComments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCommentError('')
    const lines = commentText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) { setCommentError('Paste at least one comment before saving.'); return }
    const comments = lines.map((text): ResearchComment => ({
      id: uniqueId(), postId: commentPostId, text, ...analyzeComment(text),
      corrected: false, createdAt: localDate(), provenance: 'manual',
    }))
    updateData((current) => ({ ...current, comments: [...comments, ...current.comments] }))
    setCommentText('')
    setNotice(`${comments.length} comment${comments.length === 1 ? '' : 's'} analyzed.`)
  }
  function correctComment(comment: ResearchComment, sentiment: Sentiment) {
    updateData((current) => ({ ...current, comments: current.comments.map((item) =>
      item.id === comment.id ? { ...item, sentiment, corrected: true } : item) }))
  }
  function toggleCommentTheme(comment: ResearchComment, theme: Theme) {
    updateData((current) => ({ ...current, comments: current.comments.map((item) =>
      item.id === comment.id ? {
        ...item, corrected: true,
        themes: item.themes.includes(theme) ? item.themes.filter((entry) => entry !== theme) : [...item.themes, theme],
      } : item) }))
  }
  function deleteComment(comment: ResearchComment) {
    if (!window.confirm('Delete this comment record?')) return
    updateData((current) => ({ ...current, comments: current.comments.filter((item) => item.id !== comment.id) }))
  }
  function saveAd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAdError('')
    if (!adDraft.name.trim()) { setAdError('Campaign name is required.'); return }
    if (!validDate(adDraft.startDate) || !validDate(adDraft.endDate) || adDraft.endDate < adDraft.startDate) {
      setAdError('Enter valid start/end dates; the end date must not precede the start date.'); return
    }
    const keys = ['impressions', 'reach', 'clicks', 'spend', 'conversions', 'engagement'] as const
    const invalid = keys.find((key) => adDraft[key] !== null && (!Number.isFinite(adDraft[key]) || adDraft[key]! < 0))
    if (invalid) { setAdError(`${invalid} must be non-negative or left blank.`); return }
    updateData((current) => ({ ...current, ads: [{ ...adDraft, id: uniqueId(), provenance: 'manual' }, ...current.ads] }))
    setAdDraft(emptyAd())
    setNotice('Campaign research saved.')
  }
  function deleteAd(ad: AdCampaign) {
    if (!window.confirm(`Delete "${ad.name}"?`)) return
    updateData((current) => ({ ...current, ads: current.ads.filter((item) => item.id !== ad.id) }))
  }
  function handleCsv(file: File, kind: 'comments' | 'ads') {
    setNotice('')
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true, transformHeader: (header) => header.trim().toLowerCase().replaceAll(' ', '_'),
      complete: (result) => {
        const errors = result.errors
        if (errors.length || !result.meta.fields?.length) {
          setNotice(`CSV could not be imported: ${errors[0]?.message ?? 'No header row found.'}`)
          return
        }
        if (kind === 'comments') {
          const records = result.data
          if (!records.every((row) => 'comment' in row || 'text' in row)) {
            setNotice('Comment CSV needs a "comment" or "text" column.')
            return
          }
          const existing = new Set(data.comments.map((item) => item.id))
          let duplicateCount = 0
          const imported = records.flatMap((row): ResearchComment[] => {
            const text = (row.comment ?? row.text ?? '').trim()
            if (!text) return []
            const stableId = row.id?.trim()
            if (stableId && existing.has(stableId)) { duplicateCount++; return [] }
            const result = analyzeComment(text)
            const post = row.post_id?.trim() || ''
            if (row.date?.trim() && !validDate(row.date.trim())) { duplicateCount++; return [] }
            if (stableId) existing.add(stableId)
            return [{
              id: stableId || uniqueId(), postId: data.posts.some((item) => item.id === post) ? post : '',
              text, ...result, corrected: false, createdAt: row.date?.trim() || localDate(),
              provenance: 'imported',
            }]
          })
          if (!imported.length) { setNotice('No new valid comment rows were found. Check the comment column, date values, and duplicate IDs.'); return }
          updateData((current) => ({ ...current, comments: [...imported, ...current.comments] }))
          setNotice(`Imported ${imported.length} comments. ${duplicateCount ? `${duplicateCount} duplicate or invalid-date rows were skipped.` : ''}`)
        } else {
          const existing = new Set(data.ads.map((item) => item.id))
          let skipped = 0
          const imported = result.data.flatMap((row): AdCampaign[] => {
            const stableId = row.id?.trim()
            const name = (row.campaign_name ?? row.name ?? '').trim()
            const startDate = row.start_date ?? row.startdate ?? ''
            const endDate = row.end_date ?? row.enddate ?? startDate
            const metricValues = ['impressions', 'reach', 'clicks', 'spend', 'conversions', 'engagement'].map((key) => row[key]?.trim() ?? '')
            if (!name || !validDate(startDate) || !validDate(endDate) || endDate < startDate ||
              metricValues.some((value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
              skipped++
              return []
            }
            if (stableId && existing.has(stableId)) { skipped++; return [] }
            if (stableId) existing.add(stableId)
            const platform = PLATFORMS.find((entry) => entry.toLowerCase() === row.platform?.toLowerCase()) ?? 'Other'
            return [{
              id: stableId || uniqueId(), name, platform, startDate, endDate,
              impressions: safeMetric(row.impressions), reach: safeMetric(row.reach), clicks: safeMetric(row.clicks),
              spend: safeMetric(row.spend), conversions: safeMetric(row.conversions),
              engagement: safeMetric(row.engagement), provenance: 'imported',
            }]
          })
          if (!imported.length) { setNotice('No valid campaign rows found. Check name, start_date, end_date, numeric fields, and duplicate IDs.'); return }
          updateData((current) => ({ ...current, ads: [...imported, ...current.ads] }))
          setNotice(`Imported ${imported.length} campaign${imported.length === 1 ? '' : 's'}.${skipped ? ` ${skipped} invalid or duplicate rows were skipped.` : ''}`)
        }
      },
      error: (error) => setNotice(`CSV read failed: ${error.message}`),
    })
  }
  function exportFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
  function exportCsv(kind: 'posts' | 'comments' | 'ads') {
    const rows = kind === 'posts' ? data.posts : kind === 'comments' ? data.comments : data.ads
    if (!rows.length) { setNotice(`No ${kind} to export yet.`); return }
    const csv = kind === 'posts'
      ? Papa.unparse(data.posts)
      : kind === 'comments' ? Papa.unparse(data.comments) : Papa.unparse(data.ads)
    exportFile(`mbokapulse-${kind}.csv`, csv, 'text/csv;charset=utf-8')
  }
  function exportAll() {
    exportFile('mbokapulse-research-backup.json', JSON.stringify(data, null, 2), 'application/json')
  }
  function clearAll() {
    if (!window.confirm('Permanently clear all saved posts, comments, and ad research from this browser? Export a backup first if needed.')) return
    updateData(() => EMPTY_DATA)
    setReportReady(false)
    setNotice('All saved research was cleared.')
  }
  function clearDemoData() {
    if (!data.posts.some((item) => item.isDemo) && !data.comments.some((item) => item.isDemo) && !data.ads.some((item) => item.isDemo)) {
      setNotice('There are no synthetic demo records to clear.')
      return
    }
    if (!window.confirm('Remove all clearly labeled synthetic demo records? Your other research will remain.')) return
    updateData((current) => ({
      posts: current.posts.filter((item) => !item.isDemo),
      comments: current.comments.filter((item) => !item.isDemo),
      ads: current.ads.filter((item) => !item.isDemo),
    }))
    setNotice('Synthetic demo records cleared. Your other research was kept.')
  }
  function loadDemo() {
    if (data.posts.some((item) => item.isDemo)) { setNotice('Synthetic demo records are already loaded.'); return }
    const demoPostId = 'demo-post-mbokapulse-001'
    const post: Post = {
      id: demoPostId, url: 'https://example.com/demo-mbokaman-post', platform: 'Instagram',
      caption: '[SYNTHETIC DEMO] How can MbokaMan help you find your next opportunity?',
      author: 'MbokaMan (synthetic example)', publishedAt: '2026-10-12', contentType: 'Video',
      topic: 'Job discovery', campaign: 'Demo campaign', views: 1200, reach: 950, likes: 84,
      comments: 18, shares: 12, clicks: 30, collectedAt: '2026-10-14',
      notes: 'Synthetic example only. Not a real post or platform data.',
      provenance: Object.fromEntries(['views', 'reach', 'likes', 'comments', 'shares', 'clicks'].map((key) => [key, 'manual'])),
      isDemo: true,
    }
    const commentTexts = [
      'How do I create a profile and apply for a job?',
      'This is helpful, thank you for sharing!',
      'I have a problem uploading my CV.',
      'Can employers find qualified candidates here?',
    ]
    const comments = commentTexts.map((text, index): ResearchComment => ({
      id: `demo-comment-${index + 1}`, postId: demoPostId, text: `[SYNTHETIC DEMO] ${text}`,
      ...analyzeComment(text), corrected: false, createdAt: `2026-10-${15 + index}`,
      provenance: 'manual', isDemo: true,
    }))
    updateData((current) => ({ ...current, posts: [post, ...current.posts], comments: [...comments, ...current.comments] }))
    setNotice('Synthetic demo records added and clearly labeled.')
  }

  const metricTotals = (key: PostNumberField) => {
    const available = data.posts.filter((post) => post[key] !== null)
    return { value: available.reduce((sum, post) => sum + (post[key] ?? 0), 0), count: available.length }
  }
  const engagementValues = data.posts.map(engagementRate).filter((value): value is number => value !== null)
  const averageEngagement = engagementValues.length ? engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length : null
  const commentSearch = search.trim().toLocaleLowerCase()
  const visibleComments = data.comments.filter((comment) =>
    (!commentSearch || comment.text.toLocaleLowerCase().includes(commentSearch)) &&
    (sentimentFilter === 'all' || comment.sentiment === sentimentFilter),
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Activity size={21} /></div><div><strong>MbokaPulse</strong><small>RESEARCH WORKSPACE</small></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} aria-label={label} aria-current={page === label ? 'page' : undefined} onClick={() => setPage(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Comment Intelligence' && data.comments.length > 0 && <span className="nav-count">{data.comments.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card"><span className="offline-dot" /><div><strong>Offline-ready</strong><small>Research saved on this device</small></div></div>
          <button className="nav-item" onClick={exportAll}><ArrowDownToLine size={17} /><span>Export data backup</span></button>
          <button className="nav-item danger-text" onClick={clearAll}><Trash2 size={17} /><span>Clear all data</span></button>
          <div className="profile"><div className="avatar">M</div><div><strong>MbokaMan Research</strong><small>Local workspace</small></div><ChevronDown size={16} className="muted" /></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="breadcrumb">Research <span>/</span> <strong>{page}</strong></div><div className="top-actions"><span className="local-badge"><span /> LOCAL DATA</span><button className="icon-btn" title="Export backup" onClick={exportAll}><Download size={18} /></button><div className="avatar small">M</div></div></header>
        <div className="page-content">
          {storageError && <div className="alert error"><CircleHelp size={17} />{storageError}</div>}
          {notice && <div className="alert success"><Check size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
          {page === 'Overview' && <Overview posts={data.posts} comments={data.comments} totals={metricTotals} avg={averageEngagement} sentimentCounts={sentimentCounts} postsByScore={postsByScore} themes={themes} activity={activity} go={setPage} loadDemo={loadDemo} clearDemo={clearDemoData} />}
          {page === 'Post Analyzer' && <section>
            <PageHeading eyebrow="SOCIAL LISTENING" title="Post Analyzer" description="Record public post performance alongside the source and collection context." action={<button className="button primary" onClick={() => { setEditingPost(null); setPostDraft(emptyPost()); document.getElementById('post-form')?.scrollIntoView({ behavior: 'smooth' }) }}><Plus size={16} /> Add post</button>} />
            <div className="notice-strip"><CircleHelp size={17} /><span>Entering a URL does not retrieve private metrics. Record figures you can access; no scraping or platform API connection is performed.</span></div>
            <div className="section-card form-card" id="post-form">
              <div className="card-title-row"><div><h2>{editingPost ? 'Edit research record' : 'Post details'}</h2><p>Fields left blank remain unknown, not zero.</p></div><span className="source-tag manual">MANUAL ENTRY</span></div>
              <form onSubmit={savePost} className="form-grid">
                <Field label="Post URL" wide><input required type="url" placeholder="https://…" value={postDraft.url} onChange={(e) => setPostDraft({ ...postDraft, url: e.target.value })} /></Field>
                <Field label="Platform"><select value={postDraft.platform} onChange={(e) => setPostDraft({ ...postDraft, platform: e.target.value as Platform })}>{PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}</select></Field>
                <Field label="Author / account"><input value={postDraft.author} onChange={(e) => setPostDraft({ ...postDraft, author: e.target.value })} placeholder="Account name" /></Field>
                <Field label="Publication date"><input type="date" value={postDraft.publishedAt} onChange={(e) => setPostDraft({ ...postDraft, publishedAt: e.target.value })} /></Field>
                <Field label="Content type"><select value={postDraft.contentType} onChange={(e) => setPostDraft({ ...postDraft, contentType: e.target.value })}>{CONTENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
                <Field label="Topic"><input value={postDraft.topic} onChange={(e) => setPostDraft({ ...postDraft, topic: e.target.value })} placeholder="e.g. Job discovery" /></Field>
                <Field label="Campaign"><input value={postDraft.campaign} onChange={(e) => setPostDraft({ ...postDraft, campaign: e.target.value })} placeholder="Optional" /></Field>
                <Field label="Caption or post text" wide><textarea rows={3} value={postDraft.caption} onChange={(e) => setPostDraft({ ...postDraft, caption: e.target.value })} placeholder="Paste the observed caption or text" /></Field>
                <div className="form-section-label">RECORDED PERFORMANCE <span>Leave unknown metrics blank</span></div>
                {numberFields.map((field) => <Field label={field[0].toUpperCase() + field.slice(1)} key={field}><input type="number" min="0" step="any" value={postDraft[field] ?? ''} onChange={(e) => setPostDraft({ ...postDraft, [field]: numeric(e.target.value) })} placeholder="Not recorded" /></Field>)}
                <Field label="Metrics collected on"><input required type="date" value={postDraft.collectedAt} onChange={(e) => setPostDraft({ ...postDraft, collectedAt: e.target.value })} /></Field>
                <Field label="Research notes" wide><textarea rows={2} value={postDraft.notes} onChange={(e) => setPostDraft({ ...postDraft, notes: e.target.value })} placeholder="Collection context, source, or caveats" /></Field>
                {postError && <div className="field-error form-full">{postError}</div>}
                <div className="form-actions form-full"><button type="button" className="button ghost" onClick={() => { setEditingPost(null); setPostDraft(emptyPost()); setPostError('') }}>Reset</button><button className="button primary" type="submit"><Check size={16} />{editingPost ? 'Save changes' : 'Save research'}</button></div>
              </form>
            </div>
            <div className="section-card">
              <div className="card-title-row"><div><h2>Saved posts <span className="inline-count">{data.posts.length}</span></h2><p>Recorded data only · synthetic examples are labeled</p></div><button className="button ghost small-button" onClick={() => exportCsv('posts')}><Download size={15} /> Export CSV</button></div>
              <PostTable posts={data.posts} onView={setSelectedPost} onEdit={editPost} onDelete={removePost} />
            </div>
          </section>}
          {page === 'Comment Intelligence' && <section>
            <PageHeading eyebrow="AUDIENCE VOICE" title="Comment Intelligence" description="Analyze comments locally to surface recurring questions, needs, and sentiment." />
            <div className="notice-strip"><Sparkles size={17} /><span>Automated labels are preliminary keyword matches and may misclassify sarcasm, slang, Sheng, spelling variation, or context-dependent language. Review and correct them.</span></div>
            <div className="two-column align-start">
              <div className="section-card">
                <div className="card-title-row"><div><h2>Add comments</h2><p>One comment per line. No comments are generated for you.</p></div><MessageCircle size={19} className="accent-icon" /></div>
                <form onSubmit={addComments}>
                  <Field label="Associate with a saved post"><select value={commentPostId} onChange={(e) => setCommentPostId(e.target.value)}><option value="">Unassociated / general</option>{data.posts.map((post) => <option key={post.id} value={post.id}>{post.isDemo ? '[DEMO] ' : ''}{post.caption.slice(0, 54) || post.url}</option>)}</select></Field>
                  <textarea className="comment-input" rows={6} placeholder={'Paste real comments here, one per line…'} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <div className="form-actions"><button type="button" className="button ghost" onClick={() => commentsInput.current?.click()}><Upload size={15} /> Import CSV</button><button type="submit" className="button primary"><Sparkles size={15} /> Analyze comments</button></div>
                  <input ref={commentsInput} hidden type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleCsv(e.target.files[0], 'comments')} />
                  <div className="csv-hint">CSV columns: <code>comment</code> (or <code>text</code>), optional <code>id</code>, <code>post_id</code>, <code>date</code>.</div>
                  {commentError && <div className="field-error">{commentError}</div>}
                </form>
              </div>
              <div className="section-card theme-card">
                <div className="card-title-row"><div><h2>What people are saying</h2><p>Saved comments only · demo comments remain labeled</p></div></div>
                {themes.some((theme) => theme.count > 0) ? themes.filter((theme) => theme.count > 0).slice(0, 6).map((theme) => (
                  <div className="theme-row" key={theme.name}><div className="theme-top"><span>{theme.name}</span><b>{theme.count}</b></div><div className="theme-meter"><span style={{ width: `${Math.min(100, theme.count / data.comments.length * 100)}%` }} /></div>{theme.comments.map((comment) => <p className="quote" key={comment.id}>“{comment.text}”</p>)}</div>
                )) : <EmptyState title="No themes found yet" text="Add comments to see recurring questions, complaints, praise, and needs." />}
              </div>
            </div>
            <div className="section-card">
              <div className="card-title-row"><div><h2>Analyzed comments <span className="inline-count">{data.comments.length}</span></h2><p>Preliminary labels can be corrected at any time</p></div><button className="button ghost small-button" onClick={() => exportCsv('comments')}><Download size={15} /> Export CSV</button></div>
              <div className="table-controls"><div className="searchbox"><Search size={16} /><input placeholder="Search comments…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select className="filter-select" value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value)}><option value="all">All sentiments</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></div>
              {visibleComments.length ? <div className="comment-list">{visibleComments.map((comment) => <CommentRow key={comment.id} comment={comment} posts={data.posts} onCorrect={correctComment} onToggleTheme={toggleCommentTheme} onDelete={deleteComment} />)}</div> : <EmptyState title="No comments to show" text={data.comments.length ? 'Try another search or sentiment filter.' : 'Paste or import real comments to begin analysis.'} />}
            </div>
          </section>}
          {page === 'Trends' && <section>
            <PageHeading eyebrow="PERFORMANCE ANALYSIS" title="Trends" description="Compare recorded post metrics. Filters use publication dates and saved metadata." />
            <div className="section-card trend-filters">
              <div className="filter-heading"><Filter size={16} /> Filters</div>
              <Field label="From"><input type="date" value={trendFrom} onChange={(e) => setTrendFrom(e.target.value)} /></Field>
              <Field label="To"><input type="date" value={trendTo} onChange={(e) => setTrendTo(e.target.value)} /></Field>
              <Field label="Platform"><select value={trendPlatform} onChange={(e) => setTrendPlatform(e.target.value)}><option value="all">All platforms</option>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Topic"><select value={trendTopic} onChange={(e) => setTrendTopic(e.target.value)}><option value="all">All topics</option>{[...new Set(data.posts.map((post) => post.topic).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Content type"><select value={trendType} onChange={(e) => setTrendType(e.target.value)}><option value="all">All types</option>{CONTENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Campaign"><select value={trendCampaign} onChange={(e) => setTrendCampaign(e.target.value)}><option value="all">All campaigns</option>{[...new Set(data.posts.map((post) => post.campaign).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Rank by"><select value={trendMetric} onChange={(e) => setTrendMetric(e.target.value as typeof trendMetric)}><option value="engagement">Engagement rate</option>{numberFields.filter((field) => field !== 'clicks').map((field) => <option key={field} value={field}>{field[0].toUpperCase() + field.slice(1)}</option>)}</select></Field>
            </div>
            <div className="notice-strip"><Sparkles size={16} /><span>When loaded, synthetic demo posts are labeled in tables and shown with muted chart bars; demo comments remain tagged in comment records.</span></div>
            <div className="two-column">
              <div className="section-card chart-card"><div className="card-title-row"><div><h2>Post comparison</h2><p>{filteredPosts.length} posts match current filters</p></div><BarChart3 size={18} className="muted" /></div>
                  {filteredPosts.some((post) => trendMetric === 'engagement' ? engagementRate(post) !== null : post[trendMetric] !== null) ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><BarChart data={filteredPosts.filter((post) => trendMetric === 'engagement' ? engagementRate(post) !== null : post[trendMetric] !== null).map((post) => ({ name: `${(post.caption || post.author || post.platform).slice(0, 24)}${trendMetric === 'engagement' ? ` (${post.reach === null ? 'views' : 'reach'})` : ''}`, value: trendMetric === 'engagement' ? engagementRate(post) : post[trendMetric], demo: post.isDemo }))} margin={{ left: 0, right: 12, top: 10, bottom: 20 }}><CartesianGrid stroke="#d9d4c9" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#77746c', fontSize: 10 }} angle={-15} textAnchor="end" interval={0} /><YAxis tick={{ fill: '#77746c', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#fbf9f4', border: '1px solid #d9d4c9', borderRadius: 3, color: '#22221f' }} /><Bar dataKey="value" name={trendMetric === 'engagement' ? 'Engagement %' : trendMetric} radius={[2, 2, 0, 0]}>{filteredPosts.map((post, index) => <Cell key={post.id} fill={post.isDemo ? '#aaa59a' : chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState title="Not enough recorded metrics" text="Matching posts need the selected metric to compare." />}
              </div>
              <div className="section-card chart-card"><div className="card-title-row"><div><h2>Sentiment over time</h2><p>Based on comment record dates</p></div><Activity size={18} className="muted" /></div>
                {new Set(trendComments.map((comment) => comment.createdAt)).size >= 2 ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><LineChart data={[...new Set(trendComments.map((comment) => comment.createdAt))].sort().map((date) => ({ date, positive: trendComments.filter((comment) => comment.createdAt === date && comment.sentiment === 'positive').length, neutral: trendComments.filter((comment) => comment.createdAt === date && comment.sentiment === 'neutral').length, negative: trendComments.filter((comment) => comment.createdAt === date && comment.sentiment === 'negative').length }))}><CartesianGrid stroke="#d9d4c9" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#77746c', fontSize: 10 }} /><YAxis tick={{ fill: '#77746c', fontSize: 11 }} allowDecimals={false} /><Tooltip contentStyle={{ background: '#fbf9f4', border: '1px solid #d9d4c9', borderRadius: 3, color: '#22221f' }} /><Line type="monotone" dataKey="positive" stroke="#7c8c78" strokeWidth={2} /><Line type="monotone" dataKey="neutral" stroke="#b28a53" strokeWidth={2} /><Line type="monotone" dataKey="negative" stroke="#d95035" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <EmptyState title="Need at least two comment dates" text="Record comments on separate dates to view a time trend." />}
              </div>
            </div>
            <div className="notice-strip"><CircleHelp size={16} /><span>Engagement rate by reach = (likes + comments + shares) ÷ reach × 100. If reach is unavailable, the chart explicitly uses views as an alternative denominator. Incomplete metrics are excluded, never treated as zero.</span></div>
            <div className="section-card"><div className="card-title-row"><div><h2>Frequently discussed comment themes</h2><p>Preliminary keyword matches associated with posts in this filter</p></div><MessageCircle size={18} className="muted" /></div>
              {trendThemes.some((theme) => theme.count > 0) ? <div className="theme-bars trend-theme-grid">{trendThemes.filter((theme) => theme.count > 0).slice(0, 6).map((theme, index) => <div className="theme-bar-row" key={theme.name}><div><span>{theme.name}</span><b>{theme.count}</b></div><div className="theme-meter"><span style={{ width: `${Math.min(100, theme.count / trendThemes[0].count * 100)}%`, background: chartColors[index] }} /></div></div>)}</div> : <EmptyState title="No themes in this filtered sample" text="Add comments and associate them with posts to compare themes." />}
            </div>
            <div className="section-card"><div className="card-title-row"><div><h2>Top content by {trendMetric === 'engagement' ? 'engagement rate' : trendMetric}</h2><p>Only posts with the selected metric recorded</p></div></div><PostTable posts={[...filteredPosts].sort((a, b) => ((trendMetric === 'engagement' ? engagementRate(a) : a[trendMetric]) ?? -1) < ((trendMetric === 'engagement' ? engagementRate(b) : b[trendMetric]) ?? -1) ? 1 : -1)} compact /></div>
          </section>}
          {page === 'Ads Research' && <section>
            <PageHeading eyebrow="PAID MEDIA" title="Ads Research" description="Record campaign results collected from your own accessible sources." action={<button className="button ghost" onClick={() => adsInput.current?.click()}><Upload size={16} /> Import CSV</button>} />
            <div className="notice-strip"><CircleHelp size={17} /><span>No live advertising account connection. Data is explicitly labeled imported or manually recorded.</span></div>
            <input ref={adsInput} hidden type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleCsv(e.target.files[0], 'ads')} />
            <div className="section-card"><div className="card-title-row"><div><h2>Record a campaign</h2><p>Required campaign name and valid date range; unknown values stay blank.</p></div><span className="source-tag manual">MANUAL</span></div>
              <form className="form-grid" onSubmit={saveAd}>
                <Field label="Campaign name"><input required value={adDraft.name} onChange={(e) => setAdDraft({ ...adDraft, name: e.target.value })} /></Field>
                <Field label="Platform"><select value={adDraft.platform} onChange={(e) => setAdDraft({ ...adDraft, platform: e.target.value as Platform })}>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Start date"><input required type="date" value={adDraft.startDate} onChange={(e) => setAdDraft({ ...adDraft, startDate: e.target.value })} /></Field>
                <Field label="End date"><input required type="date" value={adDraft.endDate} onChange={(e) => setAdDraft({ ...adDraft, endDate: e.target.value })} /></Field>
                {(['impressions', 'reach', 'clicks', 'spend', 'conversions', 'engagement'] as const).map((field) => <Field key={field} label={field[0].toUpperCase() + field.slice(1)}><input type="number" min="0" step="any" placeholder="Not recorded" value={adDraft[field] ?? ''} onChange={(e) => setAdDraft({ ...adDraft, [field]: numeric(e.target.value) })} /></Field>)}
                {adError && <div className="field-error form-full">{adError}</div>}
                <div className="form-actions form-full"><button type="submit" className="button primary"><Plus size={16} /> Save campaign</button></div>
              </form>
              <p className="csv-hint">CSV headers: <code>id</code>, <code>campaign_name</code>/<code>name</code>, <code>platform</code>, <code>start_date</code>, <code>end_date</code>, <code>impressions</code>, <code>reach</code>, <code>clicks</code>, <code>spend</code>, <code>conversions</code>, <code>engagement</code>.</p>
            </div>
            <div className="section-card"><div className="card-title-row"><div><h2>Campaign records <span className="inline-count">{data.ads.length}</span></h2><p>CTR = clicks / impressions · CPC = spend / clicks · conversion rate = conversions / clicks</p></div><button className="button ghost small-button" onClick={() => exportCsv('ads')}><Download size={15} /> Export CSV</button></div>
              {data.ads.length ? <div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Platform</th><th>Dates</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>CTR</th><th>CPC</th><th>Conv. rate</th><th>Source</th><th /></tr></thead><tbody>{data.ads.map((ad) => { const metrics = campaignMetrics(ad); return <tr key={ad.id}><td><strong>{ad.name}</strong>{ad.isDemo && <span className="demo-tag">DEMO</span>}</td><td>{ad.platform}</td><td>{ad.startDate} – {ad.endDate}</td><td>{formatNumber(ad.impressions)}</td><td>{formatNumber(ad.clicks)}</td><td>{ad.spend === null ? '—' : ad.spend.toFixed(2)}</td><td>{metrics.ctr === null ? '—' : `${metrics.ctr.toFixed(2)}%`}</td><td>{metrics.cpc === null ? '—' : metrics.cpc.toFixed(2)}</td><td>{metrics.conversionRate === null ? '—' : `${metrics.conversionRate.toFixed(2)}%`}</td><td><SourceTag source={ad.provenance} /></td><td><button className="icon-btn danger" title="Delete campaign" onClick={() => deleteAd(ad)}><Trash2 size={15} /></button></td></tr> })}</tbody></table></div> : <EmptyState title="No campaign data yet" text="Add a campaign manually or import a CSV to calculate performance metrics." />}</div>
            </section>}
          {page === 'Reports' && <section>
            <PageHeading eyebrow="EVIDENCE & FINDINGS" title="Research reports" description="Generate a concise evidence-backed snapshot from the records saved on this device." action={<button className="button primary" onClick={() => setReportReady(true)}><FileText size={16} /> Generate report</button>} />
            {!reportReady ? <div className="section-card report-prompt"><div className="report-icon"><FileText size={25} /></div><h2>Build a research snapshot</h2><p>Reports only summarize your saved posts, comments, and metrics. Synthetic demo items remain labeled.</p><button className="button primary" onClick={() => setReportReady(true)}>Generate report <ArrowDownToLine size={16} /></button></div> : <Report data={data} />}
          </section>}
        </div>
      </main>
      {selectedPost && activePost && <Modal title="Post research detail" onClose={() => setSelectedPost(null)}>
        <div className="detail-top"><SourceTag source="manual" />{activePost.isDemo && <span className="demo-tag">SYNTHETIC DEMO</span>}</div>
        <h3 className="detail-caption">{activePost.caption || 'Untitled post'}</h3>
        <a className="external-link" href={validUrl(activePost.url) ? activePost.url : undefined} target="_blank" rel="noreferrer noopener" aria-disabled={!validUrl(activePost.url)}>{activePost.url} <ExternalLink size={14} /></a>
        <div className="detail-grid">{[['Platform', activePost.platform], ['Account', activePost.author || '—'], ['Published', activePost.publishedAt || '—'], ['Collected', activePost.collectedAt], ['Topic', activePost.topic || '—'], ['Campaign', activePost.campaign || '—'], ...numberFields.map((key) => [key, formatNumber(activePost[key])])].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <div className="provenance-list"><small>FIELD PROVENANCE</small><div>{(['url', 'platform', 'caption', 'author', 'publishedAt', 'contentType', 'topic', 'campaign', ...numberFields, 'collectedAt', 'notes'] as (keyof Post)[]).map((field) => {
          const value = activePost[field]
          const missing = value === null || value === ''
          return <span key={field}>{String(field)} {missing ? <i>NOT RECORDED</i> : <SourceTag source={activePost.provenance[field] ?? 'manual'} />}</span>
        })}</div></div>
        <div className="detail-notes"><small>NOTES</small><p>{activePost.notes || 'No notes recorded.'}</p></div>
        <div className="form-actions"><button className="button ghost" onClick={() => editPost(activePost)}><Pencil size={15} /> Edit</button><button className="button ghost danger" onClick={() => removePost(activePost)}><Trash2 size={15} /> Delete</button></div>
      </Modal>}
    </div>
  )
}

function Overview({ posts, comments, totals, avg, sentimentCounts, postsByScore, themes, activity, go, loadDemo, clearDemo }: {
  posts: Post[]; comments: ResearchComment[]; totals: (key: PostNumberField) => { value: number; count: number }
  avg: number | null; sentimentCounts: { name: string; value: number }[]; postsByScore: Post[]
  themes: { name: Theme; count: number; comments: ResearchComment[] }[]
  activity: { id: string; kind: string; detail: string; date: string; demo?: boolean }[]; go: (page: Page) => void; loadDemo: () => void; clearDemo: () => void
}) {
  const views = totals('views')
  const likes = totals('likes')
  const commentCount = totals('comments')
  const shares = totals('shares')
  const best = postsByScore.filter((post) => engagementRate(post) !== null).slice(0, 3)
  const totalComments = comments.length
  return <section>
    <PageHeading eyebrow="YOUR RESEARCH AT A GLANCE" title="Research briefing" description="A clear view of the research records collected in this workspace." action={<button className="button primary" onClick={() => go('Post Analyzer')}><Plus size={16} /> Add research</button>} />
    <div className="data-scope-banner"><span className="scope-dot" /> Figures below reflect records saved here only—not platform-wide analytics. Demo records, if loaded, are included and individually labeled. <span>Missing values are excluded, never assumed to be zero.</span></div>
    <article className="featured-insight">
      <div className="featured-insight-label">LEADING POST · RECORDED ENGAGEMENT</div>
      {best.length ? <div className="featured-insight-content">
        <div>
          <h2>{best[0].caption || best[0].url}</h2>
          <p>{best[0].platform} · {best[0].publishedAt || 'Publication date not recorded'}{best[0].isDemo ? ' · SYNTHETIC DEMO' : ''}</p>
        </div>
        <div className="featured-insight-rate"><strong>{engagementLabel(best[0]).split(' ')[0]}</strong><span>engagement by {best[0].reach === null ? 'views' : 'reach'}</span></div>
      </div> : <div className="featured-insight-content">
        <div><h2>No comparable post in this sample</h2><p>A recorded reach or views value and complete engagement metrics are needed to calculate a rate.</p></div>
        <button className="text-button" onClick={() => go('Post Analyzer')}>Add research →</button>
      </div>}
    </article>
    <div className="stats-grid">
      <StatCard label="Analyzed posts" value={formatNumber(posts.length)} note={`${posts.filter((post) => !post.isDemo).length} research · ${posts.filter((post) => post.isDemo).length} demo`} icon={<Activity size={18} />} />
      <StatCard label="Recorded views" value={formatNumber(views.count ? views.value : null)} note={views.count ? `${views.count} of ${posts.length} ${posts.length === 1 ? 'post has' : 'posts have'} views` : 'No views recorded'} icon={<Eye size={18} />} />
      <StatCard label="Recorded likes" value={formatNumber(likes.count ? likes.value : null)} note={likes.count ? `${plural(likes.count, 'post')} with recorded likes` : 'No likes recorded'} icon={<Heart size={18} />} />
      <StatCard label="Recorded comments" value={formatNumber(commentCount.count ? commentCount.value : null)} note={commentCount.count ? `${plural(commentCount.count, 'post')} with this metric` : 'No post comment totals recorded'} icon={<MessageCircle size={18} />} />
      <StatCard label="Recorded shares" value={formatNumber(shares.count ? shares.value : null)} note={shares.count ? `${plural(shares.count, 'post')} with recorded shares` : 'No shares recorded'} icon={<Share2 size={18} />} />
      <StatCard label="Avg. engagement" value={avg === null ? '—' : `${avg.toFixed(2)}%`} note="Mean of calculable rates; views fallback labeled in Trends" icon={<MousePointer2 size={18} />} />
    </div>
    <div className="two-column overview-charts">
      <div className="section-card chart-card"><div className="card-title-row"><div><h2>Comment sentiment</h2><p>{totalComments} saved comment{totalComments === 1 ? '' : 's'} · preliminary local labels</p></div><MessageCircle size={18} className="muted" /></div>
        {totalComments ? <div className="sentiment-chart"><div className="pie-wrap"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={sentimentCounts} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={4}><Cell fill="#7c8c78" /><Cell fill="#b28a53" /><Cell fill="#d95035" /></Pie><Tooltip contentStyle={{ background: '#fbf9f4', border: '1px solid #d9d4c9', borderRadius: 3, color: '#22221f' }} /></PieChart></ResponsiveContainer><div className="pie-center"><strong>{totalComments}</strong><small>COMMENTS</small></div></div><div className="legend-list">{sentimentCounts.map((entry, index) => <div key={entry.name}><span className={`legend-dot color-${index}`} />{entry.name}<b>{entry.value}</b></div>)}</div></div> : <EmptyState title="No comments analyzed" text="Add comments to see the distribution of preliminary sentiment labels." />}</div>
      <div className="section-card chart-card"><div className="card-title-row"><div><h2>Frequent comment themes</h2><p>Keyword-based counts · demo comments remain labeled</p></div><Sparkles size={18} className="muted" /></div>
        {themes.some((theme) => theme.count) ? <div className="theme-bars">{themes.filter((theme) => theme.count).slice(0, 5).map((theme, index) => <div className="theme-bar-row" key={theme.name}><div><span>{theme.name}</span><b>{theme.count}</b></div><div className="theme-meter"><span style={{ width: `${Math.max(4, theme.count / themes[0].count * 100)}%`, background: chartColors[index] }} /></div></div>)}</div> : <EmptyState title="No themes identified" text="Add real comments to uncover recurring audience themes." />}</div>
    </div>
    <div className="two-column">
      <div className="section-card"><div className="card-title-row"><div><h2>Best-performing posts</h2><p>Ranked by calculable engagement rate</p></div><button className="text-button" onClick={() => go('Trends')}>View trends →</button></div>
        {best.length ? best.map((post, index) => <div className="best-post" key={post.id}><div className="rank">0{index + 1}</div><div className="best-main"><strong>{post.caption || post.url}</strong><small>{post.platform} · {post.publishedAt || 'Date not recorded'}{post.isDemo && ' · SYNTHETIC DEMO'}</small></div><span className="rate-pill">{engagementLabel(post)}</span></div>) : <EmptyState title="No comparable posts yet" text="Reach (or fallback views), likes, comments, and shares are needed to calculate a rate." />}
      </div>
      <div className="section-card"><div className="card-title-row"><div><h2>Recent activity</h2><p>Latest records in this workspace</p></div><Activity size={17} className="muted" /></div>
        {activity.length ? <div className="activity-list">{activity.map((item) => <div className="activity-row" key={`${item.kind}-${item.id}`}><div className="activity-icon"><Check size={14} /></div><div><strong>{item.kind}{item.demo && <span className="demo-tag">DEMO</span>}</strong><small>{item.detail}</small></div><time>{item.date || 'Date not recorded'}</time></div>)}</div> : <EmptyState title="No research activity" text="Your saved research records will appear here." />}
      </div>
    </div>
    <div className="demo-callout"><div className="demo-icon"><Sparkles size={19} /></div><div><strong>Exploring the workspace?</strong><p>Load clearly labeled synthetic examples to preview charts and analysis.</p></div><button className="button ghost" onClick={() => go('Post Analyzer')}>Open post analyzer</button><button className="button outline" onClick={loadDemo}>Load demo data</button><button className="button ghost" onClick={clearDemo}>Clear demo data</button></div>
  </section>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? 'field-wide' : ''}`}><span>{label}</span>{children}</label>
}
function StatCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong className="stat-value">{value}</strong><small>{note}</small></div>
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={19} /></div><strong>{title}</strong><p>{text}</p></div>
}
function SourceTag({ source }: { source: Provenance }) {
  return <span className={`source-tag ${source}`}>{source === 'public' ? 'PUBLIC METADATA' : source.toUpperCase()}</span>
}
function PostTable({ posts, onView, onEdit, onDelete, compact = false }: {
  posts: Post[]; onView?: (id: string) => void; onEdit?: (post: Post) => void; onDelete?: (post: Post) => void; compact?: boolean
}) {
  if (!posts.length) return <EmptyState title="No posts saved yet" text="Add manually collected post research to compare performance." />
  return <div className="table-scroll"><table><thead><tr><th>Post</th><th>Platform</th><th>Published</th><th>Views</th><th>Reach</th><th>Engagement</th><th>Source</th>{!compact && <th>Actions</th>}</tr></thead><tbody>{posts.map((post) => <tr key={post.id}><td className="post-cell"><button className="table-link" onClick={() => onView?.(post.id)}>{post.caption || post.url}</button>{post.isDemo && <span className="demo-tag">SYNTHETIC DEMO</span>}</td><td>{post.platform}</td><td>{post.publishedAt || '—'}</td><td>{formatNumber(post.views)}</td><td>{formatNumber(post.reach)}</td><td>{engagementLabel(post)}</td><td><SourceTag source={post.provenance.reach ?? post.provenance.views ?? 'manual'} /></td>{!compact && <td><div className="row-actions"><button className="icon-btn" title="View details" onClick={() => onView?.(post.id)}><Eye size={15} /></button><button className="icon-btn" title="Edit post" onClick={() => onEdit?.(post)}><Pencil size={15} /></button><button className="icon-btn danger" title="Delete post" onClick={() => onDelete?.(post)}><Trash2 size={15} /></button></div></td>}</tr>)}</tbody></table></div>
}
function CommentRow({ comment, posts, onCorrect, onToggleTheme, onDelete }: {
  comment: ResearchComment; posts: Post[]; onCorrect: (comment: ResearchComment, sentiment: Sentiment) => void
  onToggleTheme: (comment: ResearchComment, theme: Theme) => void; onDelete: (comment: ResearchComment) => void
}) {
  const post = posts.find((item) => item.id === comment.postId)
  return <article className="comment-row">
    <div className={`sentiment-marker ${comment.sentiment}`} />
    <div className="comment-body"><p>{comment.text}</p><div className="comment-meta"><span>{comment.createdAt}</span><span>·</span><span>{post ? (post.caption || post.platform).slice(0, 35) : 'Unassociated'}</span><SourceTag source={comment.provenance} /></div>
      <div className="comment-tags">{themeLabels.map((theme) => <button type="button" className={comment.themes.includes(theme) ? 'selected' : ''} aria-pressed={comment.themes.includes(theme)} key={theme} onClick={() => onToggleTheme(comment, theme)}>{theme}</button>)}</div>
    </div>
    <div className="comment-controls"><select aria-label="Correct sentiment" value={comment.sentiment} onChange={(e) => onCorrect(comment, e.target.value as Sentiment)}><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select>{comment.corrected && <span className="corrected-label">Corrected</span>}<button className="icon-btn danger" title="Delete comment" onClick={() => onDelete(comment)}><Trash2 size={15} /></button></div>
  </article>
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>
}
function Report({ data }: { data: AppData }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const periodPosts = data.posts.filter((post) => (!from || (post.publishedAt || post.collectedAt) >= from) && (!to || (post.publishedAt || post.collectedAt) <= to))
  const periodComments = data.comments.filter((comment) => (!from || comment.createdAt >= from) && (!to || comment.createdAt <= to))
  const posts = periodPosts.filter((post) => !post.isDemo)
  const comments = periodComments.filter((comment) => !comment.isDemo)
  const demoPosts = periodPosts.filter((post) => post.isDemo)
  const demoComments = periodComments.filter((comment) => comment.isDemo)
  const reportAds = data.ads.filter((ad) => (!from || ad.endDate >= from) && (!to || ad.startDate <= to))
  const concerns = comments.filter((comment) => comment.themes.some((theme) => ['complaint', 'worker concern', 'employer need', 'feature request'].includes(theme)))
  const questions = comments.filter((comment) => comment.themes.includes('question'))
  const reportThemes = themeLabels.map((theme) => ({ theme, count: comments.filter((comment) => comment.themes.includes(theme)).length })).filter((item) => item.count)
  const datedPosts = posts.filter((post) => post.publishedAt)
  const reportDate = new Date().toLocaleDateString()
  function exportReport() {
    const findings = [
      { section: 'Report', field: 'generated', value: reportDate },
      { section: 'Report', field: 'period_from', value: from || 'All available dates' },
      { section: 'Report', field: 'period_to', value: to || 'Present' },
      { section: 'Sample', field: 'research_posts', value: posts.length },
      { section: 'Sample', field: 'research_comments', value: comments.length },
      { section: 'Sample', field: 'synthetic_demo_posts_excluded', value: demoPosts.length },
      { section: 'Sample', field: 'synthetic_demo_comments_excluded', value: demoComments.length },
      { section: 'Sample', field: 'campaigns', value: reportAds.length },
      { section: 'Metrics', field: 'posts_with_views', value: posts.filter((post) => post.views !== null).length },
      { section: 'Metrics', field: 'posts_with_reach', value: posts.filter((post) => post.reach !== null).length },
      ...reportThemes.map((item) => ({ section: 'Observed theme', field: item.theme, value: item.count })),
      ...comments.map((comment) => ({ section: 'Supporting comment', field: comment.sentiment, value: comment.text })),
      { section: 'Hypothesis (not established)', field: 'proposed_experiment', value: 'Test one revised caption or FAQ response against a comparable post, recording reach, engagement, and collection dates for both.' },
    ]
    const blob = new Blob([Papa.unparse(findings)], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'mbokapulse-research-report.csv'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
  return <div className="report-wrap">
    <div className="section-card report-controls"><Field label="Period from"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Period to"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field><div className="report-actions"><button className="button ghost" onClick={exportReport}><Download size={15} /> Export report CSV</button><button className="button primary" onClick={() => window.print()}><FileText size={15} /> Print / Save PDF</button></div></div>
    <article className="section-card report-document" id="print-report">
      <div className="report-doc-head"><div className="brand-mark"><Activity size={19} /></div><div><span>MBOKAPULSE · RESEARCH REPORT</span><h2>Audience & content research</h2></div><small>Generated {reportDate}</small></div>
      <div className="report-period"><b>Reporting period</b><span>{from || 'All available dates'} – {to || 'Present'}</span><span className="report-sample">Research sample: {plural(posts.length, 'post')} · {plural(comments.length, 'comment')} · {plural(reportAds.length, 'campaign')}; synthetic examples excluded ({plural(demoPosts.length, 'post')}, {plural(demoComments.length, 'comment')})</span></div>
      <div className="report-section"><h3>Evidence-backed findings</h3>{posts.length || comments.length ? <ul>
        <li><b>Sample:</b> {plural(posts.length, 'non-demo post')} and {plural(comments.length, 'non-demo comment')} are included. Synthetic demo items are excluded from findings ({plural(demoPosts.length, 'post')} and {plural(demoComments.length, 'comment')} in period).</li>
        <li><b>Available post metrics:</b> views on {posts.filter((post) => post.views !== null).length}/{posts.length}, reach on {posts.filter((post) => post.reach !== null).length}/{posts.length}, likes on {posts.filter((post) => post.likes !== null).length}/{posts.length}, shares on {posts.filter((post) => post.shares !== null).length}/{posts.length}.</li>
        {datedPosts.length > 1 && <li><b>Observed date coverage:</b> posts span {datedPosts.map((post) => post.publishedAt).sort()[0]} to {datedPosts.map((post) => post.publishedAt).sort().at(-1)}.</li>}
        {reportThemes.length ? <li><b>Comment themes:</b> {reportThemes.map((item) => `${item.theme} (${item.count})`).join(', ')}.</li> : <li>No keyword themes matched in the selected sample.</li>}
        {comments.length ? <li><b>Preliminary sentiment:</b> {comments.filter((comment) => comment.sentiment === 'positive').length} positive, {comments.filter((comment) => comment.sentiment === 'neutral').length} neutral, {comments.filter((comment) => comment.sentiment === 'negative').length} negative labels.</li> : null}
      </ul> : <p>No saved evidence falls within this period. Add records to generate findings.</p>}</div>
      <div className="report-section"><h3>Main concerns & recurring questions</h3>{concerns.length || questions.length ? <ul>{concerns.length > 0 && <li>{concerns.length} comments matched concern, need, or feature-request keywords.</li>}{questions.length > 0 && <li>{questions.length} comments matched question indicators.</li>}</ul> : <p>No saved comments matched these themes. This is not evidence that concerns are absent.</p>}</div>
      <div className="report-section"><h3>Representative supporting comments</h3>{comments.length ? <ul className="representative-list">{([...(concerns.length || questions.length ? [...concerns, ...questions] : comments)]).filter((comment, index, list) => list.findIndex((item) => item.id === comment.id) === index).slice(0, 5).map((comment) => <li key={comment.id}>“{comment.text}” <span>— {comment.createdAt}</span></li>)}</ul> : <p>No comments are available for this period.</p>}</div>
      <div className="report-section"><h3>Observed trends</h3>{reportThemes.length ? <p>Keyword themes in this saved sample are led by {reportThemes.sort((a, b) => b.count - a.count)[0].theme}. Trends are descriptive of this sample only.</p> : <p>Insufficient matched comment data to describe a theme trend.</p>}</div>
      <div className="report-section hypothesis"><h3>Hypotheses & proposed experiments <span>NOT ESTABLISHED BY THIS SAMPLE</span></h3><p><b>Hypothesis:</b> The most frequent question theme may indicate a point where onboarding explanations could be clearer. This is a hypothesis, not a finding.</p><p><b>Experiment:</b> Test one revised caption or FAQ response against a comparable post, recording reach, engagement, and collection dates for both.</p></div>
      <div className="report-section"><h3>Limitations & next steps</h3><ul><li>Records are manually collected or imported and are not verified against platform-wide totals.</li><li>Keyword-based labels are preliminary and can miss sarcasm, Sheng, slang, and context.</li><li>Missing metrics are excluded; comparisons may have incomplete or different source coverage.</li><li>Collect dated data consistently, review comment labels, and add context before drawing decisions.</li></ul></div>
      <footer className="report-footer">Prepared from local MbokaPulse records · No live platform or advertising account access</footer>
    </article>
  </div>
}

export default App
