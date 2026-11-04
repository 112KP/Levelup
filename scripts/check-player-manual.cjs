const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8')
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
        },
        fileName: filename,
    }).outputText
    module._compile(compiled, filename)
}

const root = path.resolve(__dirname, '..')
const { GAME_RULES, getXpNeededAtLevel, getVitalCeilingIncrease } = require(path.join(root, 'src/lib/gameRules.ts'))
const { getGlossaryTerms, getManualSections } = require(path.join(root, 'src/content/manual/manualContent.ts'))
const milestones = [
    { days: 7, points: 7 },
    { days: 12, points: 12 },
    { days: 15, points: 15 },
    { days: 18, points: 18 },
    { days: 21, points: 21 },
    { days: 33, points: 33 },
    { days: 45, points: 45 },
    { days: 60, points: 60 },
    { days: 84, points: 84 },
    { days: 90, points: 90 },
    { days: 108, points: 108 },
    { days: 112, points: 112 },
]
const sections = getManualSections(milestones)
const sectionIds = new Set(sections.map(({ id }) => id))
const glossary = getGlossaryTerms()

assert.ok(!sectionIds.has('abilities'), 'The standalone Abilities section should not appear in the manual')
assert.ok(glossary.length > 0, 'Glossary should contain terms')
assert.equal(
    new Set(glossary.map(({ section, term }) => `${section}:${term.toLocaleLowerCase()}`)).size,
    glossary.length,
    'Glossary terms should not be duplicated',
)
for (const term of glossary) {
    assert.ok(sectionIds.has(term.section), `Glossary term "${term.term}" links to a missing section "${term.section}"`)
}

const metricFields = ['definition', 'where', 'goesUp', 'goesDown', 'limits', 'connectsTo', 'example', 'tip']
for (const section of sections) {
    for (const entry of section.metrics ?? []) {
        for (const field of metricFields) {
            assert.equal(typeof entry[field], 'string', `${entry.title} is missing ${field}`)
            assert.ok(entry[field].trim(), `${entry.title} has an empty ${field}`)
        }
    }
}

const playerContent = [
    ...sections.flatMap((section) => [
        section.title,
        section.intro,
        ...section.notes.flatMap(({ title, text }) => [title, text]),
        ...(section.metrics ?? []).flatMap((entry) => [entry.title, ...metricFields.map((field) => entry[field])]),
    ]),
    ...glossary.flatMap(({ term, definition }) => [term, definition]),
].join('\n')
assert.doesNotMatch(playerContent, /(?:hp_current|mp_current|p_log_id|quest_logs|ability_streaks|streak_milestones|rpc|sql function)/i)
assert.doesNotMatch(playerContent, /\b[a-z]+_[a-z]+\b/i, 'Player-facing content must not contain internal identifiers')

function collectNumbers(value, numbers = new Set()) {
    if (typeof value === 'number') numbers.add(value)
    else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, numbers))
    else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectNumbers(item, numbers))
    return numbers
}

const configuredNumbers = collectNumbers(GAME_RULES)
milestones.forEach(({ days, points }) => {
    configuredNumbers.add(days)
    configuredNumbers.add(points)
})
configuredNumbers.add(getXpNeededAtLevel(GAME_RULES.progression.startingLevel + 1))
configuredNumbers.add(getVitalCeilingIncrease(2))
configuredNumbers.add(getVitalCeilingIncrease(4))
for (const match of playerContent.matchAll(/\d+(?:\.\d+)?/g)) {
    assert.ok(configuredNumbers.has(Number(match[0])), `Manual number ${match[0]} does not come from shared rules or milestone configuration`)
}

const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
assert.match(appSource, /<Route path="\/manual" element={<ManualPage \/>} \/>/)
assert.match(appSource, /<HashRouter>/)
assert.match(appSource, /to: '\/manual', label: 'Player Manual'/)
const manualPageSource = fs.readFileSync(path.join(root, 'src/pages/ManualPage.tsx'), 'utf8')
assert.match(manualPageSource, /searchParams\.get\('section'\)/)
assert.match(manualPageSource, /to=\{`\/manual\?section=\$\{destination\.id\}`\}/)
const streakSource = fs.readFileSync(path.join(root, 'src/lib/streaks.ts'), 'utf8')
assert.match(streakSource, /from\('streak_milestones'\)/)
assert.match(streakSource, /select\('days, points'\)/)

console.log(`Player manual checks passed: ${glossary.length} glossary terms, ${sections.reduce((count, section) => count + (section.metrics?.length ?? 0), 0)} complete metric entries.`)
