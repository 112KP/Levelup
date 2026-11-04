import type { StreakMilestoneRow } from '../../types/database.types'
import { getAbilityLabel } from '../../lib/abilities'
import { GAME_RULES, getRankForLevel, getVitalCeilingIncrease, getXpFormulaLabel, getXpNeededAtLevel } from '../../lib/gameRules'

export type MetricEntry = {
    id: string
    title: string
    definition: string
    where: string
    goesUp: string
    goesDown: string
    limits: string
    connectsTo: string
    example: string
    tip: string
}

export type ManualSection = {
    id: string
    title: string
    intro: string
    notes: Array<{ title: string; text: string }>
    metrics?: MetricEntry[]
    diagram?: 'big-picture' | 'streak-timeline' | 'shield-decision' | 'vital-bar' | 'ability-map'
}

const xpFormula = getXpFormulaLabel()
const firstLevelThreshold = GAME_RULES.progression.rankThresholds.at(-1)?.level ?? GAME_RULES.progression.startingLevel
const rankThresholdText = [...GAME_RULES.progression.rankThresholds]
    .reverse()
    .map(({ rank, level }) => `${rank} at ${level}`)
    .join(', ')
const nextLevel = GAME_RULES.progression.startingLevel + 1
const nextLevelXp = getXpNeededAtLevel(nextLevel)
const exampleXpReward = GAME_RULES.progression.startingXpToNext + GAME_RULES.progression.exampleRewardBonus
const rankTen = GAME_RULES.progression.rankThresholds.find(({ rank }) => rank === 'D')
const vitalityIncrease = getVitalCeilingIncrease(1)
const maxItemEffect = GAME_RULES.itemEffects.maximum
const minItemEffect = GAME_RULES.itemEffects.minimum

function metric(
    id: string,
    title: string,
    definition: string,
    where: string,
    goesUp: string,
    goesDown: string,
    limits: string,
    connectsTo: string,
    example: string,
    tip: string,
): MetricEntry {
    return { id, title, definition, where, goesUp, goesDown, limits, connectsTo, example, tip }
}

function getAbilityMetrics() {
    const abilities = [
        {
            name: 'Strength',
            ceiling: 'Body and Mind',
            example: `One ${getAbilityLabel('strength')} point raises both the Body and Mind ceilings by ${vitalityIncrease}.`,
        },
        {
            name: 'Agility',
            ceiling: 'Body and Mind',
            example: `One ${getAbilityLabel('agility')} point raises both the Body and Mind ceilings by ${vitalityIncrease}.`,
        },
        {
            name: 'Sense',
            ceiling: 'Emotion',
            example: `One ${getAbilityLabel('sense')} point raises the Emotion ceiling by ${vitalityIncrease}.`,
        },
        {
            name: 'Vitality',
            ceiling: 'Energy',
            example: `One ${getAbilityLabel('vitality')} point raises the Energy ceiling by ${vitalityIncrease}.`,
        },
        {
            name: 'Intelligence',
            ceiling: 'Mind',
            example: `One ${getAbilityLabel('intelligence')} point raises the Mind ceiling by ${vitalityIncrease}.`,
        },
        {
            name: 'Career',
            ceiling: 'Mind',
            example: `One ${getAbilityLabel('career')} point raises the Mind ceiling by ${vitalityIncrease}.`,
        },
    ] as const

    return abilities.map(({ name, ceiling, example }) => metric(
        `ability-${name.toLowerCase()}`,
        name,
        `${name} is one of your six abilities. It also helps set your ${ceiling} ceiling.`,
        'Profile, in the Attributes area.',
        `A streak milestone tagged to ${name} adds its milestone points directly to ${name}. A point can also be allocated from an available balance.`,
        'The normal game rules do not decrease abilities. Resetting progress returns abilities to their starting values.',
        `Starts at ${GAME_RULES.abilities.startingValue}. No upper limit is defined in the current rules.`,
        `${ceiling} ceiling. Ability points increase a ceiling; they do not refill the current vital.`,
        example,
        `Tag quests with ${name} when you want them to count toward the ${name} streak.`,
    ))
}

function getStreakMetrics(milestones: StreakMilestoneRow[]) {
    const firstMilestone = milestones[0]
    const milestoneExample = firstMilestone
        ? `At the ${firstMilestone.days}-day milestone, you receive ${firstMilestone.points} points for that ability.`
        : 'Milestone rewards are loaded from the game configuration.'
    const milestoneList = milestones.length
        ? milestones.map(({ days, points }) => `${days} days: ${points} points`).join('; ')
        : 'Milestones are unavailable until the milestone list loads.'

    return [
        metric(
            'ability-streak',
            'Ability streak',
            'A count of consecutive player-local days with at least one completed quest tagged to that ability.',
            'Under each ability on your Profile.',
            'Complete any quest tagged to that ability on a day when it has not yet received a hit.',
            'After a missed day, the next streak refresh returns the count to the last milestone already paid. It returns to zero if none was paid.',
            'No maximum streak length is defined. One or more matching completions in a day count as one hit.',
            'A hit advances that ability toward its next configured milestone. One quest can count for several tagged abilities.',
            'If you complete two Strength-tagged quests today, the Strength streak increases by one day, not two.',
            'A skipped quest does not itself break a streak. What matters is whether the day ends without any completed quest tagged to that ability.',
        ),
        metric(
            'streak-milestone',
            'Streak milestone',
            'A configured streak length that pays ability points once for that ability.',
            'Next milestone under each ability, and as a notice after a qualifying completion.',
            'Reach the next configured milestone with an eligible quest completion.',
            'The already paid milestone is not taken back after a miss. Your current streak falls back to it.',
            `The current configured milestones are: ${milestoneList}.`,
            'Milestone points go directly to the matching ability and raise its related vital ceiling.',
            milestoneExample,
            'Milestones differ in size. Check the “Next” value under each ability to see what is coming.',
        ),
        metric(
            'ability-points',
            'Points ready to allocate',
            'An older, separate balance of ability points that you can spend with the plus buttons.',
            'A banner on Profile when the balance is greater than zero.',
            'No current gameplay action adds to this balance. Streak milestones go straight to an ability instead.',
            'Each allocation spends the selected number of available points.',
            'The balance cannot go below zero. One plus-button press spends one point.',
            'Spending raises an ability and can raise its related vital ceiling. It does not refill current vitals.',
            `If you have one available point, using a plus button spends ${GAME_RULES.abilities.baseAllocationCost} point and increases one ability by ${GAME_RULES.abilities.baseAllocationCost}.`,
            'If the banner is not visible, you have no points to allocate. Continue ability streaks to earn milestone points directly.',
        ),
    ]
}

