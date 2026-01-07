import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './components/Dashboard'

// Import all brainlift data
import alphaSchools from './data/alpha-schools.json'
import knowledgeRich from './data/knowledge-rich-curriculum.json'

// Registry of all brainlifts
const brainlifts = {
  'alpha-schools': alphaSchools,
  'knowledge-rich-curriculum': knowledgeRich,
}

// Home page - list all available brainlifts
function Home() {
  const colors = {
    navy: '#1e3a5f',
    orange: '#f59e0b',
    teal: '#0d9488',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    coral: '#f97316',
    lightBg: '#f8fafc',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.lightBg,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <header style={{
        backgroundColor: colors.cardBg,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 48px',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: colors.navy,
          margin: 0,
        }}>DOK1 GRADING</h1>
        <p style={{ color: colors.textSecondary, fontSize: '14px', marginTop: '4px' }}>
          Select a brainlift to grade
        </p>
      </header>

      <div style={{
        height: '4px',
        background: `linear-gradient(90deg, ${colors.purple} 0%, ${colors.teal} 25%, ${colors.green} 50%, ${colors.blue} 75%, ${colors.coral} 100%)`,
      }} />

      <main style={{ padding: '48px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(brainlifts).map(([slug, data]) => (
            <Link
              key={slug}
              to={`/grading/${slug}`}
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '24px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.orange
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <h2 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: colors.navy,
                margin: '0 0 8px 0',
              }}>{data.title}</h2>
              <p style={{
                color: colors.textSecondary,
                fontSize: '14px',
                margin: '0 0 12px 0',
              }}>{data.description}</p>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <span style={{ color: colors.teal, fontWeight: 500 }}>
                  {data.facts.length} facts
                </span>
                <span style={{ color: colors.orange, fontWeight: 500 }}>
                  {data.contradictionClusters.length} contradiction clusters
                </span>
                <span style={{ color: colors.purple, fontWeight: 500 }}>
                  {data.readingList.length} sources
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

// Wrapper component to load brainlift by slug
function GradingPage() {
  const slug = window.location.pathname.split('/grading/')[1]
  const data = brainlifts[slug]

  if (!data) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <h1>Brainlift not found</h1>
        <p>No brainlift exists at this URL.</p>
        <Link to="/">← Back to home</Link>
      </div>
    )
  }

  return <Dashboard data={data} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/grading/:slug" element={<GradingPage />} />
    </Routes>
  )
}
