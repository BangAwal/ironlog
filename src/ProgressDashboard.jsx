import React, { useMemo, useState } from 'react';
import { Activity, BarChart3, CalendarDays, Dumbbell, TrendingUp } from 'lucide-react';
import './progress-dashboard.css';

// Exercise-to-muscle mapping for analytics. Primary muscles drive the main charts;
// secondary muscles are shown separately as supporting involvement, not double-counted.
const EXERCISE_MUSCLES = {
  'Incline Smith Machine Press': ['Chest', ['Shoulders', 'Triceps']],
  'Flat Dumbbell Bench Press': ['Chest', ['Shoulders', 'Triceps']],
  'Machine Chest Press': ['Chest', ['Shoulders', 'Triceps']],
  'Dumbbell Incline Fly': ['Chest', ['Shoulders']],
  'Dumbbell Bent-Over Row': ['Back', ['Biceps', 'Shoulders']],
  'Chest-Supported Row': ['Back', ['Biceps', 'Shoulders']],
  'Seated Cable Row': ['Back', ['Biceps', 'Shoulders']],
  'Single-Arm Cable Row': ['Back', ['Biceps', 'Shoulders']],
  'Lat Pulldown': ['Back', ['Biceps']],
  'Neutral-Grip Lat Pulldown': ['Back', ['Biceps']],
  'Cable Lateral Raise': ['Shoulders', []],
  'Dumbbell Lateral Raise': ['Shoulders', []],
  'Reverse Pec Deck': ['Shoulders', ['Back']],
  'Seated Dumbbell Shoulder Press': ['Shoulders', ['Triceps']],
  'Rope Triceps Pushdown': ['Triceps', []],
  'Cable Triceps Pushdown': ['Triceps', []],
  'Overhead Cable Triceps Extension': ['Triceps', []],
  'Preacher Curl': ['Biceps', []],
  'EZ-Bar Preacher Curl': ['Biceps', []],
  'Incline Dumbbell Curl': ['Biceps', []],
  'Hammer Curl': ['Biceps', ['Forearms']],
  'Dumbbell Curl': ['Biceps', []],
  'Barbell Back Squat': ['Quads', ['Glutes']],
  'Hack Squat': ['Quads', ['Glutes']],
  'Leg Press': ['Quads', ['Glutes']],
  'Leg Extension': ['Quads', []],
  'Bulgarian Split Squat': ['Quads', ['Glutes']],
  'Romanian Deadlift': ['Hamstrings', ['Glutes']],
  'Seated Leg Curl': ['Hamstrings', []],
  'Standing Calf Raise': ['Calves', []],
  'Seated Calf Raise': ['Calves', []],
  'Barbell Hip Thrust': ['Glutes', ['Hamstrings']],
  'Hip Thrust': ['Glutes', ['Hamstrings']],
  'Hip Abduction Machine': ['Glutes', []],
  'Cable Glute Kickback': ['Glutes', []],
  'Cable Crunch': ['Core', []],
  'Hanging Knee Raise': ['Core', []],
  'Reverse Crunch': ['Core', []],
  'Plank': ['Core', []],
};

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
const PERIODS = [
  { label: '4 weeks', days: 28 },
  { label: '8 weeks', days: 56 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: 'All time', days: null },
];
const number = value => Number(value) || 0;
const sessionDate = session => {
  const value = session.date || session.startedAt;
  return value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
};
const dateKey = date => date.toISOString().slice(0, 10);
const formatShortDate = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const getExerciseMuscles = name => EXERCISE_MUSCLES[name] || ['Other', []];