function getVitalMetrics() {
    const { startingCeiling, ceilingPerAbilityPoint, fatigueMinimum, fatigueMaximum } = GAME_RULES.vitals
    const bodyGain = getVitalCeilingIncrease(2)
    const mindGain = getVitalCeilingIncrease(4)
    const names = ['Body', 'Mind', 'Emotion', 'Energy'] as const
    const definitions: Record<typeof names[number], { ceiling: string; sources: string }> = {
        Body: {
            ceiling: `Strength and Agility above ${GAME_RULES.abilities.startingValue}.`,
            sources: 'Quest rewards, skipped-quest penalties, consumable effects, and dungeon-clear effects.',
        },
        Mind: {
            ceiling: `Strength, Agility, Intelligence, and Career above ${GAME_RULES.abilities.startingValue}.`,
            sources: 'Quest rewards, skipped-quest penalties, consumable effects, and dungeon-clear effects.',
        },
        Emotion: {
            ceiling: `Sense above ${GAME_RULES.abilities.startingValue}.`,
            sources: 'Quest rewards, skipped-quest penalties, consumable effects, and dungeon-clear effects.',
        },
        Energy: {
            ceiling: `Vitality above ${GAME_RULES.abilities.startingValue}.`,
            sources: 'Quest rewards, skipped-quest penalties, consumable effects, and dungeon-clear effects.',
        },
    }

    const metrics = names.map((name) => {
        const { ceiling, sources } = definitions[name]
        const formula = name === 'Body'
            ? `${startingCeiling} + ${ceilingPerAbilityPoint} × (Strength − ${GAME_RULES.abilities.startingValue}) + ${ceilingPerAbilityPoint} × (Agility − ${GAME_RULES.abilities.startingValue})`
            : name === 'Mind'
                ? `${startingCeiling} + ${ceilingPerAbilityPoint} × (Strength − ${GAME_RULES.abilities.startingValue}) + ${ceilingPerAbilityPoint} × (Agility − ${GAME_RULES.abilities.startingValue}) + ${ceilingPerAbilityPoint} × (Intelligence − ${GAME_RULES.abilities.startingValue}) + ${ceilingPerAbilityPoint} × (Career − ${GAME_RULES.abilities.startingValue})`
                : `${startingCeiling} + ${ceilingPerAbilityPoint} × (${name === 'Emotion' ? 'Sense' : 'Vitality'} − ${GAME_RULES.abilities.startingValue})`
        const example = name === 'Body'
            ? `At the starting ability values, Body is ${startingCeiling} / ${startingCeiling}. One Strength and one Agility point raise its ceiling by ${bodyGain}, but do not change the current value.`
            : name === 'Mind'
                ? `At the starting ability values, Mind is ${startingCeiling} / ${startingCeiling}. One point in each of Strength, Agility, Intelligence, and Career raises its ceiling by ${mindGain}, but does not refill Mind.`
                : `At the starting ability values, ${name} is ${startingCeiling} / ${startingCeiling}. One point in ${name === 'Emotion' ? 'Sense' : 'Vitality'} raises its ceiling by ${ceilingPerAbilityPoint}, but does not refill the current value.`
        return metric(
            `vital-${name.toLowerCase()}`,
            name,
            `${name} is a current vital with a separate ceiling. Your bar shows current value / ceiling.`,
            'Profile, in the Vitals area. Effect amounts also appear on quests, items, and dungeon clears.',
            `${sources} Current value stops at the ceiling.`,
            `Skipped-quest penalties, consumable effects, and dungeon-clear effects can reduce it. Current value never falls below zero.`,
            `Current value is clamped from zero to the ceiling. Ceiling = ${formula}. It uses ${ceiling}.`,
            'Related abilities determine only the ceiling. XP and levels do not restore current vitals.',
            example,
            'A larger ceiling is extra capacity, not a refill. Use an effect that restores this vital to fill the bar.',
        )
    })

    metrics.push(metric(
        'fatigue',
        'Fatigue',
        'A separate measure shown as current fatigue out of its maximum.',
        'Profile, in the Vitals area. Quest and item forms also show fatigue effects.',
        'A consumable or dungeon-clear effect can raise it.',
        'Quest completion can restore fatigue. Consumable and dungeon effects can also lower it.',
        `Clamped from ${fatigueMinimum} to ${fatigueMaximum}. The bar color changes at ${GAME_RULES.vitals.fatigueColorThresholds.medium} and ${GAME_RULES.vitals.fatigueColorThresholds.high}; these colors are visual cues only. It does not use an ability ceiling.`,
        'Fatigue is independent of Body, Mind, Emotion, and Energy. The current UI does not show a gameplay penalty tied to fatigue.',
        `At ${fatigueMaximum} fatigue, a restore of ${fatigueMaximum} would bring it to ${fatigueMinimum}.`,
        'Read the configured fatigue effect before using an item or clearing a dungeon.',
    ))
    return metrics
}

