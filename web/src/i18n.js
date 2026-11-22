export const LANGS = [
  { code: 'hy', label: 'ՀԱՅ', locale: 'hy-AM' },
  { code: 'ru', label: 'РУС', locale: 'ru-RU' },
  { code: 'en', label: 'ENG', locale: 'en-GB' },
];

export const PROGRAMS = ['AI-Native Product Engineering', 'Student Fellowship Program', 'Claude Academy'];

const dict = {
  hy: {
    brandSub: 'Picsart Academy',
    greetingTitle: 'Բարև, ես Academy Concierge-ն եմ',
    greeting:
      'Պատասխանում եմ միայն Ակադեմիայի պաշտոնական տեղեկությունների հիման վրա՝ ծրագրեր, դասացուցակ, ընդունելություն, կանոններ։ Եթե ինչ-որ բան չգիտեմ, հարցը կփոխանցեմ համակարգողին։',
    studentGreeting: (n) => `Բարև, ${n}`,
    studentGreetingText: 'Կարող եմ պատասխանել ձեր դասացուցակի, քննության, վճարման և հաճախման մասին հարցերին։',
    tryAsking: 'Փորձեք հարցնել',
    placeholder: 'Գրեք ձեր հարցը…',
    send: 'Ուղարկել',
    newChat: 'Նոր զրույց',
    studentSignIn: 'Ուսանողի մուտք',
    signOut: 'Ելք',
    codeLabel: 'Ուսանողի կոդ',
    codeHint: 'Դեմո մուտքի համար՝',
    signIn: 'Մուտք',
    codeNotFound: 'Այդ կոդով ուսանող չի գտնվել',
    source: 'Աղբյուր',
    handoff: 'Հարցը փոխանցել եմ համակարգողին. նա կկապվի ձեզ հետ։',
    leadCta: 'Գրանցվել ընդունելության թեստին',
    excuseCta: 'Հայտնել բացակայության մասին',
    slow: 'Սերվերն արթնանում է, մի քանի վայրկյան…',
    error: 'Չհաջողվեց պատասխան ստանալ։',
    tooMany: 'Չափազանց շատ հարցումներ։ Փորձեք մեկ րոպեից։',
    retry: 'Կրկնել',
    close: 'Փակել',
    leadTitle: 'Գրանցում ընդունելության թեստին',
    leadIntro: 'Թողեք ձեր տվյալները, և համակարգողը կկապվի ձեզ հետ՝ թեստի օրն ու ժամը հաստատելու համար։',
    name: 'Անուն, ազգանուն',
    contact: 'Հեռախոս կամ էլ. փոստ',
    program: 'Ծրագիր',
    preferredTime: 'Հարմար ժամ',
    timeOptions: ['Աշխատանքային օր, առավոտ', 'Աշխատանքային օր, երեկո', 'Շաբաթ-կիրակի'],
    other: 'Այլ',
    sendRequest: 'Ուղարկել հայտը',
    leadDone: 'Հայտն ընդունված է։ Համակարգողը կկապվի ձեզ հետ՝ թեստի ժամը հաստատելու համար։',
    excuseTitle: 'Բացակայության մասին հայտ',
    excuseIntro: 'Նշեք ամսաթիվը և պատճառը։ Համակարգողը կտեսնի ձեր հաղորդագրությունը։',
    date: 'Ամսաթիվ',
    reason: 'Պատճառ',
    excuseDone: 'Բացակայությունը գրանցված է։ Շնորհակալություն, որ նախապես տեղեկացրիք։',
    attendance: 'Հաճախում',
    nextExam: 'Հաջորդ քննություն',
    payment: 'Վճարում',
    paid: 'վճարված է',
    dueBy: (d) => `վճարել մինչև ${d}`,
    demo: 'դեմո',
    required: 'Լրացրեք պարտադիր դաշտերը',
    footer: 'Դեմո · պատասխանները միայն Ակադեմիայի հաստատված նյութերից · Fellowship Program, Project 14',
    sourceNames: {
      courses: 'Ծրագրեր',
      schedule: 'Դասացուցակ',
      faq: 'Հաճախ տրվող հարցեր',
      contacts: 'Կոնտակտներ',
      student_profile: 'Ձեր պրոֆիլը',
    },
    suggestGuest: [
      'Ի՞նչ ծրագրեր ունի Ակադեմիան',
      'Ե՞րբ և որտե՞ղ են անցկացվում դասերը',
      'Ինչպե՞ս ընդունվել Fellowship ծրագրին',
      'Ի՞նչ անել, եթե բաց եմ թողնում դասը',
    ],
    suggestStudent: [
      'Ե՞րբ է իմ հաջորդ քննությունը',
      'Վճարե՞լ եմ նոյեմբեր ամսվա համար',
      'Ինչպիսի՞ն է իմ հաճախումը',
      'Վաղը չեմ կարող գալ դասի',
    ],
  },
  ru: {
    brandSub: 'Picsart Academy',
    greetingTitle: 'Здравствуйте! Я Academy Concierge',
    greeting:
      'Отвечаю только по официальной информации академии: программы, расписание, поступление, правила. Если чего-то не знаю — передам вопрос координатору.',
    studentGreeting: (n) => `Здравствуйте, ${n}`,
    studentGreetingText: 'Могу рассказать о вашем расписании, экзамене, оплате и посещаемости.',
    tryAsking: 'Попробуйте спросить',
    placeholder: 'Напишите вопрос…',
    send: 'Отправить',
    newChat: 'Новый чат',
    studentSignIn: 'Вход для студентов',
    signOut: 'Выйти',
    codeLabel: 'Код студента',
    codeHint: 'Для демо-входа:',
    signIn: 'Войти',
    codeNotFound: 'Студент с таким кодом не найден',
    source: 'Источник',
    handoff: 'Передал вопрос координатору — с вами свяжутся.',
    leadCta: 'Записаться на вступительный тест',
    excuseCta: 'Сообщить о пропуске',
    slow: 'Сервер просыпается, несколько секунд…',
    error: 'Не удалось получить ответ.',
    tooMany: 'Слишком много запросов. Попробуйте через минуту.',
    retry: 'Повторить',
    close: 'Закрыть',
    leadTitle: 'Запись на вступительный тест',
    leadIntro: 'Оставьте контакты — координатор свяжется с вами и подтвердит день и время теста.',
    name: 'Имя и фамилия',
    contact: 'Телефон или e-mail',
    program: 'Программа',
    preferredTime: 'Удобное время',
    timeOptions: ['Будни, утро', 'Будни, вечер', 'Выходные'],
    other: 'Другое',
    sendRequest: 'Отправить заявку',
    leadDone: 'Заявка принята. Координатор свяжется с вами, чтобы подтвердить время теста.',
    excuseTitle: 'Сообщение о пропуске',
    excuseIntro: 'Укажите дату и причину — координатор увидит ваше сообщение.',
    date: 'Дата',
    reason: 'Причина',
    excuseDone: 'Пропуск зарегистрирован. Спасибо, что предупредили заранее.',
    attendance: 'Посещаемость',
    nextExam: 'Следующий экзамен',
    payment: 'Оплата',
    paid: 'оплачено',
    dueBy: (d) => `оплатить до ${d}`,
    demo: 'демо',
    required: 'Заполните обязательные поля',
    footer: 'Демо · ответы только по утверждённым материалам академии · Fellowship Program, Project 14',
    sourceNames: {
      courses: 'Программы',
      schedule: 'Расписание',
      faq: 'Частые вопросы',
      contacts: 'Контакты',
      student_profile: 'Ваш профиль',
    },
    suggestGuest: [
      'Какие программы есть в академии?',
      'Когда и где проходят занятия?',
      'Как поступить в Fellowship?',
      'Что делать, если пропускаю занятие?',
    ],
    suggestStudent: [
      'Когда мой следующий экзамен?',
      'Я оплатил ноябрь?',
      'Какая у меня посещаемость?',
      'Завтра не смогу прийти на занятие',
    ],
  },
  en: {
    brandSub: 'Picsart Academy',
    greetingTitle: "Hi, I'm Academy Concierge",
    greeting:
      "I answer only from the Academy's official information: programs, schedule, admissions and rules. If I don't know something, I'll pass your question to a coordinator.",
    studentGreeting: (n) => `Hi, ${n}`,
    studentGreetingText: 'I can tell you about your schedule, exam, payments and attendance.',
    tryAsking: 'Try asking',
    placeholder: 'Type your question…',
    send: 'Send',
    newChat: 'New chat',
    studentSignIn: 'Student sign-in',
    signOut: 'Sign out',
    codeLabel: 'Student code',
    codeHint: 'For the demo:',
    signIn: 'Sign in',
    codeNotFound: 'No student with this code',
    source: 'Source',
    handoff: "I've passed your question to a coordinator — they'll get back to you.",
    leadCta: 'Book the entry test',
    excuseCta: 'Report an absence',
    slow: 'Waking up the server, a few seconds…',
    error: "Couldn't get an answer.",
    tooMany: 'Too many requests. Please try again in a minute.',
    retry: 'Try again',
    close: 'Close',
    leadTitle: 'Book the entry test',
    leadIntro: 'Leave your contact details and a coordinator will confirm the test day and time.',
    name: 'Full name',
    contact: 'Phone or email',
    program: 'Program',
    preferredTime: 'Preferred time',
    timeOptions: ['Weekday morning', 'Weekday evening', 'Weekend'],
    other: 'Other',
    sendRequest: 'Send request',
    leadDone: 'Request received. A coordinator will contact you to confirm the test time.',
    excuseTitle: 'Report an absence',
    excuseIntro: 'Give the date and the reason — the coordinator will see your note.',
    date: 'Date',
    reason: 'Reason',
    excuseDone: 'Absence recorded. Thanks for letting us know in advance.',
    attendance: 'Attendance',
    nextExam: 'Next exam',
    payment: 'Payment',
    paid: 'paid',
    dueBy: (d) => `due by ${d}`,
    demo: 'demo',
    required: 'Please fill in the required fields',
    footer: 'Demo · answers only from approved Academy content · Fellowship Program, Project 14',
    sourceNames: {
      courses: 'Programs',
      schedule: 'Schedule',
      faq: 'FAQ',
      contacts: 'Contacts',
      student_profile: 'Your profile',
    },
    suggestGuest: [
      'What programs does the Academy offer?',
      'When and where are classes held?',
      'How do I join the Fellowship Program?',
      'What if I miss a class?',
    ],
    suggestStudent: [
      'When is my next exam?',
      'Did I pay for November?',
      "What's my attendance?",
      "I can't come to class tomorrow",
    ],
  },
};

