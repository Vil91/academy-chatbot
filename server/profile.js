// Student profiles. Real data would come from the Academy Core Engine (Project 1);
// here every profile is generated demo data, built relative to today's date so the demo never goes stale.

export const PROGRAMS = ['AI-Native Product Engineering', 'Student Fellowship Program'];

const ROOM_1 = 'Ada Lovelace (1st floor)';
const ROOM_2 = 'Claude Shannon (2nd floor)';

const PROGRAM_DATA = {
  'AI-Native Product Engineering': {
    group: 'Group A',
    schedule: [
      { day: 'Monday', time: '16:00–19:00', room: ROOM_1, topic: 'Databases: indexing' },
      { day: 'Tuesday', time: '16:00–19:00', room: ROOM_1, topic: 'SQL vs NoSQL' },
      { day: 'Wednesday', time: '16:00–19:00', room: ROOM_1, topic: 'Data modelling practice' },
      { day: 'Thursday', time: '16:00–19:00', room: ROOM_1, topic: 'Project: deploy a full web product' },
      { day: 'Friday', time: '17:00–18:00', room: ROOM_2, topic: 'Mastering English' },
    ],
    examTopic: 'SQL and NoSQL databases',
  },
  'Student Fellowship Program': {
    group: 'Developers track',
    schedule: [
      { day: 'Monday', time: '15:00–16:00', room: ROOM_1, topic: 'Team meeting' },
      { day: 'Wednesday', time: '15:00–16:00', room: ROOM_1, topic: 'Team meeting' },
    ],
    examTopic: null,
  },
};

// Today's date in Yerevan as YYYY-MM-DD.
export function todayYerevan() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yerevan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function monthKey(today, offset = 0) {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
}

function nextMonday(today) {
  const d = new Date(`${today}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1);
  return d.toISOString().slice(0, 10);
}

export function makeProfile({ name, program, code }) {
  const data = PROGRAM_DATA[program] || PROGRAM_DATA[PROGRAMS[0]];
  const today = todayYerevan();
  const first = name.trim().split(/\s+/)[0];
  const current = monthKey(today);
  return {
    code,
    demo: true,
    program: PROGRAM_DATA[program] ? program : PROGRAMS[0],
    group: data.group,
    name: { hy: name, ru: name, en: name },
    firstName: { hy: first, ru: first, en: first },
    schedule: data.schedule,
    nextExam: data.examTopic
      ? { date: nextMonday(today), weekday: 'Monday', topic: data.examTopic, format: 'online form, phone is fine' }
      : null,
    payments: [
      { month: monthKey(today, -2), status: 'paid' },
      { month: monthKey(today, -1), status: 'paid' },
      { month: current, status: 'due', dueDate: `${current}-25` },
    ],
    attendance: { percent: null, attended: 0, total: 0, missed: 0 },
  };
}

// The ready-made demo student: a few weeks into the course, with history to ask about.
export function demoProfile(code) {
  return {
    ...makeProfile({ name: 'Aram Petrosyan', program: PROGRAMS[0], code }),
    name: { hy: 'Արամ Պետրոսյան', ru: 'Арам Петросян', en: 'Aram Petrosyan' },
    firstName: { hy: 'Արամ', ru: 'Арам', en: 'Aram' },
    attendance: { percent: 88, attended: 22, total: 25, missed: 3 },
  };
}