function getTitleMetrics() {
    const levelTitles = GAME_RULES.titles.levelUnlocks.map(({ name, level, bonus }) => {
        const bonusText = bonus ? ` It stores a ${bonus.ability} bonus of ${bonus.amount}.` : ''
        return `${name} unlocks at level ${level}.${bonusText}`
    }).join(' ')
    const streakTitle = GAME_RULES.titles.streakUnlock

    return [
        metric(
            'title',
            'Title',
            'A title is an unlockable name you can equip to show on your Profile.',
            'The active title appears below your name on Profile. Manage unlocked titles on the Titles page.',
            'The game checks for level titles when rewards are applied. Use “Check for new titles” to recheck unlocks.',
            'You can unequip the active title. This does not remove an unlocked title.',
            'Only one title can be active at a time. A title’s displayed bonus is not applied to gameplay.',
            'Titles reflect progression and change the displayed profile title only.',
            `${levelTitles} ${streakTitle.name} unlocks after ${streakTitle.days} consecutive quest-completion days.`,
            'Choose a title for display. Do not rely on its listed bonus to change your abilities.',
        ),
        metric(
            'title-bonus',
            'Title bonus',
            'A bonus ability and amount stored as title information.',
            'On each title card, under Bonus.',
            'The configured title records can display a bonus when unlocked.',
            'No game action applies or removes the bonus from your abilities.',
            'The displayed number is metadata only in the current implementation.',
            'It does not change ability values, vital ceilings, or rewards.',
            'Equipping a title with a displayed bonus leaves the ability value unchanged.',
            'Treat this as “for reference only.”',
        ),
    ]
}

