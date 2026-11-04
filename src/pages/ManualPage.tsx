import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ManualDiagrams } from '../components/manual/ManualDiagrams'
import { fetchStreakMilestones } from '../lib/streaks'
import { getGlossaryTerms, getManualSections } from '../content/manual/manualContent'
import type { ManualSection, MetricEntry } from '../content/manual/manualContent'
import type { StreakMilestoneRow } from '../types/database.types'
import './ManualPage.css'

const metricFields: Array<{ label: string; key: keyof Omit<MetricEntry, 'id' | 'title'> }> = [
    { label: 'Definition', key: 'definition' },
    { label: 'Where you see it', key: 'where' },
    { label: 'Goes up when', key: 'goesUp' },
    { label: 'Goes down when', key: 'goesDown' },
    { label: 'Limits', key: 'limits' },
    { label: 'Connects to', key: 'connectsTo' },
    { label: 'Worked example', key: 'example' },
    { label: 'Tip', key: 'tip' },
]

function MetricCard({ entry }: { entry: MetricEntry }) {
    return (
        <article className="manual-metric" id={entry.id}>
            <h3>{entry.title}</h3>
            <dl>
                {metricFields.map(({ label, key }) => (
                    <div className="manual-metric-row" key={key}>
                        <dt>{label}</dt>
                        <dd>{entry[key]}</dd>
                    </div>
                ))}
            </dl>
        </article>
    )
}

function Glossary({ sections }: { sections: ManualSection[] }) {
    const [search, setSearch] = useState('')
    const sectionById = new Map(sections.map((section) => [section.id, section]))
    const terms = useMemo(() => {
        const query = search.trim().toLocaleLowerCase()
        return getGlossaryTerms().filter((entry) =>
            !query
            || entry.term.toLocaleLowerCase().includes(query)
            || entry.definition.toLocaleLowerCase().includes(query),
        )
    }, [search])

    return (
        <div className="manual-glossary">
            <label htmlFor="manual-glossary-search">Search the glossary</label>
            <input
                id="manual-glossary-search"
                type="search"
                value={search}
                placeholder="Search a term or description"
                onChange={(event) => setSearch(event.target.value)}
            />
            {terms.length === 0 ? (
                <p className="manual-empty">No glossary entries match your search.</p>
            ) : (
                <ul className="manual-glossary-list">
                    {terms.map((entry) => {
                        const destination = sectionById.get(entry.section)
                        return (
                            <li key={`${entry.section}-${entry.term}`}>
                                <h3>{entry.term}</h3>
                                <p>{entry.definition}</p>
                                {destination && (
                                    <Link to={`/manual?section=${destination.id}`}>
                                        Read {destination.title}
                                    </Link>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

function SectionContents({ section, milestones, sections }: {
    section: ManualSection
    milestones: StreakMilestoneRow[]
    sections: ManualSection[]
}) {
    return (
        <div className="manual-section-content">
            {section.intro && <p className="manual-intro">{section.intro}</p>}
            {section.diagram && <ManualDiagrams name={section.diagram} milestones={milestones} />}
            {section.notes.length > 0 && (
                <div className="manual-notes">
                    {section.notes.map((note) => (
                        <article key={note.title}>
                            <h3>{note.title}</h3>
                            <p>{note.text}</p>
                        </article>
                    ))}
                </div>
            )}
            {section.metrics && (
                <div className="manual-metrics">
                    {section.metrics.map((entry) => <MetricCard key={entry.id} entry={entry} />)}
                </div>
            )}
            {section.id === 'glossary' && <Glossary sections={sections} />}
        </div>
    )
}

export function ManualPage() {
    const [milestones, setMilestones] = useState<StreakMilestoneRow[]>([])
    const [milestoneError, setMilestoneError] = useState('')
    const [searchParams, setSearchParams] = useSearchParams()
    const selectedSection = searchParams.get('section')
    const sections = useMemo(() => getManualSections(milestones), [milestones])
    const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['welcome']))

    useEffect(() => {
        let active = true
        async function loadMilestones() {
            const result = await fetchStreakMilestones()
            if (!active) return
            if (result.error) {
                setMilestoneError(`Milestones could not be loaded: ${result.error.message}`)
                return
            }
            setMilestones(result.data ?? [])
            setMilestoneError('')
        }
        void loadMilestones()
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (!selectedSection || !sections.some((section) => section.id === selectedSection)) return
        window.requestAnimationFrame(() => {
            document.getElementById(`manual-${selectedSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [selectedSection, sections])

    function toggleSection(section: string, open: boolean) {
        setOpenSections((current) => {
            const next = new Set(current)
            if (open) next.add(section)
            else next.delete(section)
            return next
        })
        if (!open && selectedSection === section) setSearchParams({})
    }

    return (
        <section className="screen-page manual-page" aria-labelledby="manual-title">
            <header className="manual-header">
                <p className="eyebrow">PLAYER GUIDE</p>
                <h1 id="manual-title">Player Manual</h1>
                <p>Learn how to use Levelup, what each number means, and what your choices actually change.</p>
            </header>

            {milestoneError && <p className="manual-error" role="alert">{milestoneError}</p>}
            <div className="manual-sections">
                {sections.map((section) => (
                    <details
                        className="manual-section"
                        id={`manual-${section.id}`}
                        key={section.id}
                        open={openSections.has(section.id) || selectedSection === section.id}
                        onToggle={(event) => toggleSection(section.id, event.currentTarget.open)}
                    >
                        <summary>
                            <span>{section.title}</span>
                            <span className="manual-toggle" aria-hidden="true" />
                        </summary>
                        <SectionContents section={section} milestones={milestones} sections={sections} />
                    </details>
                ))}
            </div>
        </section>
    )
}
