import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check,
  CalendarDays, ChevronDown, ChevronRight, Flame, Gauge,
  LayoutDashboard, LoaderCircle, Menu, Moon, Search, Shield, Sparkles, Sun,
  Trophy, X, RefreshCw,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fetchLeagueDashboard, fetchNflWeekStatuses, formatPoints } from './sleeperData.js'

const teamThemes = [
  { code: 'ARI', name: 'Arizona Cardinals', primary: '#97233f', accent: '#ffb612' },
  { code: 'ATL', name: 'Atlanta Falcons', primary: '#a71930', accent: '#a5acaf' },
  { code: 'BAL', name: 'Baltimore Ravens', primary: '#241773', accent: '#9e7c0c' },
  { code: 'BUF', name: 'Buffalo Bills', primary: '#00338d', accent: '#c60c30' },
  { code: 'CAR', name: 'Carolina Panthers', primary: '#0085ca', accent: '#101820' },
  { code: 'CHI', name: 'Chicago Bears', primary: '#0b162a', accent: '#c83803' },
  { code: 'CIN', name: 'Cincinnati Bengals', primary: '#fb4f14', accent: '#222222' },
  { code: 'CLE', name: 'Cleveland Browns', primary: '#311d00', accent: '#ff3c00' },
  { code: 'DAL', name: 'Dallas Cowboys', primary: '#003594', accent: '#869397' },
  { code: 'DEN', name: 'Denver Broncos', primary: '#fb4f14', accent: '#002244' },
  { code: 'DET', name: 'Detroit Lions', primary: '#0076b6', accent: '#b0b7bc' },
  { code: 'GB', name: 'Green Bay Packers', primary: '#203731', accent: '#ffb612' },
  { code: 'HOU', name: 'Houston Texans', primary: '#03202f', accent: '#a71930' },
  { code: 'IND', name: 'Indianapolis Colts', primary: '#002c5f', accent: '#a2aaad' },
  { code: 'JAX', name: 'Jacksonville Jaguars', primary: '#006778', accent: '#d7a22a' },
  { code: 'KC', name: 'Kansas City Chiefs', primary: '#e31837', accent: '#ffb81c' },
  { code: 'LV', name: 'Las Vegas Raiders', primary: '#25282a', accent: '#a5acaf' },
  { code: 'LAC', name: 'Los Angeles Chargers', primary: '#0080c6', accent: '#ffc20e' },
  { code: 'LAR', name: 'Los Angeles Rams', primary: '#003594', accent: '#ffa300' },
  { code: 'MIA', name: 'Miami Dolphins', primary: '#008e97', accent: '#fc4c02' },
  { code: 'MIN', name: 'Minnesota Vikings', primary: '#4f2683', accent: '#ffc62f' },
  { code: 'NE', name: 'New England Patriots', primary: '#002244', accent: '#c60c30' },
  { code: 'NO', name: 'New Orleans Saints', primary: '#6c5d39', accent: '#d3bc8d' },
  { code: 'NYG', name: 'New York Giants', primary: '#0b2265', accent: '#a71930' },
  { code: 'NYJ', name: 'New York Jets', primary: '#125740', accent: '#a5acaf' },
  { code: 'PHI', name: 'Philadelphia Eagles', primary: '#004c54', accent: '#a5acaf' },
  { code: 'PIT', name: 'Pittsburgh Steelers', primary: '#25282a', accent: '#ffb612' },
  { code: 'SF', name: 'San Francisco 49ers', primary: '#aa0000', accent: '#b3995d' },
  { code: 'SEA', name: 'Seattle Seahawks', primary: '#002244', accent: '#69be28' },
  { code: 'TB', name: 'Tampa Bay Buccaneers', primary: '#d50a0a', accent: '#ff7900' },
  { code: 'TEN', name: 'Tennessee Titans', primary: '#0c2340', accent: '#4b92db' },
  { code: 'WAS', name: 'Washington Commanders', primary: '#5a1414', accent: '#ffb612' },
]
const teamThemeByCode = Object.fromEntries(teamThemes.map((team) => [team.code, team]))

function Avatar({ initials, color, src, fallbackSrc, small = false }) {
  const [useFallback, setUseFallback] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => {
    setUseFallback(false)
    setImageFailed(false)
  }, [src, fallbackSrc])
  const imageSrc = imageFailed ? null : useFallback ? fallbackSrc : src || fallbackSrc
  const handleImageError = () => {
    if (!useFallback && src && fallbackSrc && src !== fallbackSrc) setUseFallback(true)
    else setImageFailed(true)
  }
  return <span className={`avatar ${small ? 'avatar-sm' : ''}`} style={{ '--avatar-color': color }}>{imageSrc ? <img src={imageSrc} alt="" loading="lazy" decoding="async" onError={handleImageError} /> : initials}</span>
}