export function getManualSections(milestones: StreakMilestoneRow[]): ManualSection[] {
    const progressionMetrics = [
        metric(
            'level',
            'Level',
            'Your overall progression level.',
            'Profile, beside the Experience bar.',
            'Earn XP from completed quests and cleared dungeons. A large reward can raise multiple levels.',
            'Normal rewards do not lower your level. Resetting progress returns it to its starting level.',
            `Starts at ${GAME_RULES.progression.startingLevel}. No upper limit is defined.`,
            'Level determines your Rank and can unlock titles.',
            `At level ${GAME_RULES.progression.startingLevel}, the next level needs ${GAME_RULES.progression.startingXpToNext} XP. A reward of ${exampleXpReward} XP would leave ${GAME_RULES.progression.exampleRewardBonus} XP toward level ${nextLevel}, which needs ${nextLevelXp} XP.`,
            'Your XP bar shows progress toward the next level, not total XP earned over your account.',
        ),
        metric(
            'xp',
            'XP',
            'Experience points that move you toward your next level.',
            'Profile’s Experience bar and quest or dungeon reward summaries.',
            'Complete a quest or clear a dungeon with an XP reward.',
            'At level-up, the required XP is subtracted from the displayed amount. The remainder carries forward.',
            `Starts at ${GAME_RULES.progression.startingXp}; the next threshold follows ${xpFormula}.`,
            'XP raises Level, which can change Rank and unlock titles. XP does not refill vitals.',
            `A reward of ${exampleXpReward} XP at level ${GAME_RULES.progression.startingLevel} reaches level ${nextLevel} and leaves ${GAME_RULES.progression.exampleRewardBonus} / ${nextLevelXp} XP toward the following level.`,
            'A bar that is not full after leveling is expected: it now shows progress toward the new threshold.',
        ),
        metric(
            'rank',
            'Rank',
            'A letter showing your progression band.',
            'Profile badge and dungeon cards.',
            'Your profile rank rises automatically when your level crosses a rank threshold.',
            'It does not decrease except when you reset progress.',
            `Profile thresholds: E below ${firstLevelThreshold}; ${rankThresholdText}. Dungeon rank is selected separately.`,
            'Profile rank follows Level. Dungeon rank is a label and does not change game mechanics.',
            `Reaching level ${rankTen?.level ?? firstLevelThreshold} gives profile Rank ${getRankForLevel(rankTen?.level ?? firstLevelThreshold)}.`,
            'Dungeon rank is for organizing your goal; it does not multiply its reward.',
        ),
        metric(
            'gold',
            'Gold',
            'Your Gold balance.',
            'Profile footer and quest/dungeon reward summaries.',
            'Quest completion and dungeon clears add configured gold. A consumable can also add gold.',
            'Skipped quests can apply a gold penalty. A consumable effect can reduce gold.',
            `Gold cannot go below ${GAME_RULES.gold.minimum}. No upper limit is defined.`,
            'Gold is recorded as a balance. No purchase flow is currently present.',
            `If you have ${GAME_RULES.gold.exampleStartingBalance} gold and a skip penalty of ${GAME_RULES.gold.examplePenalty}, your balance becomes ${GAME_RULES.gold.minimum}, not a negative amount.`,
            'Check a quest’s “On skip” text before you decide to skip it.',
        ),
    ]

    const abilityMetrics = getAbilityMetrics()
    const streakMetrics = getStreakMetrics(milestones)
    const vitalMetrics = getVitalMetrics()
    const titleMetrics = getTitleMetrics()
    const milestoneList = milestones.length
        ? milestones.map(({ days, points }) => `${days} days → ${points} points`).join(', ')
        : 'The configured milestones load from the game.'
    const titleUnlockList = GAME_RULES.titles.levelUnlocks
        .map(({ name, level }) => `${name} at level ${level}`)
        .join('; ')
    const streakTitle = GAME_RULES.titles.streakUnlock

    return [
        {
            id: 'welcome',
            title: 'Welcome and the big picture',
            intro: 'Levelup turns your real work into a simple loop. Set up quests that matter, complete them, and use your status screen to understand what changed.',
            notes: [
                { title: 'The loop', text: 'Quests award XP and gold. XP moves your level and rank. Ability tags connect completed quests to separate streaks. Milestones add points directly to abilities. Abilities raise vital ceilings. Quest effects, consumables, and dungeon clears can change current vitals.' },
                { title: 'Use the app honestly', text: 'Some fields are for organization only. Difficulty, target, unit, dungeon rank, skill details, and title bonuses do not add hidden effects. This guide calls those out where they appear.' },
            ],
            diagram: 'big-picture',
        },
        {
            id: 'day',
            title: 'A day in the game',
            intro: 'Start on Home. Your daily quests are listed for your current game day.',
            notes: [
                { title: 'Make a quest useful', text: 'Give it a clear name, choose one or more ability tags, and set a reward that reflects what you want to reinforce. Difficulty and goal text help you organize the task, but do not change its reward.' },
                { title: 'Complete or skip', text: 'Complete a quest to receive its configured XP, gold, vital effects, fatigue restoration, and ability streak credit. Skip applies any configured vital or gold penalties. A completed or skipped quest cannot be resolved again.' },
                { title: 'Check the result', text: 'Read the toast and your Profile. The XP bar may have rolled over to the next level; vital bars may stop at their ceilings; streaks update by tagged ability.' },
            ],
        },
        {
            id: 'character',
            title: 'Your character: Level, XP, Rank, Gold, and Title',
            intro: 'Your Profile is the best place to see progression and current status together.',
            notes: [
                { title: 'Progression', text: `Each next XP target follows ${xpFormula}. At level-up, the app subtracts the old target and keeps the remainder. Rank thresholds are loaded from shared game rules.` },
                { title: 'Titles', text: `Current automatic unlocks: ${titleUnlockList}. ${streakTitle.name} unlocks after ${streakTitle.days} consecutive quest-completion days. A title can be equipped for display.` },
            ],
            metrics: progressionMetrics,
        },
        {
            id: 'abilities',
            title: 'Abilities',
            intro: 'Abilities are Strength, Agility, Sense, Vitality, Intelligence, and Career. Tag quests carefully: tags choose which streaks can advance.',
            notes: [
                { title: 'How points arrive', text: 'A streak milestone awards its points directly to the matching ability. The separate “Points ready to allocate” balance only appears if it is already positive; you can spend that balance with the plus buttons.' },
                { title: 'What abilities do', text: 'Abilities raise vital ceilings only. They do not refill current vitals, and leveling up does not change them by itself.' },
            ],
            metrics: abilityMetrics,
        },
        {
            id: 'streaks',
            title: 'Streaks and milestones',
            intro: 'Each ability has its own streak. One completed quest can count for every ability tag on that quest, but each ability can receive only one hit per day.',
            notes: [
                { title: 'Milestone schedule', text: milestoneList },
                { title: 'A miss and the fallback', text: 'When an ability has a missed day, its current count falls back to the last milestone already paid. The milestone reward stays yours. A day is not considered missed until it has ended in your game time zone.' },
            ],
            metrics: streakMetrics,
            diagram: 'streak-timeline',
        },
        {
            id: 'shields',
            title: 'Shields',
            intro: 'There is no shield mechanic in the current app.',
            notes: [
                { title: 'No shield pool', text: 'The current Profile does not show shields. No level-up grants shields, and no daily shield decision protects streaks. If a day ends without a hit for an ability, that ability falls back to its last paid milestone.' },
            ],
            metrics: [
                metric(
                    'shield',
                    'Shield',
                    'A shield is not an implemented player resource in the current app.',
                    'Nowhere in the active app.',
                    'Nothing awards shields.',
                    'Nothing spends shields.',
                    'No shield counter, cap, or state exists.',
                    'A missed ability day falls back to the last paid milestone without shield protection.',
                    'If a day has no tagged quest completion, the streak fallback still happens; no shield is consumed.',
                    'Do not plan around a shield mechanic. It is not available.',
                ),
            ],
            diagram: 'shield-decision',
        },
        {
            id: 'vitals',
            title: 'Vitals: Body, Mind, Emotion, Energy, and Fatigue',
            intro: 'The first four bars show current value against a ceiling. Fatigue is separate.',
            notes: [
                { title: 'Ceilings', text: `Vitals start with a ceiling of ${GAME_RULES.vitals.startingCeiling}. Ability points raise the related ceiling by ${GAME_RULES.vitals.ceilingPerAbilityPoint} per point, but do not raise the current value. When a ceiling changes, the current value is only clamped down if it is now above that ceiling.` },
                { title: 'Effects', text: 'Quest completion can restore vitals and reduce fatigue. Skipping can reduce vitals and gold. Consumable and dungeon effects can raise or lower vitals and fatigue within their limits.' },
            ],
            metrics: vitalMetrics,
            diagram: 'vital-bar',
        },
        {
            id: 'quests',
            title: 'Quests',
            intro: 'Quests are the main way you record daily action. Their tags, recurrence, rewards, and penalties control what completion does.',
            notes: [
                { title: 'Types', text: 'Daily quests are generated for the day. Weekly and One-time quests can be added to today from the Add quest button. There is no on-demand type, and weekly quests do not follow a separate weekly schedule.' },
                { title: 'Difficulty, target, and unit', text: 'Easy, Medium, and Hard are labels only. Target and Unit are for reference only; they do not affect rewards or completion. Quests are completed with a single action.' },
                { title: 'Ability tags', text: 'Choose at least one ability for each managed quest. On completion, the quest credits each tagged ability at most once that day. No tag means no streak credit.' },
                { title: 'Skip', text: 'Skip resolves the quest as Skipped and immediately applies its configured vital and gold penalties. Skipping one quest does not itself break a streak if you complete another quest tagged to that ability before the day ends.' },
                { title: 'Add quest and repeats', text: 'You can add a weekly or one-time quest once on a given day. The app will not add another copy of that quest for the same day. There is no repeat-until-20 behavior or remove-extra-copy action.' },
                { title: 'Rewards', text: 'Every completion pays the configured XP and gold and applies configured vital rewards and fatigue restoration. Current vitals stop at their ceiling.' },
            ],
            metrics: [
                metric('quest-difficulty', 'Quest difficulty', 'An Easy, Medium, or Hard label you choose for organization.', 'Quest cards and quest setup.', 'You can change the label when editing the quest.', 'You can change it back when editing.', 'Only the three labels are available.', 'It does not change XP, gold, vitals, or streak credit.', 'An Easy and a Hard quest with the same configured rewards pay the same rewards.', 'Use difficulty to sort or communicate effort, not to predict rewards.'),
                metric('quest-name', 'Quest name', 'The short name shown on the quest card.', 'Home and Manage quests.', 'Create a quest or edit its name.', 'Edit it to a different name.', `The name can be up to ${GAME_RULES.quests.nameMaxLength} characters.`, 'It identifies the quest in notices and history; the name itself does not change rewards.', 'Changing a quest name does not change its XP reward.', 'Use a short action phrase that is easy to recognize.'),
                metric('quest-target', 'Target and Unit', 'Reference text for the goal you want to complete.', 'Quest card and quest setup.', 'You can edit the target or unit in the quest form.', 'You can edit them again.', 'Target is saved as a positive value. There is no progress-tracking action on the current board.', 'They do not change rewards or completion checks.', 'A target of 10 pages does not award more XP than a target of 1 page unless you also change the reward.', 'Use the description to clarify what counts as complete.'),
                metric('quest-type', 'Quest type', 'A recurrence setting: Daily, Weekly, or One-time.', 'Quest setup and quest cards.', 'You can select a recurrence when creating or editing a quest.', 'You can change it when editing.', 'Daily quests generate each day. Weekly and One-time quests can be manually added once per day. There is no On-demand option.', 'Recurrence determines how a quest gets onto the board, not its reward size.', 'A Weekly quest does not appear every seven days automatically; add it from Home when you want to do it.', 'Use Daily for repeated board entries; use Weekly or One-time for quests you choose to add.'),
            ],
        },
        {
            id: 'dungeons',
            title: 'Dungeons',
            intro: 'A dungeon is a larger goal with optional deadline and configured completion rewards.',
            notes: [
                { title: 'Status', text: 'A new dungeon is Open. Start moves it to In progress. Abandon moves an open or in-progress dungeon to Failed. Clear is available only while it is in progress. Clearing pays configured rewards once.' },
                { title: 'Rank and deadline', text: 'Dungeon rank is a planning label and does not affect its rewards. A deadline shows days remaining or Overdue; being overdue does not automatically fail the dungeon.' },
            ],
            metrics: [
                metric('dungeon-rank', 'Dungeon rank', 'A letter label you choose for a dungeon.', 'Dungeon card and setup form.', 'You can change it while editing.', 'You can change it while editing.', `Available labels: ${GAME_RULES.dungeons.ranks.join(', ')}.`, 'It does not affect rewards or status changes.', 'An E-rank dungeon and an S-rank dungeon with the same configured rewards pay the same amount.', 'Use this as a planning label only.'),
                metric('dungeon-status', 'Dungeon status', 'The current stage of a dungeon: Open, In progress, Cleared, or Failed.', 'Dungeon manager and active-dungeon strip on Home.', 'Start changes Open to In progress. Clear changes In progress to Cleared.', 'Abandon changes Open or In progress to Failed. Status does not automatically change after the deadline.', 'Clear is enabled only while in progress. A cleared dungeon cannot pay again.', 'Status controls available actions; Clear pays configured XP, gold, and effects.', 'Starting makes Clear available; clearing resolves the reward one time.', 'Set a status using the available actions; it is not editable as plain text.'),
                metric('dungeon-deadline', 'Dungeon deadline', 'A date used to display time remaining or Overdue.', 'Dungeon card and setup form.', 'You can set or change the date in the dungeon editor.', 'You can clear the date in the editor.', `No deadline is also allowed. Dungeon names can be up to ${GAME_RULES.dungeons.nameMaxLength} characters. The date does not automatically fail a dungeon.`, 'It is a reminder, not an automatic penalty or reward.', 'An overdue dungeon stays open or in progress until you change its status.', 'Use the deadline as a planning prompt, not a game timer.'),
            ],
        },
        {
            id: 'inventory',
            title: 'Inventory and items',
            intro: 'Inventory stores items you create. The current app does not award items through quests or dungeon clears.',
            notes: [
                { title: 'Consumables', text: `Only Consumable items can be used. Using one consumes a quantity and applies its configured effects. Each effect is limited to ${minItemEffect} through ${maxItemEffect}; current values are clamped to their valid ranges.` },
                { title: 'Equipment and materials', text: 'Equipment can be marked Equipped, but its displayed effect is not applied to your stats. Materials cannot be used and have no applied effect.' },
                { title: 'Rarity', text: 'Common, Rare, Epic, and Legendary are display categories. Rarity does not change an item effect.' },
            ],
            metrics: [
                metric('item-type', 'Item type', 'An item category: Equipment, Consumable, or Material.', 'Inventory filters, item cards, and the item form.', 'Choose the category when creating or editing an item.', 'Change the category in the editor.', 'Only Consumable items have an active use action.', 'Consumables apply effects and reduce quantity. Equipment and Material do not apply effects.', 'Using a Consumable reduces its quantity by one; equipping Equipment does not apply its listed stat effect.', 'Use Consumables for effects. Treat Equipment and Material as reference records.'),
                metric('item-effect', 'Item effect', 'A configured change to a vital, Fatigue, or Gold.', 'Item effect summary and Effect Builder.', 'A Consumable applies the configured effect when used.', 'Negative effects lower the relevant current value or balance.', `Each effect is clamped from ${minItemEffect} to ${maxItemEffect}. Vitals, Fatigue, and Gold also use their own floors and ceilings.`, 'Consumable effects can change current vitals, Fatigue, and Gold. Equipment’s listed effects are not applied.', `A Consumable effect above ${maxItemEffect} is capped at ${maxItemEffect} before the current vital or balance is clamped.`, 'Read the summary before use. A positive effect cannot raise a vital above its ceiling.'),
                metric('item-quantity', 'Quantity', 'How many copies of an item are recorded.', 'Inventory table.', 'You can set the quantity while creating or editing an item.', 'Using a Consumable reduces quantity by one.', 'Quantity cannot be negative. Use is disabled at zero.', 'A Consumable needs at least one quantity to be used.', `Using one item from a quantity of ${GAME_RULES.examples.itemQuantity} leaves ${GAME_RULES.examples.itemQuantity - 1}.`, 'Check the quantity before selecting Use.'),
                metric('item-rarity', 'Rarity', 'A category shown as Common, Rare, Epic, or Legendary.', 'Inventory item form and table.', 'You can select it when creating or editing an item.', 'You can select a different rarity when editing.', 'Four labels are available.', 'Rarity is display-only and does not affect item effects.', 'A Legendary item with no effect still has no effect.', 'Choose rarity for your own organization.'),
            ],
        },
        {
            id: 'skills',
            title: 'Skills',
            intro: 'The Skills page stores descriptive skill records. Skills cannot currently be activated.',
            notes: [
                { title: 'For reference only', text: 'Active/Passive type, skill level, linked stat, Mind cost, and cooldown are stored and displayed only. The app has no action that uses a skill, spends Mind, checks cooldown, or applies linked-stat effects.' },
                { title: 'Linked Career', text: 'The form offers Career, but the game does not accept it as a skill’s linked stat. Choosing Career may cause saving to fail.' },
            ],
            metrics: [
                metric('skill', 'Skill', 'A saved description of a skill; it is not an ability you can activate in the current app.', 'Skills page.', 'Create a skill or edit its fields.', 'Edit or delete the saved record.', 'Skill level must be at least one; Mind cost and cooldown cannot be negative.', 'Type, level, linked stat, Mind cost, and cooldown have no gameplay effect.', 'A skill with a Mind cost and cooldown does not spend Mind or start a timer.', 'Treat skill records as notes until the app adds a skill-use action.'),
                metric('skill-type', 'Skill type', 'The Active or Passive label on a skill.', 'Skills filter, list, and editor.', 'Choose a type in the editor.', 'Choose a different type in the editor.', 'Active and Passive are the available values.', 'For reference only; no skills are activated or automatically applied.', 'Marking a skill Active does not add a button to use it.', 'Use the type to organize your notes.'),
                metric('skill-level', 'Skill level', 'A number stored on a skill record.', 'Skills list and editor.', 'Edit the skill level.', 'Edit the skill level.', 'Must be at least one.', 'For reference only; it does not follow your player Level.', 'Raising a skill’s level does not change your player Level or abilities.', 'Do not confuse skill level with player Level.'),
                metric('skill-cost-cooldown', 'Mind cost and cooldown', 'Stored numbers describing a skill’s intended cost and reuse delay.', 'Skills list and editor.', 'Edit the values.', 'Edit the values.', 'Both values must be nonnegative.', 'For reference only; no gameplay action spends Mind or enforces cooldown.', `A listed Mind cost of ${GAME_RULES.examples.skillMindCost} leaves your Mind unchanged because skills cannot be used.`, 'These values describe intent only in the current app.'),
            ],
        },
        {
            id: 'titles',
            title: 'Titles',
            intro: 'Titles are display labels that you can equip after unlocking.',
            notes: [
                { title: 'Unlocks', text: `${titleUnlockList}. ${streakTitle.name} unlocks at ${streakTitle.days} days of at least one quest completion per day. This is separate from ability streaks.` },
                { title: 'Bonus text', text: 'Some titles show a bonus ability and amount. The current app stores and displays that text but does not add the bonus to your ability.' },
            ],
            metrics: titleMetrics,
        },
        {
            id: 'history',
            title: 'History',
            intro: 'History is a paged activity list, newest entries first.',
            notes: [
                { title: 'What appears', text: 'The current history can record XP gains, level-ups, rank changes, ability point changes, penalties, completed quests, streak milestones, and dungeon clears.' },
                { title: 'What does not appear', text: 'Item use and shield use are not recorded. There is no shield system. The app also has no active purchase flow.' },
            ],
            metrics: [
                metric('history', 'History', 'A list of selected recorded game events.', 'History → Activity log.', 'A tracked event occurs, such as a quest completion, XP reward, level-up, penalty, milestone, or dungeon clear.', 'History entries are not a live ledger of every field change. The list is paged.', `The page shows ${GAME_RULES.history.pageSize} entries at a time.`, 'Use descriptions and amounts to review recorded events; item use is not recorded.', 'A dungeon clear can appear in history, but using a Consumable does not.', 'Use Profile for current values and History for the events the app records.'),
            ],
        },
        {
            id: 'settings',
            title: 'Profile, time zone, and settings',
            intro: 'Settings lets you set the displayed profile name and choose a time zone. The time zone controls the date boundary used by the board and streaks.',
            notes: [
                { title: 'Time zone caveat', text: 'The browser time zone is synced when the app loads. This can overwrite a different time zone you selected in Settings. Streaks and daily quest dates use the profile time zone; the Iron Will title check currently uses Eastern time.' },
                { title: 'Reset progress', text: 'Resetting progress clears level, XP, abilities, vitals, Fatigue, Gold, rank, active title, streaks, quest history, activity history, and dungeon progress. It retains your profile name, time zone, quest templates, skills, items, dungeons, and unlocked titles.' },
            ],
            metrics: [
                metric('timezone', 'Time zone', 'The local time zone used to determine your current game day.', 'Settings, beside Timezone.', 'Choose a time zone in Settings.', 'Choose a different zone; however, app load may sync the browser zone over your selection.', 'Choose a time zone available in Settings.', 'Sets the daily quest date and ability-streak day. The seven-day title check currently uses Eastern time instead.', 'Changing zones can shift which local date the app considers today.', 'Keep your browser and selected time zones aligned if you want the setting to persist.'),
                metric('profile-name', 'Profile name', 'The name shown at the top of your Profile.', 'Settings and Profile.', 'Edit the name and select Save profile name.', 'Replace it with a different value or clear it.', `The form allows up to ${GAME_RULES.profile.displayNameMaxLength} characters. A blank name displays as Unnamed Player.`, 'Display only; it does not affect rewards or progression.', 'Saving a name changes the Profile heading but not your Level or Rank.', 'Choose a name that helps you recognize your record.'),
            ],
        },
        {
            id: 'glossary',
            title: 'Glossary A to Z',
            intro: 'Search for a term or browse the list. Each term opens the manual section that explains it.',
            notes: [],
        },
        {
            id: 'faq',
            title: 'FAQ',
            intro: 'These answers describe behaviors that can look surprising at first.',
            notes: [
                { title: 'Why did my streak fall back?', text: 'The day ended without a completed quest tagged to that ability. The current count returns to the last milestone already paid, or zero if none was paid. Skipping one quest is not itself the cause if another matching quest was completed that day.' },
                { title: 'Why is my bar not full after leveling?', text: 'Leveling changes XP, not current vitals. It also does not refill a vital when its ceiling increases. A larger ceiling gives more capacity; current value changes only through configured effects.' },
                { title: 'Why did a quest not count toward a streak?', text: 'Only completed quests count. The quest must have that ability tag, and a given ability can receive only one hit per day. Difficulty, target, and unit do not grant streak credit.' },
                { title: 'What does Skipped mean?', text: 'Skipped is the player-facing label for a failed quest log. Its configured vital and Gold penalties apply immediately. It does not count as a completion.' },
                { title: 'Why did my title bonus not change my ability?', text: 'Title bonus values are displayed as reference only. Equipping the title changes the title shown on your Profile, not your ability value.' },
                { title: 'Why did my item not grant its equipment effect?', text: 'Equipment effects are displayed but are not applied by the current game logic. Only Consumable items have an implemented effect action.' },
                { title: 'Why did my chosen time zone change back?', text: 'The app syncs your browser time zone on load. If it differs from the saved setting, the browser time zone can replace it.' },
            ],
        },
    ]
}