export const t = (lang) => dict[lang] || dict.hy;

export const localeOf = (lang) => LANGS.find((l) => l.code === lang)?.locale || 'hy-AM';

// Month names are spelled out here: some browsers ship without Armenian locale data
// and would print "November 30" in the Armenian interface.
const MONTHS = {
  hy: {
    nom: ['հունվար', 'փետրվար', 'մարտ', 'ապրիլ', 'մայիս', 'հունիս', 'հուլիս', 'օգոստոս', 'սեպտեմբեր', 'հոկտեմբեր', 'նոյեմբեր', 'դեկտեմբեր'],
    gen: ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի', 'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'],
  },
  ru: {
    nom: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    gen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  },
  en: {
    nom: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};

// "2026-11-30" → "նոյեմբերի 30" / "30 ноября" / "30 November"
export function fmtDate(iso, lang) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  const day = d || 1;
  if (lang === 'hy') return `${MONTHS.hy.gen[m - 1]} ${day}`;
  if (lang === 'ru') return `${day} ${MONTHS.ru.gen[m - 1]}`;
  return `${day} ${MONTHS.en.nom[m - 1]}`;
}

// "2026-11" → "նոյեմբեր" / "ноябрь" / "November"
export function fmtMonth(iso, lang) {
  if (!iso) return '';
  const m = Number(iso.split('-')[1]);
  return (MONTHS[lang] || MONTHS.en).nom[m - 1];
}

export function detectInitialLang() {
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('ru')) return 'ru';
  if (nav.startsWith('en')) return 'en';
  return 'hy';
}