function FavoriteTeamPicker({ favoriteTeam, onFavoriteTeamChange, compact = false }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const pickerRef = useRef(null)
  const filteredTeams = [...teamThemes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((team) => `${team.name} ${team.code}`.toLowerCase().includes(teamSearch.trim().toLowerCase()))

  useEffect(() => {
    if (!pickerOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        setPickerOpen(false)
        setTeamSearch('')
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setPickerOpen(false)
        setTeamSearch('')
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [pickerOpen])

  const selectFavoriteTeam = (code) => {
    onFavoriteTeamChange(code)
    setPickerOpen(false)
    setTeamSearch('')
  }

  return <div className={`favorite-picker ${compact ? 'favorite-picker-compact' : ''}`} ref={pickerRef}>
    {!compact && <span className="favorite-label">YOUR TEAM COLORS</span>}
    <button type="button" className={`team-select-trigger ${pickerOpen ? 'picker-trigger-open' : ''}`} aria-haspopup="listbox" aria-expanded={pickerOpen} aria-label={`Favorite team: ${favoriteTeam.name}`} onClick={() => setPickerOpen((current) => !current)}>
      <span className="team-select-swatch" style={{ '--swatch-primary': favoriteTeam.primary, '--swatch-accent': favoriteTeam.accent }}><span /></span>
      <span className="team-select-copy"><strong>{favoriteTeam.name}</strong>{!compact && <small>Favorite team</small>}</span>
      <span className="favorite-code">{favoriteTeam.code}</span>
      <ChevronDown size={15} className={`team-select-chevron ${pickerOpen ? 'chevron-rotated' : ''}`} />
    </button>
    {pickerOpen && <div className="team-picker-popover">
      <div className="picker-popover-heading"><div><strong>Pick your colors</strong><span>Choose your favorite NFL team</span></div><button type="button" className="picker-close" aria-label="Close team picker" onClick={() => { setPickerOpen(false); setTeamSearch('') }}><X size={16} /></button></div>
      <label className="team-picker-search"><Search size={15} /><input type="search" value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Search 32 teams" aria-label="Search NFL teams" /></label>
      <div className="team-picker-options" role="listbox" aria-label="NFL teams">
        {filteredTeams.map((team) => <button type="button" role="option" aria-selected={favoriteTeam.code === team.code} className={`team-picker-option ${favoriteTeam.code === team.code ? 'team-option-selected' : ''}`} onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const options = [...(pickerRef.current?.querySelectorAll('[role="option"]') || [])]
          const currentIndex = options.indexOf(event.currentTarget)
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
          options[nextIndex]?.focus()
        }} onClick={() => selectFavoriteTeam(team.code)} key={team.code}>
          <span className="team-option-swatch" style={{ '--swatch-primary': team.primary, '--swatch-accent': team.accent }}><span /></span><span className="team-option-name">{team.name}</span><span className="team-option-code">{team.code}</span>{favoriteTeam.code === team.code && <Check size={15} className="team-option-check" />}
        </button>)}
        {filteredTeams.length === 0 && <div className="no-teams-found">No teams match “{teamSearch}”</div>}
      </div>
      <div className="picker-popover-footer"><span className="footer-color-dots"><i /><i /></span> Colors apply instantly and save in this browser</div>
    </div>}
  </div>
}

function Sidebar({ active, setActive, open, onClose, favoriteTeam, onFavoriteTeamChange, league, darkMode, onToggleDarkMode }) {

  const nav = [
    { label: 'Recap', icon: LayoutDashboard },
    { label: 'Awards & records', icon: Trophy },
    { label: 'Standings', icon: BarChart3 },
    { label: 'Matchups', icon: Activity },
  ]
  return <>
    {open && <button className="mobile-scrim" aria-label="Close menu" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><button className="icon-button close-menu" onClick={onClose} aria-label="Close menu"><X size={18} /></button></div>
      <div className="league-switcher"><div className="league-emblem">🏈</div><div className="switcher-copy"><strong>{league?.name || 'Loading league…'}</strong><span>{league ? `${league.season} season · ${league.teamCount} teams` : 'Sleeper league'}</span></div></div>
      <FavoriteTeamPicker favoriteTeam={favoriteTeam} onFavoriteTeamChange={onFavoriteTeamChange} />
      <div className="nav-label">YOUR LEAGUE</div>
      <nav className="main-nav">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label || (label === 'Recap' && active === 'League HQ') ? 'nav-active' : ''}`} onClick={() => { setActive(label); onClose() }}><Icon size={17} strokeWidth={1.9} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-spacer" />
      <button className="theme-toggle sidebar-theme-toggle" onClick={onToggleDarkMode} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} aria-pressed={darkMode}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}<span>{darkMode ? 'Light mode' : 'Dark mode'}</span></button>
    </aside>
  </>
}

function MobileTabBar({ active, setActive }) {
  const nav = [
    { label: 'Recap', icon: LayoutDashboard },
    { label: 'Awards & records', icon: Trophy },
    { label: 'Standings', icon: BarChart3 },
    { label: 'Matchups', icon: Activity },
  ]
  return <nav className="mobile-tab-bar" aria-label="League sections">
    {nav.map(({ label, icon: Icon }) => <button key={label} className={`mobile-tab-item ${active === label || (label === 'Recap' && active === 'League HQ') ? 'mobile-tab-active' : ''}`} aria-current={active === label || (label === 'Recap' && active === 'League HQ') ? 'page' : undefined} onClick={() => setActive(label === 'Recap' ? 'League HQ' : label)}>
      <Icon size={20} strokeWidth={1.9} /><span>{label === 'Awards & records' ? 'Awards' : label}</span>
    </button>)}
  </nav>
}

function WeekPicker({ weeks, week, currentWeek, lastCompletedWeek, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)
  const weekNumbers = Object.keys(weeks).map(Number).sort((a, b) => b - a)

  useEffect(() => {
    if (!pickerOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setPickerOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [pickerOpen])

  const selectWeek = (value) => {
    onChange(value)
    setPickerOpen(false)
  }

  return <div className="week-select-wrap" ref={pickerRef}>
    <button type="button" className={`week-select ${pickerOpen ? 'week-select-open' : ''}`} aria-haspopup="listbox" aria-expanded={pickerOpen} onClick={() => setPickerOpen((current) => !current)}>
      <CalendarDays size={16} /><span>Week {week}</span><ChevronDown size={14} className={`week-select-chevron ${pickerOpen ? 'chevron-rotated' : ''}`} />
    </button>
    {pickerOpen && <div className="week-picker-popover">
      <div className="week-picker-heading"><div><strong>Jump to a week</strong><span>{weekNumbers.length} weeks of matchup data</span></div></div>
      <div className="week-picker-options" role="listbox" aria-label="Season weeks">
        {weekNumbers.map((weekNumber, index) => {
          const isCurrent = weekNumber === currentWeek
          const isFinal = weekNumber <= lastCompletedWeek
          return <button type="button" role="option" aria-selected={week === weekNumber} className={`week-picker-option ${week === weekNumber ? 'week-option-selected' : ''}`} onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const options = [...(pickerRef.current?.querySelectorAll('[role="option"]') || [])]
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
            options[nextIndex]?.focus()
          }} onClick={() => selectWeek(weekNumber)} key={weekNumber}>
            <span className="week-option-number">Week {String(weekNumber).padStart(2, '0')}</span>
            <span className={`week-option-status ${isCurrent ? 'week-status-live' : ''}`}>{isCurrent ? 'LIVE' : isFinal ? 'FINAL' : 'SCHEDULED'}</span>
            {week === weekNumber && <Check size={15} className="week-option-check" />}
          </button>
        })}
      </div>
      <div className="week-picker-footer"><span className="week-live-dot" /> Current NFL week: {currentWeek}</div>
    </div>}
  </div>
}

function Header({ onMenu, darkMode, onToggleDarkMode, favoriteTeam, onFavoriteTeamChange }) {
  return <header className="topbar"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button><FavoriteTeamPicker favoriteTeam={favoriteTeam} onFavoriteTeamChange={onFavoriteTeamChange} compact /><div className="top-actions"><button className="theme-toggle" onClick={onToggleDarkMode} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} aria-pressed={darkMode} title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}<span>{darkMode ? 'Light' : 'Dark'}</span></button></div></header>
}

function StatCard({ icon: Icon, label, value, note, noteTone, spark }) {
  return <article className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={17} /></span><span className={`stat-note ${noteTone || ''}`}>{noteTone === 'positive' ? <ArrowUpRight size={13} /> : noteTone === 'negative' ? <ArrowDownRight size={13} /> : null}{note}</span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{spark && <svg className="sparkline" viewBox="0 0 120 32" preserveAspectRatio="none"><path d={spark} /></svg>}</article>
}

function cleanRecapDecimals(text) {
  return text.replace(/\b-?\d+\.\d{3,}\b/g, (value) => Number(value).toFixed(2).replace(/\.?0+$/, ''))
}

function RecapSegments({ segments: sourceSegments }) {
  const segments = []
  sourceSegments.forEach((segment) => {
    let text = cleanRecapDecimals(segment.text || '')
    if (!text.trim()) return
    const previous = segments[segments.length - 1]
    const startsWithPunctuation = /^[,.;:!?)}\]”’]/.test(text.trimStart())
    if (previous && startsWithPunctuation) {
      previous.text = previous.text.trimEnd()
      text = text.trimStart()
    } else if (previous) {
      const previousHasSpace = /\s$/.test(previous.text)
      const currentHasSpace = /^\s/.test(text)
      if (previousHasSpace && currentHasSpace) text = text.trimStart()
      else if (!previousHasSpace && !currentHasSpace && !/[([{“‘]$/.test(previous.text)) text = ` ${text}`
    }
    segments.push({ ...segment, text })
  })
  return segments.map((segment, index) => {
    if (segment.type === 'team') return <strong className="recap-team-emphasis" key={index}>{segment.text}</strong>
    if (segment.type === 'player') return <strong className="recap-player-emphasis" key={index}>{segment.text}</strong>
    if (segment.type === 'stat') return <span className="recap-stat-emphasis" key={index}>{segment.text}</span>
    return <span key={index}>{segment.text}</span>
  })
}

function RecapCopy({ recap }) {
  if (!Array.isArray(recap.segments)) return <p>{cleanRecapDecimals(recap.text || '')}</p>
  return <p><RecapSegments segments={recap.segments} /></p>
}

function hasRecapText(segments) {
  return Array.isArray(segments) && segments.some((segment) => typeof segment.text === 'string' && segment.text.trim())
}

function isCompleteStructuredRecap(recap) {
  return ['result', 'homeStory', 'awayStory', 'punchline'].every((key) => hasRecapText(recap[key])) && Array.isArray(recap.benchNote)
}

function isVerifiedBenchNote(segments, matchup) {
  if (!hasRecapText(segments)) return false
  const note = segments.map((segment) => segment.text).join(' ').toLocaleLowerCase()
  return [matchup.home, matchup.away].some((team) => (team.eligibleBenchUpgrades || []).some(({ benchPlayer, starter }) =>
    note.includes(benchPlayer.name.toLocaleLowerCase()) && note.includes(starter.name.toLocaleLowerCase())))
}

function RecapFallback({ matchup, isLive }) {
  const [leader, trailer] = matchup.home.points >= matchup.away.points
    ? [matchup.home, matchup.away]
    : [matchup.away, matchup.home]
  const teamNotes = [matchup.home, matchup.away].map((team) => {
    const player = team.topStarter
    return player
      ? `${team.team.name} got ${formatPoints(player.points)} points from ${player.name}.`
      : `${team.team.name} has no starter score to highlight yet.`
  })
  const benchNotes = [matchup.home, matchup.away].flatMap((team) => {
    return (team.eligibleBenchUpgrades || []).slice(0, 1).map(({ benchPlayer, starter }) =>
      `${team.team.manager} left ${formatPoints(benchPlayer.points)} points from ${benchPlayer.name} on the bench instead of ${starter.name}, who scored ${formatPoints(starter.points)}.`)
  })
  const margin = formatPoints(matchup.margin)
  const result = matchup.home.points === matchup.away.points
    ? `${matchup.home.team.name} and ${matchup.away.team.name} are tied at ${formatPoints(matchup.home.points)}.`
    : `${leader.team.name} ${isLive ? 'currently leads' : 'beat'} ${trailer.team.name} by ${margin} points.`
  return <div className="recap-fallback"><span>QUICK SCOREBOARD RECAP · AI RECAP INCOMPLETE</span><p>{result} {teamNotes.join(' ')} {benchNotes.join(' ')}</p></div>
}

function RecapMatchupPicker({ matchups, selectedIndex, week, onSelect }) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedMatchup = matchups[selectedIndex] || matchups[0]

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
    optionRefs.current = []
  }, [matchups])

  const focusOption = (index) => optionRefs.current[index]?.focus()
  const openMenu = () => {
    setOpen(true)
    requestAnimationFrame(() => focusOption(selectedIndex))
  }
  const chooseMatchup = (index) => {
    onSelect(index)
    setOpen(false)
    triggerRef.current?.focus()
  }
  const moveOptionFocus = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % matchups.length
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + matchups.length) % matchups.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = matchups.length - 1
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      chooseMatchup(index)
      return
    } else return
    event.preventDefault()
    focusOption(nextIndex)
  }

  const renderTeamAvatar = (team, tone) => <Avatar initials={team.initials} src={team.avatar} fallbackSrc={team.avatarFallback} color={tone} small />
  if (!selectedMatchup) return null

  return <div className="recap-matchup-picker" ref={pickerRef}>
    <span className="recap-picker-label" id="recap-matchup-label">WEEK {week} · SELECT MATCHUP</span>
    <button type="button" className="recap-picker-trigger" ref={triggerRef} aria-haspopup="listbox" aria-controls="recap-matchup-listbox" aria-expanded={open} aria-label={`Choose recap matchup. Selected: ${selectedMatchup.home.team.name} versus ${selectedMatchup.away.team.name}`} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu() } }}>
      <span className="recap-picker-avatars">{renderTeamAvatar(selectedMatchup.home.team, '#dce9d3')}{renderTeamAvatar(selectedMatchup.away.team, '#eee2d6')}</span>
      <span className="recap-picker-trigger-copy"><strong className="recap-picker-names"><span>{selectedMatchup.home.team.name}</span><i>vs</i><span>{selectedMatchup.away.team.name}</span></strong><small>{formatPoints(selectedMatchup.home.points)} <i>—</i> {formatPoints(selectedMatchup.away.points)} pts</small></span>
      <ChevronDown size={17} className={`recap-picker-chevron ${open ? 'recap-picker-chevron-open' : ''}`} aria-hidden="true" />
    </button>
    {open && <div className="recap-matchup-menu" id="recap-matchup-listbox" role="listbox" aria-labelledby="recap-matchup-label">{matchups.map((matchup, index) => <div className={`recap-matchup-option ${index === selectedIndex ? 'recap-matchup-option-selected' : ''}`} key={`${matchup.home.rosterId}-${matchup.away.rosterId}`} role="option" aria-selected={index === selectedIndex} tabIndex={index === selectedIndex ? 0 : -1} ref={(element) => { optionRefs.current[index] = element }} onClick={() => chooseMatchup(index)} onKeyDown={(event) => moveOptionFocus(event, index)}>
      <span className="recap-picker-avatars">{renderTeamAvatar(matchup.home.team, '#dce9d3')}{renderTeamAvatar(matchup.away.team, '#eee2d6')}</span>
      <span className="recap-matchup-option-copy"><strong className="recap-picker-names"><span>{matchup.home.team.name}</span><i>vs</i><span>{matchup.away.team.name}</span></strong><small>{formatPoints(matchup.home.points)} <i>—</i> {formatPoints(matchup.away.points)} pts</small></span>
      {index === selectedIndex && <span className="recap-matchup-check" aria-hidden="true">✓</span>}
    </div>)}</div>}
  </div>
}

function TrendChart({ darkMode, data, average }) {
  const gridColor = darkMode ? '#343c34' : '#e9ebe6'
  const tickColor = darkMode ? '#a1aa9f' : '#a0a59d'
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 6, left: -26, bottom: 0 }}>
    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--team-primary)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--team-primary)" stopOpacity={0.01} /></linearGradient></defs>
    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 5" />
    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11, fontFamily: 'DM Mono' }} dy={10} />
    <YAxis axisLine={false} tickLine={false} ticks={[80, 110, 140, 170]} tick={{ fill: tickColor, fontSize: 10, fontFamily: 'DM Mono' }} />
    <Tooltip contentStyle={{ background: darkMode ? '#202720' : '#fff', color: darkMode ? '#e6ebe3' : '#20251f', borderRadius: 12, border: `1px solid ${darkMode ? '#3b443a' : '#e8eae4'}`, boxShadow: '0 8px 28px #19241412', fontSize: 12 }} labelStyle={{ color: darkMode ? '#e8ede4' : '#394435', fontWeight: 600 }} itemStyle={{ color: darkMode ? '#e8ede4' : '#394435' }} formatter={(value, name) => [`${formatPoints(value)} pts`, name === 'points' ? 'Team high' : 'League average']} />
    <Area type="monotone" dataKey="points" stroke="var(--team-primary)" strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 5, fill: 'var(--team-primary)', stroke: darkMode ? '#202720' : '#fff', strokeWidth: 2 }} />
    <Area type="monotone" dataKey="average" stroke="#aeb7a5" strokeWidth={1.5} strokeDasharray="4 4" fill="none" activeDot={false} />
  </AreaChart></ResponsiveContainer><div className="chart-average"><span className="average-line" /> Week avg <b>{formatPoints(average)}</b></div></div>
}

function MatchupCard({ matchup, gameStatuses }) {
  const [expanded, setExpanded] = useState(false)
  const homeWon = matchup.home.points > matchup.away.points
  return <div className={`matchup-card ${expanded ? 'matchup-expanded' : ''}`}>
    <div className="matchup-row"><div className="matchup-status"><span className={`status-dot ${matchup.status === 'LIVE' ? 'yellow' : 'green'}`} />{matchup.status}</div><div className="matchup-teams"><div className={`matchup-team ${homeWon ? 'winner' : ''}`}><Avatar initials={matchup.home.team.initials} src={matchup.home.team.avatar} fallbackSrc={matchup.home.team.avatarFallback} color="#dce9d3" small /><span>{matchup.home.team.name}</span><b>{formatPoints(matchup.home.points)}</b></div><div className={`matchup-team ${!homeWon ? 'winner' : ''}`}><Avatar initials={matchup.away.team.initials} src={matchup.away.team.avatar} fallbackSrc={matchup.away.team.avatarFallback} color="#eee2d6" small /><span>{matchup.away.team.name}</span><b>{formatPoints(matchup.away.points)}</b></div></div><div className="matchup-margin">{formatPoints(matchup.margin)}<span>diff</span></div><button type="button" className="matchup-expand-button" aria-label={`${expanded ? 'Hide' : 'Show'} ${matchup.home.team.name} and ${matchup.away.team.name} lineups`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><ChevronRight size={16} className="muted-icon matchup-chevron" /></button></div>
    {expanded && <div className="matchup-lineups">{[matchup.home, matchup.away].map((team) => <section className="matchup-lineup" key={team.rosterId}><h4>{team.team.name} <span>{formatPoints(team.points)} pts</span></h4>{team.starters.map((player) => {
      const gameState = gameStatuses && player.team ? gameStatuses[player.team] : null
      const gameLabel = gameState === 'pre' ? 'Yet to play' : gameState === 'in' ? 'Playing' : gameState === 'post' ? 'Played' : gameStatuses && player.team ? 'Bye' : null
      const teamTheme = teamThemeByCode[player.team]
      return <div className="matchup-player" key={player.id}><span className="player-position">{player.position || 'Starter'}</span><span className="player-ident">{player.team && <small className="player-team" style={teamTheme ? { '--player-team-primary': teamTheme.primary, '--player-team-accent': teamTheme.accent } : undefined}>{player.team}</small>}<strong>{player.name}</strong></span>{gameLabel && <small className={`player-game-status ${gameState === 'pre' ? 'player-not-started' : ''}`}>{gameLabel}</small>}<b>{formatPoints(player.points)}</b></div>
    })}</section>)}</div>}
  </div>
}

function MatchupsPage({ leagueData, week, weekData, onWeekChange }) {
  const [gameStatuses, setGameStatuses] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    setGameStatuses(null)
    fetchNflWeekStatuses(leagueData.league.season, week, controller.signal)
      .then(setGameStatuses)
      .catch((error) => { if (error.name !== 'AbortError') setGameStatuses(false) })
    return () => controller.abort()
  }, [leagueData.league.season, week])

  return <div className="page-content secondary-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> {leagueData.league.season} SEASON</div><h1>Matchups <span className="wave">✦</span></h1><p className="welcome-subtitle">Every head-to-head result, score, and margin.</p></div><WeekPicker weeks={leagueData.weeks} week={week} currentWeek={leagueData.currentWeek} lastCompletedWeek={leagueData.lastCompletedWeek} onChange={onWeekChange} /></div>
    <section className="panel matchup-page-panel"><div className="panel-heading matchup-heading"><div><div className="section-kicker">WEEK {week}{weekData.isLive ? ' · LIVE' : ' · FINAL'}</div><h3>League scoreboard</h3></div><span className="text-link">{weekData.matchups.length} matchups</span></div>{weekData.matchups.map((matchup) => <MatchupCard key={`${week}-${matchup.home.rosterId}`} matchup={{ ...matchup, status: weekData.isLive ? 'LIVE' : 'FINAL' }} gameStatuses={gameStatuses || null} />)}</section>
    <footer className="page-footer"><span>{leagueData.league.name} <span className="footer-dot">·</span> Season {leagueData.league.season}</span><span>Live stats from Sleeper <span className="footer-heart">♥</span></span></footer>
  </div>
}

function getSeasonScoringStats(leagueData) {
  const stats = new Map(leagueData.standings.map((team) => [team.id, { scores: [], closestWin: null, closestLoss: null }]))

  for (const [week, weekData] of Object.entries(leagueData.weeks)) {
    if (Number(week) > leagueData.lastCompletedWeek) continue
    for (const matchup of weekData.matchups) {
      const { home, away } = matchup
      for (const [team, opponent] of [[home, away], [away, home]]) {
        const teamStats = stats.get(team.team.id)
        if (!teamStats) continue
        teamStats.scores.push(team.points)
        if (team.points > opponent.points) {
          if (!teamStats.closestWin || matchup.margin < teamStats.closestWin.margin) {
            teamStats.closestWin = { margin: matchup.margin, teamScore: team.points, opponentScore: opponent.points }
          }
        } else if (team.points < opponent.points) {
          if (!teamStats.closestLoss || matchup.margin < teamStats.closestLoss.margin) {
            teamStats.closestLoss = { margin: matchup.margin, teamScore: team.points, opponentScore: opponent.points }
          }
        }
      }
    }
  }

  return stats
}

function StandingsPage({ leagueData }) {
  const seasonStats = getSeasonScoringStats(leagueData)
  return <div className="page-content secondary-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> {leagueData.league.season} SEASON</div><h1>Standings <span className="wave">✦</span></h1><p className="welcome-subtitle">The season race, ranked by record and points for.</p></div><span className="select-pill">Through week {leagueData.lastCompletedWeek}</span></div>
    <section className="panel standings-panel standings-page-panel"><div className="panel-heading"><div><div className="section-kicker">SEASON RECORDS</div><h3>League table <span className="season-pill">WEEK {leagueData.lastCompletedWeek}</span></h3></div></div><div className="standings-scroll"><div className="standings-table"><div className="table-head"><span>TEAM</span><span>W-L</span><span>PF</span><span>PA</span><span>CLOSEST WIN</span><span>CLOSEST LOSS</span><span>HIGHEST</span><span>LOWEST</span></div><div className="standings-list">{leagueData.standings.map((team, index) => {
      const teamStats = seasonStats.get(team.id)
      const highScore = teamStats?.scores.length ? Math.max(...teamStats.scores) : null
      const lowScore = teamStats?.scores.length ? Math.min(...teamStats.scores) : null
      return <div className="standing-row" key={team.id}><div className="standing-identity"><span className="standing-place">{String(index + 1).padStart(2, '0')}</span><Avatar initials={team.initials} src={team.avatar} fallbackSrc={team.avatarFallback} color="#c8e4b8" small /><div className="standing-team"><strong>{team.name}</strong></div></div><span className="record">{team.wins}–{team.losses}</span><span className="points-for">{formatPoints(team.pointsFor)}</span><span className="points-against">{formatPoints(team.pointsAgainst)}</span><span className="standing-score">{teamStats?.closestWin ? `${formatPoints(teamStats.closestWin.teamScore)}–${formatPoints(teamStats.closestWin.opponentScore)}` : '—'}</span><span className="standing-score">{teamStats?.closestLoss ? `${formatPoints(teamStats.closestLoss.teamScore)}–${formatPoints(teamStats.closestLoss.opponentScore)}` : '—'}</span><span className="standing-score">{highScore === null ? '—' : formatPoints(highScore)}</span><span className="standing-score">{lowScore === null ? '—' : formatPoints(lowScore)}</span></div>
    })}</div></div></div><div className="standings-footnote">Points for is the league tiebreaker shown here.</div></section>
    <footer className="page-footer"><span>{leagueData.league.name} <span className="footer-dot">·</span> Season {leagueData.league.season}</span><span>Live stats from Sleeper <span className="footer-heart">♥</span></span></footer>
  </div>
}

function AwardCard({ award, featured = false }) {
  return <div className={`award-card ${award.color} ${featured ? 'award-featured' : ''}`}><div className="award-emoji">{award.icon}</div><div className="award-copy"><span className="award-title">{award.title}</span><strong>{award.winner}</strong><span className="award-detail">{award.detail}</span></div><ArrowRight size={15} className="award-arrow" /></div>
}

function buildAwards(weekData) {
  if (!weekData) return []
  const awards = []
  const addAward = (key, icon, title, winner, detail, color, coWinners = []) => {
    if (!winner) return
    const recipients = [winner, ...coWinners]
    awards.push({
      key, icon, title, winner: recipients.map((team) => team.team.name).join(' + '),
      person: recipients.map((team) => team.team.manager).join(' + '),
      teamName: recipients.map((team) => team.team.name).join(' + '),
      teamIds: recipients.map((team) => team.team.id),
      detail, color,
      recipientDetails: recipients.map((team) => ({ teamId: team.team.id, teamName: team.team.name, result: key === 'shootout' ? (team.points >= (team === weekData.highestCombined.home ? weekData.highestCombined.away.points : weekData.highestCombined.home.points) ? 'W' : 'L') : null })),
    })
  }
  addAward('point-press', '🏆', 'The Point Press', weekData.highScore, `Week high: ${formatPoints(weekData.highScore?.points)} points`, 'award-gold')
  const heartbreakMatchup = weekData.heartbreak && weekData.matchups?.find((matchup) => matchup.loser?.team.id === weekData.heartbreak.team.id)
  addAward('heartbreaker', '🫠', 'Heartbreaker', weekData.heartbreak, heartbreakMatchup ? `${formatPoints(weekData.heartbreak.points)}–${formatPoints(heartbreakMatchup.winner.points)} vs ${heartbreakMatchup.winner.team.name}` : `${formatPoints(weekData.heartbreak?.points)} points in a loss`, 'award-coral')
  const benchPlayerLeader = weekData.benchPlayerLeader || [...(weekData.teams || [])]
    .filter((team) => team.topBenchPlayer?.points > 0)
    .sort((a, b) => b.topBenchPlayer.points - a.topBenchPlayer.points)[0]
  if (benchPlayerLeader?.topBenchPlayer?.points > 0) {
    const player = benchPlayerLeader.topBenchPlayer
    addAward('bench-regret', '🪑', 'Benchwarmer’s Regret', benchPlayerLeader, `${player.name}: ${formatPoints(player.points)} points left on the bench`, 'award-blue')
  }
  addAward('nail-biter', '😮‍💨', 'Nail-Biter', weekData.closest?.winner, weekData.closest ? `Won by ${formatPoints(weekData.closest.margin)} points` : '', 'award-lilac')
  addAward('blowout', '💥', 'The Blowout', weekData.blowout?.winner, weekData.blowout ? WonBy(weekData.blowout.margin) : '', 'award-coral')
  if (weekData.oneManShow?.topStarter) {
    const share = Math.round((weekData.oneManShow.topStarter.points / weekData.oneManShow.points) * 100)
    addAward('one-man-show', '🦸', 'One-Man Show', weekData.oneManShow, `${weekData.oneManShow.topStarter.name}: ${formatPoints(weekData.oneManShow.topStarter.points)} · ${share}% of team points`, 'award-lilac')
  }
  if (weekData.doubleTrouble?.startersOverTwenty >= 2) addAward('double-trouble', '⚡', 'Double Trouble', weekData.doubleTrouble, `${weekData.doubleTrouble.startersOverTwenty} starters scored 20+`, 'award-gold')
  if (weekData.flexLeader?.flexPlayer) addAward('flex-appeal', '🧩', 'Flex Appeal', weekData.flexLeader, `${weekData.flexLeader.flexPlayer.name} dropped ${formatPoints(weekData.flexLeader.flexPlayer.points)} in the flex`, 'award-blue')
  if (weekData.kickerLeader?.kicker) addAward('kicker-therapy', '🦵', 'Kicker Therapy', weekData.kickerLeader, `${weekData.kickerLeader.kicker.name} put up ${formatPoints(weekData.kickerLeader.kicker.points)}`, 'award-coral')
  if (weekData.highestCombined) addAward('shootout', '🎆', 'Sunday Shootout', weekData.highestCombined.home, `${formatPoints(weekData.highestCombined.home.points + weekData.highestCombined.away.points)} combined points`, 'award-gold', [weekData.highestCombined.away])
  return awards
}

function WonBy(margin) {
  return `Won by ${formatPoints(margin)} points`
}

const awardCatalog = [
  { key: 'point-press', icon: '🏆', title: 'The Point Press', description: 'Highest team score of the week.' },
  { key: 'heartbreaker', icon: '🫠', title: 'Heartbreaker', description: 'Highest score in a losing matchup.' },
  { key: 'bench-regret', icon: '🪑', title: 'Benchwarmer’s Regret', description: 'Highest-scoring single player left on a bench.' },
  { key: 'nail-biter', icon: '😮‍💨', title: 'Nail-Biter', description: 'Winner of the closest matchup.' },
  { key: 'blowout', icon: '💥', title: 'The Blowout', description: 'Largest margin of victory.' },
  { key: 'one-man-show', icon: '🦸', title: 'One-Man Show', description: 'Largest share of team points from one starter.' },
  { key: 'double-trouble', icon: '⚡', title: 'Double Trouble', description: 'Most starters with 20 or more points.' },
  { key: 'flex-appeal', icon: '🧩', title: 'Flex Appeal', description: 'Highest score from a flex starter.' },
  { key: 'kicker-therapy', icon: '🦵', title: 'Kicker Therapy', description: 'Highest score from a starting kicker.' },
  { key: 'shootout', icon: '🎆', title: 'Sunday Shootout', description: 'Both teams in the highest-scoring matchup.' },
]

function buildAwardArchive(leagueData) {
  const teamsById = new Map(leagueData.standings.map((team) => [team.id, team]))
  const people = new Map()
  for (const team of leagueData.standings) {
    const id = String(team.managerId || team.id)
    if (!people.has(id)) people.set(id, { id, name: team.manager, teams: new Set(), avatar: team.avatar, avatarFallback: team.avatarFallback, total: 0 })
    people.get(id).teams.add(team.name)
  }

  const countsByAward = new Map(awardCatalog.map((award) => [award.key, new Map([...people.keys()].map((id) => [id, 0]))]))
  const eventsByAward = new Map(awardCatalog.map((award) => [award.key, new Map([...people.keys()].map((id) => [id, []]))]))
  const weeklyHistory = Object.entries(leagueData.weeks)
    .map(([weekNumber, weekData]) => ({ week: Number(weekNumber), weekData, awards: buildAwards(weekData) }))
    .sort((a, b) => b.week - a.week)

  for (const week of weeklyHistory) {
    for (const award of week.awards) {
      const recipients = new Set(award.teamIds.map((teamId) => String(teamsById.get(teamId)?.managerId || teamId)))
      for (const personId of recipients) {
        const person = people.get(personId)
        if (!person) continue
        person.total += 1
        countsByAward.get(award.key)?.set(personId, (countsByAward.get(award.key)?.get(personId) || 0) + 1)
        const teamIds = new Set(award.teamIds.filter((teamId) => String(teamsById.get(teamId)?.managerId || teamId) === personId))
        const recipientDetails = (award.recipientDetails || []).filter((recipient) => teamIds.has(recipient.teamId) && recipient.result)
        eventsByAward.get(award.key)?.get(personId)?.push({ week: week.week, detail: award.detail, teamName: award.teamName, recipientDetails })
      }
    }
  }

  const tallies = awardCatalog.map((award) => {
    const personCounts = [...people.values()].map((person) => ({
      ...person,
      teams: [...person.teams],
      count: countsByAward.get(award.key)?.get(person.id) || 0,
      events: eventsByAward.get(award.key)?.get(person.id) || [],
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    return { ...award, total: personCounts.reduce((total, person) => total + person.count, 0), people: personCounts }
  })
  const leaders = [...people.values()].map((person) => ({
    ...person,
    teams: [...person.teams],
    awardCounts: awardCatalog.map((award) => ({
      ...award,
      count: countsByAward.get(award.key)?.get(person.id) || 0,
    })).filter((award) => award.count > 0).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  return {
    weeks: weeklyHistory,
    tallies,
    leaders,
    totalAwards: weeklyHistory.reduce((total, week) => total + week.awards.length, 0),
  }
}

function AwardHistoryItem({ award }) {
  return <article className="history-award-item">
    <span className={`history-award-icon ${award.color}`}>{award.icon}</span>
    <div className="history-award-copy"><span className="history-award-title">{award.title}</span><strong>{award.teamName}</strong><span className="history-award-team">{award.person}</span><small>{award.detail}</small></div>
  </article>
}

function AwardsPage({ leagueData }) {
  const archive = buildAwardArchive(leagueData)
  const seasonWeeks = archive.weeks
  const [showAllLeaders, setShowAllLeaders] = useState(false)
  const decoratedLeaders = archive.leaders.filter((person) => person.total > 0)
  const records = [
    { icon: '🏆', title: 'Highest team score', result: seasonWeeks.map(({ week, weekData }) => ({ week, team: weekData.highScore, value: weekData.highScore?.points })).filter((item) => item.team).sort((a, b) => b.value - a.value)[0], format: (record) => `${formatPoints(record.value)} pts` },
    { icon: '😮‍💨', title: 'Closest finish', result: seasonWeeks.map(({ week, weekData }) => ({ week, matchup: weekData.closest, value: weekData.closest?.margin })).filter((item) => item.matchup).sort((a, b) => a.value - b.value)[0], format: (record) => `${formatPoints(record.value)} pts` },
    { icon: '🪙', title: 'Weakest win', result: seasonWeeks.flatMap(({ week, weekData }) => (weekData.matchups || []).map((matchup) => ({ week, team: matchup.winner, value: matchup.winner.points }))).filter((item) => item.team).sort((a, b) => a.value - b.value)[0], format: (record) => `${formatPoints(record.value)} pts` },
    { icon: '💥', title: 'Biggest blowout', result: seasonWeeks.map(({ week, weekData }) => ({ week, matchup: weekData.blowout, value: weekData.blowout?.margin })).filter((item) => item.matchup).sort((a, b) => b.value - a.value)[0], format: (record) => `${formatPoints(record.value)} pts` },
    { icon: '🪑', title: 'Highest-scoring benched player', result: seasonWeeks.map(({ week, weekData }) => ({ week, team: weekData.benchPlayerLeader, value: weekData.benchPlayerLeader?.topBenchPlayer?.points, player: weekData.benchPlayerLeader?.topBenchPlayer?.name })).filter((item) => item.team).sort((a, b) => b.value - a.value)[0], format: (record) => `${record.player} · ${formatPoints(record.value)} pts` },
    { icon: '🌟', title: 'Highest-scoring rostered player', result: seasonWeeks.flatMap(({ week, weekData }) => (weekData.teams || []).flatMap((team) => (team.rosteredPlayers || []).map((player) => ({ week, team, player, value: player.points })))).filter((item) => item.value > 0).sort((a, b) => b.value - a.value)[0], format: (record) => `${record.player.name} · ${formatPoints(record.value)} pts` },
  ].filter((record) => record.result)

  return <div className="page-content awards-page">
    <div className="awards-page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {leagueData.league.season} SEASON <span className="eyebrow-sun">✳</span> THE TROPHY CASE</div><h1>Awards &amp; records</h1><p className="welcome-subtitle">Every weekly win, every questionable lineup call, all on the record.</p></div><div className="award-season-stamp"><Trophy size={21} /><span>{leagueData.league.season}</span><small>SEASON</small></div></div>

    <section className="panel decorated-leaders-panel"><div className="panel-heading"><div><div className="section-kicker">SEASON-TO-DATE AWARD COUNTS</div><h3>Most decorated this season</h3></div></div><div className="decorated-leaders-list">{decoratedLeaders.slice(0, showAllLeaders ? decoratedLeaders.length : 3).map((person, index) => <details className={`decorated-person-details ${index === 0 ? 'decorated-leader-first' : ''}`} key={person.id}><summary className="decorated-leader"><span className="decorated-rank">{String(index + 1).padStart(2, '0')}</span><Avatar initials={person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()} src={person.avatar} fallbackSrc={person.avatarFallback} small color="#c8e4b8" /><span className="decorated-person"><strong>{person.teams.join(', ')}</strong><small>{person.name}</small></span><strong className="decorated-total">{person.total}<small> awards</small></strong><ChevronDown size={15} className="decorated-chevron" /></summary><div className="member-award-breakdown">{person.awardCounts.map((award) => <div className="member-award-count" key={award.key}><span>{award.icon}</span><span className="member-award-copy"><strong>{award.title}</strong><small>{award.description}</small></span><b>{award.count}</b></div>)}</div></details>)}</div>{decoratedLeaders.length > 3 && <button type="button" className="decorated-leaders-toggle" aria-expanded={showAllLeaders} onClick={() => setShowAllLeaders((show) => !show)}>{showAllLeaders ? 'Show top 3' : `Show all ${decoratedLeaders.length}`}<ChevronDown size={15} className={showAllLeaders ? 'decorated-toggle-open' : ''} /></button>}</section>

    <section className="season-records-section"><div className="award-section-heading"><div><div className="section-kicker">{leagueData.league.season} SEASON TO DATE</div><h2>Season records</h2></div></div><div className="season-record-grid">{records.map((record) => {
      const recipient = record.result.team
      const who = record.result.matchup ? `${record.result.matchup.home.team.name} vs ${record.result.matchup.away.team.name}` : recipient?.team?.name || 'League record'
      return <article className="season-record-card" key={record.title}><span className="record-card-icon">{record.icon}</span><span className="record-card-title">{record.title}</span><strong>{record.format(record.result)}</strong><span className="record-card-holder">{who}</span><small>Week {record.result.week}</small></article>
    })}</div></section>

    <section className="award-tallies-section"><div className="award-section-heading"><div><div className="section-kicker">EVERY CATEGORY, EVERY RECIPIENT</div><h2>Award tallies</h2></div><p>Open an award to see each recipient’s wins and the details for each week.</p></div><div className="award-tally-grid">{archive.tallies.filter((award) => award.total > 0).map((award) => <details className="award-tally-card" key={award.key}><summary><span className="tally-award-emoji">{award.icon}</span><span className="tally-award-main"><strong>{award.title}</strong><small>{award.description}</small></span><ChevronDown size={16} className="tally-chevron" /></summary><div className="tally-recipients">{award.people.filter((person) => person.count > 0).map((person, index) => <div className="tally-recipient" key={person.id}><span className="tally-recipient-rank">{String(index + 1).padStart(2, '0')}</span><div className="tally-recipient-info"><strong>{person.teams.join(', ')}</strong><small>{person.name}</small><ul className="tally-recipient-events">{person.events.map((event, eventIndex) => <li key={`${event.week}-${eventIndex}`}><b>Week {event.week}:</b> {event.recipientDetails?.length ? `${event.recipientDetails.map(({ result }) => `(${result})`).join(', ')} · ` : ''}{event.detail}</li>)}</ul></div><b>{person.count}</b></div>)}</div></details>)}</div></section>

    <section className="week-history-section"><div className="award-section-heading"><div><div className="section-kicker">THE WEEKLY HARDWARE</div><h2>Current &amp; past awards</h2></div><p>Live-week awards may change as Sleeper updates scores.</p></div><div className="week-history-list">{archive.weeks.map(({ week, weekData, awards }) => <details className="week-history-card" open={week === leagueData.currentWeek} key={week}><summary><span className="week-history-number">WEEK {String(week).padStart(2, '0')}</span><span className={`week-history-status ${weekData.isLive ? 'history-status-live' : ''}`}>{weekData.isLive ? 'LIVE' : 'FINAL'}</span><span className="week-history-count">{awards.length} awards</span><ChevronDown size={17} className="week-history-chevron" /></summary><div className="week-history-awards">{awards.map((award) => <AwardHistoryItem key={`${week}-${award.key}`} award={award} />)}{awards.length === 0 && <div className="week-no-awards">No matchup awards available for this week yet.</div>}</div></details>)}</div></section>
    <p className="award-method-note">Awards are calculated from Sleeper matchup and player scores. Current-week totals are provisional until scoring is final.</p>
  </div>
}

function App() {
  const [active, setActive] = useState('League HQ')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(null)
  const confirmRegenerateButton = useRef(null)
  const [savedRecap, setSavedRecap] = useState(null)
  const [selectedRecapIndex, setSelectedRecapIndex] = useState(0)
  const [bannerCopy, setBannerCopy] = useState(null)
  const [loadingBannerCopy, setLoadingBannerCopy] = useState(false)
  const [recapError, setRecapError] = useState('')
  const [generatingRecap, setGeneratingRecap] = useState(false)
  const [recapProgressStep, setRecapProgressStep] = useState(0)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [leagueData, setLeagueData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshAttempt, setRefreshAttempt] = useState(0)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('sunday-club-theme') === 'dark' } catch { return false }
  })
  const [favoriteTeamCode, setFavoriteTeamCode] = useState(() => {
    try { return localStorage.getItem('sunday-club-favorite-team') || 'GB' } catch { return 'GB' }
  })
  const favoriteTeam = teamThemes.find((team) => team.code === favoriteTeamCode) || teamThemes.find((team) => team.code === 'GB')
  const changeFavoriteTeam = (code) => {
    setFavoriteTeamCode(code)
    try { localStorage.setItem('sunday-club-favorite-team', code) } catch { /* Keep the selection for this session if storage is unavailable. */ }
  }
  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current
      try { localStorage.setItem('sunday-club-theme', next ? 'dark' : 'light') } catch { /* Keep the mode for this session if storage is unavailable. */ }
      return next
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    let activeRequest = true
    const load = async () => {
      setLoading(true)
      try {
        const nextData = await fetchLeagueDashboard(controller.signal)
        if (activeRequest) {
          setLeagueData(nextData)
          setLoadError('')
        }
      } catch (error) {
        if (activeRequest && error.name !== 'AbortError') setLoadError('Sleeper data could not be loaded. Check your connection and try again.')
      } finally {
        if (activeRequest) setLoading(false)
      }
    }
    load()
    const refreshTimer = window.setInterval(load, 5 * 60 * 1000)
    return () => {
      activeRequest = false
      controller.abort()
      window.clearInterval(refreshTimer)
    }
  }, [refreshAttempt])

  const week = leagueData ? Math.min(selectedWeek || leagueData.currentWeek, leagueData.currentWeek) : null
  const weekData = week ? leagueData?.weeks?.[week] : null
  const currentBannerCopy = bannerCopy?.key === (leagueData && week ? `sunday-club-banner-copy-${leagueData.league.id}-${leagueData.league.season}-${week}` : null) ? bannerCopy : null
  const awards = buildAwards(weekData)
  const recapStorageKey = leagueData && week ? `sunday-club-recap-${leagueData.league.id}-${leagueData.league.season}-${week}` : null
  useEffect(() => {
    if (!generatingRecap) { setRecapProgressStep(0); return }
    const timer = window.setInterval(() => setRecapProgressStep((step) => (step + 1) % 3), 2200)
    return () => window.clearInterval(timer)
  }, [generatingRecap])
  const bannerCopyStorageKey = leagueData && week ? `sunday-club-banner-copy-${leagueData.league.id}-${leagueData.league.season}-${week}` : null
  useEffect(() => {
    if (!bannerCopyStorageKey || !weekData) return
    let activeRequest = true
    const loadOrGenerateCopy = async () => {
      setBannerCopy(null)
      let cachedCopy = null
      try { cachedCopy = JSON.parse(localStorage.getItem(bannerCopyStorageKey) || 'null') } catch { cachedCopy = null }
      if (cachedCopy?.headline && cachedCopy?.subtitle) {
        setBannerCopy({ key: bannerCopyStorageKey, ...cachedCopy })
        setLoadingBannerCopy(false)
        return
      }
      if (!weekData.highScore) {
        setLoadingBannerCopy(false)
        return
      }
      setLoadingBannerCopy(true)
      try {
        const response = await fetch('/api/generate-week-copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ season: leagueData.league.season, week, highScore: weekData.highScore, closest: weekData.closest }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Weekly copy generation failed.')
        if (!activeRequest) return
        const copy = body.copy
        try { localStorage.setItem(bannerCopyStorageKey, JSON.stringify(copy)) } catch { /* Keep generated copy available for this session if storage is unavailable. */ }
        setBannerCopy({ key: bannerCopyStorageKey, ...copy })
      } catch {
        if (!activeRequest) return
        const fallback = {
          headline: weekData.closest ? 'Big scores. Close finishes.' : `${weekData.highScore.team.name} sets the pace.`,
          subtitle: `${formatPoints(weekData.highScore.points)} points led the week${weekData.closest ? `; the closest matchup came down to ${weekData.closest.margin.toFixed(1)}` : ''}.`,
        }
        setBannerCopy({ key: bannerCopyStorageKey, ...fallback })
      } finally {
        if (activeRequest) setLoadingBannerCopy(false)
      }
    }
    loadOrGenerateCopy()
    return () => { activeRequest = false }
  }, [bannerCopyStorageKey, weekData, leagueData?.league?.season, week])
  useEffect(() => {
    if (!recapStorageKey) return
    setSelectedRecapIndex(0)
    try { setSavedRecap(JSON.parse(localStorage.getItem(recapStorageKey) || 'null')) } catch { setSavedRecap(null) }
    setRecapError('')
  }, [recapStorageKey])
  useEffect(() => {
    if (!confirmRegenerate) return
    confirmRegenerateButton.current?.focus()
    const closeOnEscape = (event) => { if (event.key === 'Escape') setConfirmRegenerate(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [confirmRegenerate])
  const generateRecap = async ({ targetIndex = null, confirmed = false } = {}) => {
    if (generatingRecap || !weekData?.matchups?.length) return
    if (savedRecap && !confirmed) { setConfirmRegenerate({ targetIndex }); return }
    setConfirmRegenerate(null)
    setGeneratingRecap(true)
    setRecapError('')
    try {
      const allMatchups = weekData.matchups.map(({ home, away, margin }) => ({
        home: { name: home.team.name, manager: home.team.manager, score: home.points, starters: [...home.starters].sort((a, b) => b.points - a.points).slice(0, 4).map(({ name, position, points }) => ({ name, position, points })), bench: (home.benchPlayers || []).slice(0, 4).map(({ name, position, points }) => ({ name, position, points })), eligibleBenchUpgrades: home.eligibleBenchUpgrades || [] },
        away: { name: away.team.name, manager: away.team.manager, score: away.points, starters: [...away.starters].sort((a, b) => b.points - a.points).slice(0, 4).map(({ name, position, points }) => ({ name, position, points })), bench: (away.benchPlayers || []).slice(0, 4).map(({ name, position, points }) => ({ name, position, points })), eligibleBenchUpgrades: away.eligibleBenchUpgrades || [] },
        margin,
      }))
      const matchups = targetIndex === null ? allMatchups : [allMatchups[targetIndex]]
      const response = await fetch('/api/generate-recap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ season: leagueData.league.season, week, matchups }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Recap generation failed.')
      const recaps = targetIndex === null
        ? body.recaps
        : (savedRecap?.recaps || []).map((recap, index) => index === targetIndex ? body.recaps[0] : recap)
      const result = { generatedAt: new Date().toISOString(), recaps }
      setSavedRecap(result)
      if (recapStorageKey) localStorage.setItem(recapStorageKey, JSON.stringify(result))
      if (!savedRecap) document.getElementById('weekly-recap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (error) {
      setRecapError(error.message || 'Recap generation failed. Check your connection and try again.')
    } finally { setGeneratingRecap(false) }
  }
  return <div className="app-shell" data-theme={darkMode ? 'dark' : 'light'} style={{ '--team-primary': favoriteTeam.primary, '--team-accent': favoriteTeam.accent }}>
    <Sidebar active={active} setActive={setActive} open={menuOpen} onClose={() => setMenuOpen(false)} favoriteTeam={favoriteTeam} onFavoriteTeamChange={changeFavoriteTeam} league={leagueData?.league} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
    <main className="main-area">
      <Header onMenu={() => setMenuOpen(true)} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} favoriteTeam={favoriteTeam} onFavoriteTeamChange={changeFavoriteTeam} />
      {loading && !leagueData && <div className="api-state"><LoaderCircle size={22} className="loading-spinner" /><strong>Loading your Sleeper league…</strong><span>Pulling standings and matchup data.</span></div>}
      {loadError && !leagueData && <div className="api-state api-error"><strong>Couldn’t load this league</strong><span>{loadError}</span><button className="generate-button" onClick={() => setRefreshAttempt((value) => value + 1)}><RefreshCw size={15} /> Try again</button></div>}
      {leagueData && weekData && (active === 'Awards & records' ? <AwardsPage leagueData={leagueData} /> : active === 'Matchups' ? <MatchupsPage leagueData={leagueData} week={week} weekData={weekData} onWeekChange={setSelectedWeek} /> : active === 'Standings' ? <StandingsPage leagueData={leagueData} /> : <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> {leagueData.league.season} SEASON <span className="eyebrow-sun">✳</span> WEEK {week}</div><h1>Week {week}, in focus <span className="wave">✦</span></h1><p className="welcome-subtitle">{weekData.isLive ? 'Live scores are rolling in across the league.' : 'The league has entered its “every point matters” era.'}</p></div><WeekPicker weeks={leagueData.weeks} week={week} currentWeek={leagueData.currentWeek} lastCompletedWeek={leagueData.lastCompletedWeek} onChange={setSelectedWeek} /></div>
        <section className="featured-banner"><div className="banner-grain" /><div className="banner-content"><div className="live-label"><span /> WEEK {week} {weekData.isLive ? 'LIVE' : 'RECAP'} <span className="label-separator">/</span> {weekData.isLive ? 'IN PROGRESS' : 'FINAL'}</div><h2>{currentBannerCopy?.headline || (loadingBannerCopy ? 'Writing this week’s headline…' : 'The week is taking shape.')}</h2><p aria-live="polite">{currentBannerCopy?.subtitle || (loadingBannerCopy ? 'Pulling together the biggest score and closest finish.' : 'Matchup scores are not available for this week yet.')}</p><button className="banner-button" onClick={() => document.getElementById('weekly-recap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Read this week’s recap <ArrowRight size={15} /></button></div><div className="banner-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="banner-ball">🏈</div><div className="art-star star-one">✳</div><div className="art-star star-two">✦</div><div className="art-score"><span>WEEK HIGH</span><strong>{weekData.highScore ? formatPoints(weekData.highScore.points) : '—'}</strong><small>PTS</small></div><div className="banner-sticker">{weekData.isLive ? 'LIVE\nSCORES' : 'WEEK\nWINNER'}</div></div><div className="banner-index">{String(week).padStart(2, '0')} <span>—</span> {String(leagueData.currentWeek).padStart(2, '0')}</div></section>

        <section className="weekly-recap panel" id="weekly-recap">
          <div className="panel-heading"><div><div className="section-kicker">THE SUNDAY EDITION</div><h3>Week {week} matchup recaps</h3></div>{savedRecap && <span className="saved-tag">SAVED</span>}</div>
          {weekData.matchups.length > 0 && <RecapMatchupPicker matchups={weekData.matchups} selectedIndex={selectedRecapIndex} week={week} onSelect={setSelectedRecapIndex} />}
          {recapError && <p className="recap-error" role="alert">{recapError}</p>}
          {savedRecap?.recaps?.length ? <div className="recap-list">{savedRecap.recaps.map((recap, index) => { if (index !== selectedRecapIndex) return null; const matchup = weekData.matchups[index]; if (!matchup) return null; const hasLegacyCopy = hasRecapText(recap.segments) || (typeof recap.text === 'string' && recap.text.trim()); return <article className="recap-card" key={`${matchup.home.team.name}-${matchup.away.team.name}-${index}`}><div className="recap-card-heading"><strong>{matchup.home.team.name}</strong><span>{formatPoints(matchup.home.points)} <i>—</i> {formatPoints(matchup.away.points)}</span><strong>{matchup.away.team.name}</strong></div>{isCompleteStructuredRecap(recap) ? <><div className="recap-result"><RecapSegments segments={recap.result} /></div><div className="recap-team-stories"><section className="recap-team-story"><h4>{matchup.home.team.name}<span>{formatPoints(matchup.home.points)}</span></h4><p><RecapSegments segments={recap.homeStory} /></p></section><section className="recap-team-story"><h4>{matchup.away.team.name}<span>{formatPoints(matchup.away.points)}</span></h4><p><RecapSegments segments={recap.awayStory} /></p></section></div>{isVerifiedBenchNote(recap.benchNote, matchup) && <aside className="recap-bench-note"><span>BENCH REGRET</span><p><RecapSegments segments={recap.benchNote} /></p></aside>}<p className="recap-punchline"><Sparkles size={13} /><span className="recap-punchline-text"><RecapSegments segments={recap.punchline} /></span></p></> : hasLegacyCopy ? <RecapCopy recap={recap} /> : <RecapFallback matchup={matchup} isLive={weekData.isLive} />}<button className="recap-retry-button" onClick={() => generateRecap({ targetIndex: index })} disabled={generatingRecap} aria-label={`Regenerate recap for ${matchup.home.team.name} vs ${matchup.away.team.name}`}><RefreshCw size={13} /><span>{generatingRecap ? 'Generating…' : 'Regenerate'}</span></button></article> })}</div> : <div className={`recap-empty ${generatingRecap ? 'recap-empty-generating' : ''}`} aria-live="polite" aria-busy={generatingRecap}><div className="recap-empty-icon">{generatingRecap ? <LoaderCircle size={22} className="loading-spinner" /> : <Sparkles size={19} />}</div><p key={generatingRecap ? `progress-${recapProgressStep}` : 'idle'}>{weekData.matchups.length ? (generatingRecap ? ['Reading the box scores…', 'Finding the week’s biggest moments…', 'Writing the matchup stories…'][recapProgressStep] : 'Generate a witty, stats-rich recap for every matchup this week.') : 'Recaps will be available when matchups have scoring data.'}</p>{generatingRecap && <div className="recap-progress-track" aria-hidden="true"><span /></div>}<button className="generate-button" onClick={() => generateRecap()} disabled={generatingRecap || !weekData.matchups.length}><Sparkles size={14} />{generatingRecap ? 'Generating…' : 'Generate recap'}</button></div>}
        </section>

        <section className="stats-grid" aria-label="League highlights"><StatCard icon={Trophy} label="Weekly high score" value={weekData.highScore ? formatPoints(weekData.highScore.points) : '—'} note={weekData.highScore?.team.name || 'No scores yet'} /><StatCard icon={Flame} label="Closest matchup" value={weekData.closest ? `${formatPoints(weekData.closest.margin)} pts` : '—'} note={weekData.closest?.winner.team.name || 'No matchup yet'} /><StatCard icon={Gauge} label="League average" value={formatPoints(weekData.average)} note={`${leagueData.league.teamCount} teams this week`} /><StatCard icon={Shield} label="Highest scoring player" value={weekData.highestScoringPlayer ? `${formatPoints(weekData.highestScoringPlayer.points)} pts` : '—'} note={weekData.highestScoringPlayer ? `${weekData.highestScoringPlayer.name} · ${weekData.highestScoringPlayer.team.name}` : 'No player scores yet'} /></section>

        <div className="dashboard-grid">
          <div className="left-column">
            <section className="panel trend-panel"><div className="panel-heading"><div><div className="section-kicker">THE BIG PICTURE</div><h3>Scoring trends</h3></div><span className="select-pill">{leagueData.league.season} season</span></div><div className="trend-summary"><strong>Team high score</strong><span><i /> Average score by week</span></div><TrendChart darkMode={darkMode} data={leagueData.trend} average={weekData.average} /><div className="chart-footer"><span><span className="legend-dot green-dot" /> Team high</span><span><span className="legend-dash" /> League average</span><span className="trend-footnote">{leagueData.trend.length} weeks</span></div></section>
          </div>
          <div className="right-column">
            <section className="panel awards-panel"><div className="panel-heading"><div><div className="section-kicker">THE HARDWARE</div><h3>Week {week} awards <span className="award-count">{String(awards.length).padStart(2, '0')}</span></h3></div></div><div className="award-list">{awards.slice(0, 4).map((award, index) => <AwardCard award={award} featured={index === 0} key={award.title} />)}</div><button className="standings-link" onClick={() => setActive('Awards & records')}>All awards &amp; records <ArrowRight size={14} /></button><div className="awards-foot"><Sparkles size={14} /><span>Calculated from Sleeper matchup scores.</span></div></section>
          </div>
        </div>
        <footer className="page-footer"><span>{leagueData.league.name} <span className="footer-dot">·</span> Season {leagueData.league.season}</span><span>Live stats from Sleeper <span className="footer-heart">♥</span></span></footer>
      </div>)}
    </main>
    <MobileTabBar active={active} setActive={setActive} />
    {confirmRegenerate && <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmRegenerate(null) }}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-regenerate-title" aria-describedby="confirm-regenerate-copy"><div className="confirm-icon"><Sparkles size={19} /></div><div className="modal-kicker">WEEK {week} · THE SUNDAY EDITION</div><h2 id="confirm-regenerate-title">{confirmRegenerate.targetIndex === null ? <>Give this recap<br /><em>a fresh take?</em></> : <>Rewrite this matchup<br /><em>recap?</em></>}</h2><p id="confirm-regenerate-copy">{confirmRegenerate.targetIndex === null ? `Your saved Week ${week} recaps will all be replaced.` : `The recap for ${weekData.matchups[confirmRegenerate.targetIndex]?.home.team.name} vs ${weekData.matchups[confirmRegenerate.targetIndex]?.away.team.name} will be replaced. Your other recaps will stay as they are.`}</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setConfirmRegenerate(null)}>Keep current recap</button><button ref={confirmRegenerateButton} className="generate-button" onClick={() => generateRecap({ targetIndex: confirmRegenerate.targetIndex, confirmed: true })}><Sparkles size={14} /> Regenerate {confirmRegenerate.targetIndex === null ? 'all' : 'recap'}</button></div></section></div>}
  </div>
}

export default App