function buildWeeks(sessions, days) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = days
    ? new Date(today.getTime() - (days - 1) * 86400000)
    : sessions.reduce((earliest, session) => {
        const date = sessionDate(session);
        return date && (!earliest || date < earliest) ? date : earliest;
      }, today);
  const firstMonday = new Date(start);
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
  const weeks = [];
  for (let cursor = new Date(firstMonday); cursor <= today; cursor.setDate(cursor.getDate() + 7)) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    weeks.push({
      key: dateKey(weekStart),
      label: formatShortDate(weekStart),
      start: weekStart,
      end: weekEnd,
      sets: 0,
      volume: 0,
      muscles: Object.fromEntries(MUSCLES.map(muscle => [muscle, { sets: 0, volume: 0 }])) ,
    });
  }
  return weeks;
}

function LineChart({ weeks, muscle, metric }) {
  const width = 640;
  const height = 230;
  const left = 38;
  const right = 14;
  const top = 18;
  const bottom = 36;
  const values = weeks.map(week => muscle === 'All muscles'
    ? week[metric]
    : week.muscles[muscle]?.[metric] || 0
  );
  const max = Math.max(1, ...values);
  const x = index => left + (weeks.length <= 1 ? 0 : index * (width - left - right) / (weeks.length - 1));
  const y = value => top + (height - top - bottom) * (1 - value / max);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `${left},${height - bottom} ${points} ${x(Math.max(0, weeks.length - 1))},${height - bottom}`;
  const ticks = [0, Math.ceil(max / 2), max];

  if (!weeks.length) return <div className="progress-empty">Not enough date information to draw a trend yet.</div>;
  return (
    <div className="progress-chart-wrap">
      <svg className="progress-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric === 'sets' ? 'Completed sets' : 'Training volume'} trend for ${muscle}`}>
        {ticks.map((tick, index) => (
          <g key={`${tick}-${index}`}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="chart-gridline" />
            <text x={left - 9} y={y(tick) + 4} textAnchor="end" className="chart-axis-label">{Math.round(tick).toLocaleString()}</text>
          </g>
        ))}
        <polygon points={area} className="chart-area" />
        <polyline points={points} className="chart-line" />
        {values.map((value, index) => <circle key={weeks[index].key} cx={x(index)} cy={y(value)} r="3.5" className="chart-point"><title>{weeks[index].label}: {value.toLocaleString()}</title></circle>)}
        {weeks.map((week, index) => (index === 0 || index === weeks.length - 1 || index % Math.ceil(weeks.length / 4) === 0) && (
          <text key={week.key} x={x(index)} y={height - 10} textAnchor="middle" className="chart-axis-label">{week.label}</text>
        ))}
      </svg>
    </div>
  );
}