export type GlossaryTerm = {
    term: string
    definition: string
    section: string
}

const baseGlossary: GlossaryTerm[] = [
    { term: 'Ability', definition: 'One of Strength, Agility, Sense, Vitality, Intelligence, or Career.', section: 'abilities' },
    { term: 'Ability points', definition: 'Points awarded at streak milestones directly to the matching ability. Any available allocation balance is separate.', section: 'abilities' },
    { term: 'Active title', definition: 'The unlocked title currently shown on your Profile.', section: 'titles' },
    { term: 'Add quest', definition: 'Adds an eligible Weekly or One-time quest to today, once per quest per day.', section: 'quests' },
    { term: 'Career', definition: 'An ability that raises the Mind ceiling. Career is not accepted as a linked skill stat by the live database.', section: 'abilities' },
    { term: 'Clear', definition: 'Resolves an in-progress dungeon as cleared and grants its configured rewards once.', section: 'dungeons' },
    { term: 'Cooldown', definition: 'A stored skill field; it is for reference only.', section: 'skills' },
    { term: 'Difficulty', definition: 'Easy, Medium, or Hard label. It does not change gameplay.', section: 'quests' },
    { term: 'Dungeon', definition: 'A larger goal with status, optional deadline, rank label, and clear rewards.', section: 'dungeons' },
    { term: 'Emotion', definition: 'A current vital with a ceiling raised by Sense.', section: 'vitals' },
    { term: 'Equipment', definition: 'An item that can be marked equipped. Its displayed effect is not applied.', section: 'inventory' },
    { term: 'Fatigue', definition: 'A separate value from zero to its maximum; quest completion can restore it.', section: 'vitals' },
    { term: 'Gold', definition: 'A balance raised by quest and dungeon rewards and lowered by penalties or item effects.', section: 'character' },
    { term: 'History', definition: 'A paged list of selected recorded events.', section: 'history' },
    { term: 'Intelligence', definition: 'An ability that raises the Mind ceiling.', section: 'abilities' },
    { term: 'Level', definition: 'Your overall progression level, raised by XP rewards.', section: 'character' },
    { term: 'Material', definition: 'An inventory item with no implemented use effect.', section: 'inventory' },
    { term: 'Milestone', definition: 'A configured streak length that awards points to its ability.', section: 'streaks' },
    { term: 'Mind', definition: 'A current vital with a ceiling raised by Strength, Agility, Intelligence, and Career.', section: 'vitals' },
    { term: 'Mind cost', definition: 'A stored skill field; it does not spend Mind in the current app.', section: 'skills' },
    { term: 'One-time', definition: 'A quest recurrence that can be added to today once on that day.', section: 'quests' },
    { term: 'Overdue', definition: 'A dungeon deadline has passed. This does not automatically fail the dungeon.', section: 'dungeons' },
    { term: 'Points ready to allocate', definition: 'A separate balance that appears only when positive; spend it with an ability plus button.', section: 'abilities' },
    { term: 'Rank', definition: 'A letter progression band based on player Level. Dungeon rank is a separate label.', section: 'character' },
    { term: 'Rarity', definition: 'Common, Rare, Epic, or Legendary item label. It does not change effects.', section: 'inventory' },
    { term: 'Sense', definition: 'An ability that raises the Emotion ceiling.', section: 'abilities' },
    { term: 'Shield', definition: 'Not implemented in the current app.', section: 'shields' },
    { term: 'Skill', definition: 'A saved description; there is no skill-use action.', section: 'skills' },
    { term: 'Skipped', definition: 'A quest marked failed; configured penalties apply immediately.', section: 'quests' },
    { term: 'Streak', definition: 'Consecutive local days with a completed quest tagged to an ability.', section: 'streaks' },
    { term: 'Strength', definition: 'An ability that raises Body and Mind ceilings.', section: 'abilities' },
    { term: 'Target', definition: 'Reference-only quest goal number; it does not affect rewards or completion.', section: 'quests' },
    { term: 'Title', definition: 'An unlockable display label you can equip.', section: 'titles' },
    { term: 'Unit', definition: 'Reference-only text beside a quest target.', section: 'quests' },
    { term: 'Vitality', definition: 'An ability that raises the Energy ceiling.', section: 'abilities' },
    { term: 'Energy', definition: 'A current vital with a ceiling raised by Vitality.', section: 'vitals' },
    { term: 'Body', definition: 'A current vital with a ceiling raised by Strength and Agility.', section: 'vitals' },
    { term: 'XP', definition: 'Experience points that move you toward the next Level.', section: 'character' },
]

