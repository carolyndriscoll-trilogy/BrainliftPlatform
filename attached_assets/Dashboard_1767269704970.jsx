import React, { useState } from 'react'
import { Link } from 'react-router-dom'

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

const getScoreColor = (score) => {
  if (score === 5) return colors.green
  if (score === 4) return colors.teal
  if (score === 3) return colors.orange
  if (score === 2) return colors.coral
  return '#dc2626'
}

const getTypeColor = (type) => {
  if (type === 'Twitter') return colors.blue
  if (type === 'Substack') return colors.coral
  if (type === 'Blog') return colors.purple
  return colors.teal
}

const getCategoryColor = (category) => {
  if (category === 'Regulatory') return colors.purple
  if (category === 'External Benchmarks') return colors.blue
  if (category === 'Research') return colors.teal
  if (category === 'Louisiana') return colors.green
  return colors.orange
}

export default function Dashboard({ data }) {
  const [activeTab, setActiveTab] = useState('grading')
  
  const { title, description, facts, contradictionClusters, readingList, summary } = data

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.lightBg,
      color: colors.textPrimary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: colors.cardBg,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <Link to="/" style={{ 
            color: colors.textSecondary, 
            textDecoration: 'none', 
            fontSize: '13px',
            display: 'block',
            marginBottom: '4px',
          }}>
            ← All Brainlifts
          </Link>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            margin: 0,
            color: colors.navy,
            letterSpacing: '-0.02em',
          }}>{title}</h1>
          <p style={{
            color: colors.textSecondary,
            fontSize: '14px',
            margin: '4px 0 0 0',
          }}>{description}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['grading', 'contradictions', 'reading'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: activeTab === tab ? 'none' : `1px solid ${colors.border}`,
                backgroundColor: activeTab === tab ? colors.orange : colors.cardBg,
                color: activeTab === tab ? '#fff' : colors.textPrimary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'grading' && 'Fact Grading'}
              {tab === 'contradictions' && 'Contradictions'}
              {tab === 'reading' && 'Reading List'}
            </button>
          ))}
        </div>
      </header>

      {/* Gradient Bar */}
      <div style={{
        height: '4px',
        background: `linear-gradient(90deg, ${colors.purple} 0%, ${colors.teal} 25%, ${colors.green} 50%, ${colors.blue} 75%, ${colors.coral} 100%)`,
      }} />

      {/* Main Content */}
      <main style={{ padding: '32px 48px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Grading Tab */}
        {activeTab === 'grading' && (
          <div>
            {/* Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '32px',
            }}>
              {[
                { label: 'Total Facts', value: summary.totalFacts, color: colors.navy },
                { label: 'Mean Score', value: summary.meanScore, color: colors.navy },
                { label: 'Score 5 (Verified)', value: summary.score5Count, color: colors.green },
                { label: 'With Contradictions', value: summary.contradictionCount, color: colors.orange },
              ].map((stat, i) => (
                <div key={i} style={{
                  backgroundColor: colors.cardBg,
                  borderRadius: '12px',
                  padding: '20px 24px',
                  border: `1px solid ${colors.border}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0, fontWeight: 500 }}>{stat.label}</p>
                  <p style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 0 0', color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Facts Table */}
            <div style={{
              backgroundColor: colors.cardBg,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '70px 140px 1fr 80px 180px',
                padding: '14px 24px',
                backgroundColor: colors.navy,
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <span>ID</span>
                <span>Category</span>
                <span>Fact</span>
                <span>Score</span>
                <span>Contradiction</span>
              </div>
              {facts.map((fact, index) => (
                <div
                  key={fact.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 140px 1fr 80px 180px',
                    padding: '16px 24px',
                    borderBottom: index < facts.length - 1 ? `1px solid ${colors.border}` : 'none',
                    fontSize: '14px',
                    alignItems: 'center',
                    backgroundColor: index % 2 === 0 ? colors.cardBg : colors.lightBg,
                  }}
                >
                  <span style={{ color: colors.textSecondary, fontFamily: 'monospace', fontWeight: 600 }}>{fact.id}</span>
                  <span style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    backgroundColor: getCategoryColor(fact.category) + '15',
                    color: getCategoryColor(fact.category),
                    borderRadius: '20px',
                    width: 'fit-content',
                    fontWeight: 600,
                  }}>{fact.category}</span>
                  <span style={{ paddingRight: '16px', color: colors.textPrimary }}>{fact.fact}</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: getScoreColor(fact.score),
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '16px',
                  }}>{fact.score}</span>
                  <span style={{
                    color: fact.contradicts ? colors.orange : colors.textSecondary,
                    fontSize: '13px',
                    fontWeight: fact.contradicts ? 500 : 400,
                  }}>
                    {fact.contradicts || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contradictions Tab */}
        {activeTab === 'contradictions' && (
          <div>
            <div style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              borderLeft: `4px solid ${colors.blue}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <p style={{
                color: colors.navy,
                fontSize: '16px',
                margin: 0,
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}>
                "You can have inconsistent facts. Highlight them, don't resolve them. This is how you move knowledge forward."
                <span style={{ fontWeight: 600, fontStyle: 'normal', marginLeft: '8px' }}>— Joe Liemandt</span>
              </p>
            </div>

            {contradictionClusters.length === 0 ? (
              <div style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '48px',
                textAlign: 'center',
                color: colors.textSecondary,
              }}>
                No contradiction clusters identified in this brainlift.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {contradictionClusters.map((cluster, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '12px',
                      padding: '28px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '20px',
                    }}>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        margin: 0,
                        color: colors.navy,
                      }}>{cluster.name}</h3>
                      <span style={{
                        padding: '6px 16px',
                        backgroundColor: colors.orange,
                        color: '#fff',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>{cluster.status}</span>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ color: colors.textSecondary, fontSize: '12px', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Fact IDs</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {cluster.factIds.map(id => (
                          <span key={id} style={{
                            padding: '6px 14px',
                            backgroundColor: colors.purple + '15',
                            color: colors.purple,
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '14px',
                            fontWeight: 600,
                          }}>{id}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ color: colors.textSecondary, fontSize: '12px', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Claims</p>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: colors.textPrimary }}>
                        {cluster.claims.map((claim, i) => (
                          <li key={i} style={{ marginBottom: '6px', fontSize: '15px' }}>{claim}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{
                      padding: '16px 20px',
                      backgroundColor: colors.orange + '10',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${colors.orange}`,
                    }}>
                      <p style={{ color: colors.textSecondary, fontSize: '12px', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Tension</p>
                      <p style={{ margin: 0, fontSize: '15px', color: colors.textPrimary }}>{cluster.tension}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reading List Tab */}
        {activeTab === 'reading' && (
          <div>
            <div style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <p style={{ margin: 0, fontSize: '15px', color: colors.textPrimary }}>
                <strong style={{ color: colors.navy }}>Instructions:</strong> Read each source (~1 hour total). Grade each for alignment to DOK1 fact base.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
            }}>
              {readingList.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '20px 24px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.15s ease',
                    display: 'block',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = getTypeColor(item.type)
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                  }}>
                    <span style={{
                      padding: '5px 12px',
                      backgroundColor: getTypeColor(item.type) + '15',
                      color: getTypeColor(item.type),
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>{item.type}</span>
                    <span style={{
                      color: colors.textSecondary,
                      fontSize: '13px',
                      fontWeight: 500,
                    }}>{item.time}</span>
                  </div>
                  <p style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                    margin: '0 0 6px 0',
                    fontWeight: 500,
                  }}>{item.author}</p>
                  <p style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    margin: '0 0 12px 0',
                    lineHeight: 1.4,
                    color: colors.navy,
                  }}>{item.topic}</p>
                  <p style={{
                    fontSize: '12px',
                    color: colors.textSecondary,
                    margin: 0,
                  }}>Covers: {item.facts}</p>
                </a>
              ))}
            </div>

            {/* Grading Rubric */}
            <div style={{
              marginTop: '32px',
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0', color: colors.navy }}>Grading Rubric</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
              }}>
                {[
                  { label: 'Aligns?', desc: 'Y / N / Partial', color: colors.green },
                  { label: 'Contradicts?', desc: 'Y / N — which facts?', color: colors.orange },
                  { label: 'New Info?', desc: 'Y / N', color: colors.blue },
                  { label: 'Quality', desc: '1-5 scale', color: colors.purple },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: '16px',
                    backgroundColor: item.color + '10',
                    borderRadius: '8px',
                    borderTop: `3px solid ${item.color}`,
                  }}>
                    <p style={{ fontWeight: 700, margin: '0 0 6px 0', color: item.color, fontSize: '15px' }}>{item.label}</p>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
