import { useCallback } from 'react'
import { getStudentRoadmap } from '../shared/api/planning'
import { ApiClientError } from '../shared/api/client'
import { useLoad } from '../shared/hooks/useLoad'
import type { PageProps } from '../shared/api/types'
import { ErrorNotice } from '../components/Feedback'
import { EligibilityDetails } from '../components/SectionDetails'
import './Roadmap.css'

export default function Roadmap({ onNavigate }: PageProps) {
  const { data, error, loading, reload } = useLoad(useCallback((signal: AbortSignal) => getStudentRoadmap(signal), []))
  const terms = [...new Set(data?.courses.map(c => c.term_order))]
  return <section className="roadmap-page">
    <div className="page-heading"><h1>Your degree roadmap</h1><button disabled={loading} onClick={reload}>Refresh roadmap</button></div>
    <ErrorNotice error={error} />{error instanceof ApiClientError && error.code === 'PROFILE_INCOMPLETE' && <button className="primary" onClick={() => onNavigate?.('Dashboard')}>Choose a major on Dashboard</button>}
    {loading && <p role="status">Loading your roadmap…</p>}
    {data && <>
      <section className="progress-summary"><h2>{data.major.title} {data.major.degree_type}</h2>
        <div className="progress-label"><strong>{data.summary.completed_courses} of {data.summary.total_required_courses} required courses earned</strong><span>{data.summary.completion_percent.toFixed(0)}%</span></div>
        <progress aria-label="Required course credit" max="100" value={data.summary.completion_percent} />
      </section>
      <section className="recommendations">
        <h2>Ready to consider next</h2>
        {data.recommendations.length ? (
          <ul className="recommendation-chips">
            {data.recommendations.map(id => {
              const course = data.courses.find(c => c.course.id === id)?.course
              return (
                <li key={id}>
                  <a href={`#course-${id}`}>
                    <strong>{id}</strong>
                    <span>{course?.title ?? ''}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty">No eligible courses to recommend yet.</p>
        )}
      </section>
      {!data.courses.length && <p className="empty">No catalog courses loaded.</p>}
      <div className="semester-list">{terms.map(term => <section className="semester" key={term}><h2>Semester {term}</h2><div>{data.courses.filter(c => c.term_order === term).map(c => <article className="roadmap-course" id={`course-${c.course.id}`} key={c.course.id}>
        <div className="section-heading"><h3>{c.course.id}</h3><span className="status">{c.student_status.replaceAll('_', ' ')}{c.grade ? ` · ${c.grade}` : ''}</span></div><p>{c.course.title}</p><p className="help">{c.is_required ? 'Required' : 'Optional'} · {c.course.units_min ?? 'Unknown'} units</p><EligibilityDetails value={c.eligibility} />
      </article>)}</div></section>)}</div>
    </>}
  </section>
}