export default function ProgressDashboard({ sessions, profile }) {
  const [period, setPeriod] = useState('8 weeks');
  const [metric, setMetric] = useState('sets');
  const [selectedMuscle, setSelectedMuscle] = useState('All muscles');
  const [detailMuscle, setDetailMuscle] = useState('Chest');
  const periodConfig = PERIODS.find(item => item.label === period) || PERIODS[1];

  const analytics = useMemo(() => {
    const now = new Date();
    const cutoff = periodConfig.days ? new Date(now.getTime() - (periodConfig.days - 1) * 86400000) : null;
    const filtered = sessions.filter(session => {
      const date = sessionDate(session);
      return date && (!cutoff || date >= new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate()));
    });
    const groups = Object.fromEntries(MUSCLES.map(muscle => [muscle, {
      muscle, sets: 0, volume: 0, sessions: new Set(), lastTrained: null, exercises: {},
    }]));
    const weeks = buildWeeks(filtered, periodConfig.days);

    filtered.forEach(session => {
      const date = sessionDate(session);
      if (!date) return;
      const week = weeks.find(item => date >= item.start && date <= item.end);
      (session.sets || []).filter(set => set.done).forEach(set => {
        const [primary, secondary] = getExerciseMuscles(set.exercise);
        if (!groups[primary]) return;
        const weight = number(set.weight);
        const reps = number(set.reps);
        const volume = weight * reps;
        const group = groups[primary];
        group.sets += 1;
        group.volume += volume;
        group.sessions.add(session.id);
        if (!group.lastTrained || date > group.lastTrained) group.lastTrained = date;
        if (!group.exercises[set.exercise]) group.exercises[set.exercise] = { name: set.exercise, sets: 0, volume: 0, bestWeight: 0, bestReps: 0, lastTrained: null };
        const exercise = group.exercises[set.exercise];
        exercise.sets += 1;
        exercise.volume += volume;
        exercise.bestWeight = Math.max(exercise.bestWeight, weight);
        exercise.bestReps = Math.max(exercise.bestReps, reps);
        if (!exercise.lastTrained || date > exercise.lastTrained) exercise.lastTrained = date;
        if (week) {
          week.sets += 1;
          week.volume += volume;
          week.muscles[primary].sets += 1;
          week.muscles[primary].volume += volume;
        }
      });
    });

    const rows = Object.values(groups).map(group => ({
      ...group,
      sessions: group.sessions.size,
      exercises: Object.values(group.exercises).sort((a, b) => b.volume - a.volume),
    }));
    const totalSets = rows.reduce((sum, row) => sum + row.sets, 0);
    const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
    const totalSessions = new Set(filtered.map(session => session.id)).size;
    const activeDays = new Set(filtered.map(session => sessionDate(session)?.toDateString()).filter(Boolean)).size;
    return { rows, weeks, totalSets, totalVolume, totalSessions, activeDays, filtered };
  }, [sessions, periodConfig.days]);

  const selectedDetail = analytics.rows.find(row => row.muscle === detailMuscle) || analytics.rows[0];
  const topMuscles = [...analytics.rows].sort((a, b) => b.sets - a.sets);
  const maxSets = Math.max(1, ...topMuscles.map(row => row.sets));
  const detailExercises = selectedDetail?.exercises || [];
  const previousPeriodSets = useMemo(() => {
    if (!periodConfig.days) return null;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - periodConfig.days, 23, 59, 59, 999);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (periodConfig.days * 2 - 1));
    return sessions.reduce((sum, session) => {
      const date = sessionDate(session);
      if (!date || date < start || date > end) return sum;
      return sum + (session.sets || []).filter(set => set.done && MUSCLES.includes(getExerciseMuscles(set.exercise)[0])).length;
    }, 0);
  }, [sessions, periodConfig.days]);
  const trendLabel = previousPeriodSets === null ? 'All recorded time' : previousPeriodSets === 0 ? 'No sets in previous period' : `${analytics.totalSets >= previousPeriodSets ? '+' : ''}${Math.round((analytics.totalSets - previousPeriodSets) / previousPeriodSets * 100)}% vs previous period`;

  return (
    <div className="progress-dashboard">
      <div className="progress-toolbar">
        <div className="progress-periods" aria-label="Progress date range">
          {PERIODS.map(item => <button key={item.label} className={period === item.label ? 'selected' : ''} onClick={() => setPeriod(item.label)}>{item.label}</button>)}
        </div>
      </div>

      <section className="progress-overview-grid">
        <div className="progress-overview-card"><span><Dumbbell size={16} /> Sessions</span><strong>{analytics.totalSessions}</strong><small>Completed workouts</small></div>
        <div className="progress-overview-card"><span><Activity size={16} /> Working sets</span><strong>{analytics.totalSets}</strong><small>{trendLabel}</small></div>
        <div className="progress-overview-card"><span><BarChart3 size={16} /> Total volume</span><strong>{Math.round(analytics.totalVolume).toLocaleString()} <i>kg</i></strong><small>Weight × reps</small></div>
        <div className="progress-overview-card"><span><CalendarDays size={16} /> Active days</span><strong>{analytics.activeDays}</strong><small>Days with completed workouts</small></div>
      </section>

      <section className="panel progress-panel">
        <div className="progress-section-heading"><div><h3>Muscle group trends</h3><p className="muted small">Track how your training changes week by week.</p></div></div>
        <div className="progress-chart-controls">
          <div className="progress-segmented"><button className={metric === 'sets' ? 'selected' : ''} onClick={() => setMetric('sets')}>Completed sets</button><button className={metric === 'volume' ? 'selected' : ''} onClick={() => setMetric('volume')}>Volume (kg)</button></div>
          <select value={selectedMuscle} onChange={event => setSelectedMuscle(event.target.value)} aria-label="Select muscle group for trend"><option>All muscles</option>{MUSCLES.map(muscle => <option key={muscle}>{muscle}</option>)}</select>
        </div>
        <LineChart weeks={analytics.weeks} muscle={selectedMuscle} metric={metric} />
        <p className="progress-chart-note">{selectedMuscle === 'All muscles' ? 'All primary muscle groups combined. Each completed set is counted once.' : `${selectedMuscle} primary-muscle sets only.`} {metric === 'volume' ? 'Volume is calculated as weight × reps for completed sets with recorded values.' : 'Only completed working sets are counted.'}</p>
      </section>

      <section className="panel progress-panel">
        <div className="progress-section-heading"><div><h3>Muscle group breakdown</h3><p className="muted small">Compare training distribution for the selected period.</p></div></div>
        <div className="muscle-breakdown-list">
          {topMuscles.map(row => (
            <button className={`muscle-breakdown-row ${detailMuscle === row.muscle ? 'active' : ''}`} key={row.muscle} onClick={() => setDetailMuscle(row.muscle)}>
              <span className="muscle-breakdown-name">{row.muscle}</span>
              <span className="muscle-bar-track"><span style={{ width: `${row.sets / maxSets * 100}%` }} /></span>
              <strong>{row.sets}</strong><small>sets</small>
            </button>
          ))}
        </div>
        <div className="progress-table-wrap">
          <table className="muscle-progress-table">
            <thead><tr><th>Muscle group</th><th>Sets</th><th>Volume</th><th>Sessions</th><th>Last trained</th></tr></thead>
            <tbody>{analytics.rows.map(row => <tr key={row.muscle} className={detailMuscle === row.muscle ? 'active' : ''} onClick={() => setDetailMuscle(row.muscle)}><td>{row.muscle}</td><td>{row.sets}</td><td>{Math.round(row.volume).toLocaleString()} kg</td><td>{row.sessions}</td><td>{row.lastTrained ? formatShortDate(row.lastTrained) : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel progress-panel">
        <div className="progress-section-heading"><div><h3>{detailMuscle} performance</h3><p className="muted small">Exercise-level results from completed sets.</p></div></div>
        <div className="progress-detail-stats"><div><strong>{selectedDetail?.sets || 0}</strong><span>Completed sets</span></div><div><strong>{Math.round(selectedDetail?.volume || 0).toLocaleString()} kg</strong><span>Total volume</span></div><div><strong>{selectedDetail?.sessions || 0}</strong><span>Sessions trained</span></div></div>
        {detailExercises.length ? (
          <div className="progress-table-wrap"><table className="muscle-progress-table exercise-progress-table"><thead><tr><th>Exercise</th><th>Sets</th><th>Best weight</th><th>Best reps</th></tr></thead><tbody>{detailExercises.map(exercise => <tr key={exercise.name}><td>{exercise.name}</td><td>{exercise.sets}</td><td>{exercise.bestWeight || '—'} kg</td><td>{exercise.bestReps || '—'}</td></tr>)}</tbody></table></div>
        ) : <div className="progress-empty">No completed sets recorded for {detailMuscle} in this period.</div>}
      </section>
      <p className="progress-data-note">{profile?.goal === 'Glutes & core' ? 'Your dashboard reflects your own Glutes & core training history.' : 'Your dashboard reflects your own Chest & arms training history.'} Secondary muscles are not added to primary-muscle totals, so each set is counted once.</p>
    </div>
  );
}