const sectionTerms: Record<string, Array<[string, string]>> = {
    day: [
        ['Home', 'Your daily quest board and active dungeon reminders.'],
        ['View Profile', 'Opens your current status, abilities, and vitals.'],
        ['Manage Quests', 'Opens the quest setup and editing page.'],
        ['Manage Dungeons', 'Opens the dungeon setup and status page.'],
        ['Player Manual', 'Opens this guide.'],
        ['Titles', 'Opens your unlocked title list.'],
        ['Inventory', 'Opens your item list.'],
        ['Skills', 'Opens saved skill records.'],
        ['History', 'Opens the activity log.'],
        ['Settings', 'Opens profile name and time zone settings.'],
        ['Sign out', 'Signs out of your account.'],
        ['To-Do', 'Quest logs waiting for a completion or skip action.'],
        ['Done', 'Quest logs completed today.'],
        ['Skipped', 'Quest logs skipped today.'],
        ['Complete', 'Resolves a pending quest as completed and applies rewards.'],
        ['Skip', 'Resolves a pending quest as skipped and applies its penalties.'],
        ['Refresh home', 'Reloads today’s quest board and related data.'],
        ['Add quest to today', 'The dialog heading for manually adding a quest to the current day.'],
    ],
    quests: [
        ['Daily', 'An active daily quest is generated for each game day.'],
        ['Weekly', 'A quest you can manually add; it does not run on an automatic weekly schedule.'],
        ['Morning', 'A quest time-of-day label.'],
        ['Afternoon', 'A quest time-of-day label.'],
        ['Evening', 'A quest time-of-day label.'],
        ['Night', 'A quest time-of-day label.'],
        ['Enrolled', 'The quest is active and eligible for automatic daily generation.'],
        ['Not enrolled', 'The quest is inactive and not generated automatically.'],
        ['On skip', 'The configured vital penalty displayed on a quest card.'],
        ['No ability', 'A displayed state for a quest without ability tags; it receives no streak credit.'],
        ['On-demand', 'Not an available recurrence in the current app.'],
        ['No quests to do today', 'The Home To-Do list is empty for the selected day.'],
        ['No quests completed yet today', 'The Home Done list is empty for today.'],
        ['No quests skipped today', 'The Home Skipped list is empty for today.'],
        ['Quest Log', 'A Profile dialog that currently contains placeholder text, not activity history.'],
        ['Points ready to allocate', 'A Profile banner shown only when your older available point balance is positive.'],
    ],
    streaks: [
        ['Hit secured', 'At least one matching quest completion has credited the ability today.'],
        ['Hit not secured', 'No matching quest completion has credited the ability today yet.'],
        ['Next', 'The next configured milestone for that ability.'],
        ['No upcoming milestone', 'There is no higher milestone configured beyond the current streak.'],
        ['Allocate one point', 'Uses one point from the separate available balance on the chosen ability.'],
    ],
    shields: [
        ['Shield', 'A proposed mechanic that does not exist in the current app.'],
    ],
    dungeons: [
        ['Open', 'A dungeon not yet started.'],
        ['In progress', 'A started dungeon; Clear is available.'],
        ['Cleared', 'A dungeon whose clear rewards have been paid.'],
        ['Failed', 'An abandoned dungeon.'],
        ['No deadline', 'The dungeon has no deadline date set.'],
        ['Days left', 'The calendar-day difference between today and the deadline.'],
        ['Abandon', 'Changes an open or in-progress dungeon to Failed.'],
        ['Start', 'Moves an Open dungeon to In progress.'],
        ['Clear', 'Pays dungeon rewards and changes an in-progress dungeon to Cleared.'],
    ],
    inventory: [
        ['Consumable', 'An item that can be used once per quantity and applies its configured effects.'],
        ['Equipped', 'The equipment state label; it does not apply the listed effect.'],
        ['Unequipped', 'Equipment is not marked equipped.'],
        ['Quantity', 'The number of copies recorded.'],
        ['Use', 'Applies a consumable’s effects and uses one quantity.'],
        ['Common', 'An item rarity label.'],
        ['Rare', 'An item rarity label.'],
        ['Epic', 'An item rarity label.'],
        ['Legendary', 'An item rarity label.'],
        ['All item types', 'Inventory filter that includes every item category.'],
        ['All effects', 'Inventory filter that includes every effect category.'],
        ['Effect Builder', 'The item form for configuring displayed effects.'],
        ['Equipment', 'An item type whose listed bonus is not currently applied.'],
    ],
    skills: [
        ['Active', 'A skill type label; no activation action exists.'],
        ['Passive', 'A skill type label; no automatic effect exists.'],
        ['Linked stat', 'A stored field with no gameplay effect.'],
        ['Level', 'A skill field only; it does not change your player Level.'],
        ['Cooldown (minutes)', 'A skill field for reference only.'],
    ],
    titles: [
        ['Rising Hunter', 'A title unlocked at its configured level threshold.'],
        ['Veteran Hunter', 'A title unlocked at its configured level threshold.'],
        ['Elite Hunter', 'A title unlocked at its configured level threshold; its bonus is metadata only.'],
        ['Monarch', 'A title unlocked at its configured level threshold; its bonus is metadata only.'],
        ['Iron Will', 'A title unlocked for a consecutive quest-completion streak; its bonus is metadata only.'],
        ['Equipped', 'This title is selected for display.'],
        ['Bonus', 'A title field shown for reference only.'],
        ['Check for new titles', 'Asks the app to check whether configured titles have unlocked.'],
        ['Unequip', 'Removes the title from your Profile display without removing the unlock.'],
    ],
    history: [
        ['XP gain', 'A recorded XP reward event.'],
        ['Level up', 'A recorded player level-up event.'],
        ['Stat change', 'A recorded ability or rank-related update.'],
        ['Penalty', 'A recorded skipped-quest penalty.'],
        ['Quest complete', 'A recorded quest completion.'],
        ['Dungeon clear', 'A recorded dungeon clear.'],
        ['Streak milestone', 'A recorded streak milestone reward.'],
        ['Purchase', 'A possible history event label with no current purchase flow.'],
        ['Previous', 'Moves to the prior page of history.'],
        ['Next', 'Moves to the next page of history, or displays the next streak milestone under an ability.'],
    ],
    settings: [
        ['Timezone', 'The local time zone used for daily quest and streak dates, with the browser-sync caveat described in Settings.'],
        ['Profile name', 'The name shown on your Profile.'],
        ['Reset account progress', 'Resets progress while retaining listed templates and records.'],
        ['Delete account', 'Opens the account-deletion flow; this is separate from resetting progress.'],
        ['Save profile name', 'Saves the profile name shown on your Profile.'],
    ],
}

export function getGlossaryTerms() {
    const extraTerms = Object.entries(sectionTerms).flatMap(([section, terms]) =>
        terms.map(([term, definition]) => ({ term, definition, section })),
    )
    const unique = new Map<string, GlossaryTerm>()
    for (const entry of [...baseGlossary, ...extraTerms]) {
        const key = `${entry.section}:${entry.term.toLocaleLowerCase()}`
        if (!unique.has(key)) unique.set(key, entry)
    }
    return [...unique.values()].sort((left, right) => left.term.localeCompare(right.term))
}
