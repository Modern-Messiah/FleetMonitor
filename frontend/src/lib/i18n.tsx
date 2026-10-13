import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { EventType, Severity } from '@/lib/types';

export type Locale = 'ru' | 'en';

const STORAGE_KEY = 'fleet.locale';

export const messages = {
  ru: {
    brand: 'Монитор',
    map: 'карта',
    journal: 'журнал',
    summary: 'сводка',
    sections: 'Разделы',
    language: 'Язык',
    onlineCount: 'в сети',
    offlineCount: 'без связи',
    criticalCount: 'критических',
    searchPlaceholder: 'номер или водитель',
    searchLabel: 'Поиск по номеру или водителю',
    filterLabel: 'Фильтр',
    filterAll: 'все',
    filterAttention: 'внимание',
    filterOnline: 'в сети',
    filterOffline: 'без связи',
    streamLive: 'поток: живой',
    streamDown: 'поток: нет связи',
    noData: 'нет данных',
    listFailed: 'не удалось получить список машин',
    noVehicles: 'пока нет машин',
    startSimulator: 'запустите симулятор, чтобы увидеть поток',
    dismiss: 'скрыть',
    showPlace: 'Показать место события',
    loading: 'загрузка',
    loadVehiclesFailed: 'не удалось загрузить машины',
    noFilterMatch: 'ничего по этому фильтру',
    watchNow: 'смотри сейчас',
    noSignal: 'нет связи',
    standing: 'стоит',
    moving: 'едет',
    offlineAge: 'нет связи · {mins} мин',
    speed: '{speed} км/ч',
    eventDrowsiness: 'сонливость',
    eventSpeeding: 'превышение скорости',
    eventBraking: 'резкое торможение',
    eventCollision: 'опасность столкновения',
    severityLow: 'Низкая',
    severityMedium: 'Средняя',
    severityCritical: 'Критическая',
    badgeLow: 'Низкий',
    badgeMedium: 'Средний',
    badgeCritical: 'Критический',
    unknownDriver: 'Неизвестный водитель',
    unknownPlate: 'неизвестно',
    journalTitle: 'Журнал',
    journalNote: 'Фильтрация, поиск, экспорт CSV и получение новых событий в реальном времени.',
    allVehicles: 'Все машины',
    allTypes: 'Все типы событий',
    allLevels: 'Все уровни',
    dateFrom: 'Дата от',
    dateTo: 'Дата до',
    openDateFrom: 'Открыть календарь (дата от)',
    openDateTo: 'Открыть календарь (дата до)',
    searchDriver: 'Водитель или номер',
    journalFailedShort: 'Журнал не загрузился',
    eventTotal: 'Всего: {count} событий',
    exportCsv: 'Экспорт CSV',
    journalFailed: 'Не удалось загрузить журнал.',
    time: 'Время',
    vehicle: 'Машина',
    driver: 'Водитель',
    type: 'Тип',
    level: 'Уровень',
    coordinates: 'Координаты',
    noEvents: 'По выбранным фильтрам события не найдены.',
    back: 'Назад',
    forward: 'Вперед',
    page: 'Страница {page} / {total}',
    summaryTitle: 'Сводка',
    summaryNote: 'Аналитика автоматически обновляется каждые 30 секунд.',
    summaryFailed: 'Не удалось загрузить сводку',
    summaryFailedNote: 'Не получилось получить аналитику с backend API.',
    statOnline: 'В сети',
    statOnlineNote: 'Живое состояние',
    statOffline: 'Без связи',
    statOfflineNote: 'Нет свежего GPS',
    statHour: 'За час',
    statHourNote: 'Последние 60 минут',
    statDay: 'За сутки',
    statDayNote: 'Последние 24 часа',
    topTitle: 'Топ-5 машин по числу событий',
    eventSeries: 'Событий',
    notEnoughEvents: 'Пока недостаточно данных по событиям.',
    criticalDay: 'Критические события за 24 часа',
    noCriticalDay: 'За последние 24 часа критических событий не было.',
    errorTitle: 'Что-то пошло не так',
    errorNote: 'Во время отображения страницы произошла непредвиденная ошибка.',
    reload: 'Перезагрузить',
  },
  en: {
    brand: 'Monitor',
    map: 'map',
    journal: 'journal',
    summary: 'summary',
    sections: 'Sections',
    language: 'Language',
    onlineCount: 'online',
    offlineCount: 'offline',
    criticalCount: 'critical',
    searchPlaceholder: 'plate or driver',
    searchLabel: 'Search by plate or driver',
    filterLabel: 'Filter',
    filterAll: 'all',
    filterAttention: 'attention',
    filterOnline: 'online',
    filterOffline: 'offline',
    streamLive: 'stream: live',
    streamDown: 'stream: no signal',
    noData: 'no data',
    listFailed: 'could not get the vehicle list',
    noVehicles: 'no vehicles yet',
    startSimulator: 'start the simulator to see the stream',
    dismiss: 'hide',
    showPlace: 'Show where it happened',
    loading: 'loading',
    loadVehiclesFailed: 'could not load vehicles',
    noFilterMatch: 'nothing matches this filter',
    watchNow: 'watch now',
    noSignal: 'no signal',
    standing: 'stopped',
    moving: 'moving',
    offlineAge: 'no signal · {mins} min',
    speed: '{speed} km/h',
    eventDrowsiness: 'drowsiness',
    eventSpeeding: 'speeding',
    eventBraking: 'harsh braking',
    eventCollision: 'collision warning',
    severityLow: 'Low',
    severityMedium: 'Medium',
    severityCritical: 'Critical',
    badgeLow: 'Low',
    badgeMedium: 'Medium',
    badgeCritical: 'Critical',
    unknownDriver: 'Unknown driver',
    unknownPlate: 'unknown',
    journalTitle: 'Journal',
    journalNote: 'Filter, search, export CSV, and receive new events as they happen.',
    allVehicles: 'All vehicles',
    allTypes: 'All event types',
    allLevels: 'All levels',
    dateFrom: 'From',
    dateTo: 'To',
    openDateFrom: 'Open calendar (from)',
    openDateTo: 'Open calendar (to)',
    searchDriver: 'Driver or plate',
    journalFailedShort: 'Journal did not load',
    eventTotal: '{count} events',
    exportCsv: 'Export CSV',
    journalFailed: 'Could not load the journal.',
    time: 'Time',
    vehicle: 'Vehicle',
    driver: 'Driver',
    type: 'Type',
    level: 'Level',
    coordinates: 'Coordinates',
    noEvents: 'No events match these filters.',
    back: 'Back',
    forward: 'Next',
    page: 'Page {page} / {total}',
    summaryTitle: 'Summary',
    summaryNote: 'Figures refresh every 30 seconds.',
    summaryFailed: 'Could not load the summary',
    summaryFailedNote: 'Could not get analytics from the backend API.',
    statOnline: 'Online',
    statOnlineNote: 'Live state',
    statOffline: 'Offline',
    statOfflineNote: 'No fresh GPS',
    statHour: 'Last hour',
    statHourNote: 'Last 60 minutes',
    statDay: 'Last day',
    statDayNote: 'Last 24 hours',
    topTitle: 'Top 5 vehicles by events',
    eventSeries: 'Events',
    notEnoughEvents: 'Not enough events yet.',
    criticalDay: 'Critical events in 24 hours',
    noCriticalDay: 'No critical events in the last 24 hours.',
    errorTitle: 'Something went wrong',
    errorNote: 'The page hit an unexpected error.',
    reload: 'Reload',
  },
} as const;

export type MessageKey = keyof (typeof messages)['ru'];

export function readLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

export function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function titleCase(value: string, locale: Locale) {
  if (!value) {
    return value;
  }
  const language = locale === 'ru' ? 'ru-RU' : 'en-US';
  return value.charAt(0).toLocaleUpperCase(language) + value.slice(1);
}

const eventKeys: Record<EventType, MessageKey> = {
  DROWSINESS: 'eventDrowsiness',
  SPEEDING: 'eventSpeeding',
  HARSH_BRAKING: 'eventBraking',
  COLLISION_WARNING: 'eventCollision',
};

export function eventKey(type: string): MessageKey | null {
  return type in eventKeys ? eventKeys[type as EventType] : null;
}

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale);

  useEffect(() => {
    document.documentElement.lang = locale === 'ru' ? 'ru' : 'en';
    document.title = messages[locale].brand;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Private mode can reject storage. The choice still applies to this view.
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key: MessageKey) => messages[locale][key],
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return value;
}

export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <nav className="filters langs" aria-label={t('language')}>
      <button
        type="button"
        className="control"
        aria-pressed={locale === 'ru'}
        onClick={() => setLocale('ru')}
      >
        рус
      </button>
      <button
        type="button"
        className="control"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        eng
      </button>
    </nav>
  );
}

export function severityMessage(severity: Severity): MessageKey {
  if (severity === 'LOW') {
    return 'severityLow';
  }
  if (severity === 'MEDIUM') {
    return 'severityMedium';
  }
  return 'severityCritical';
}

export function badgeMessage(severity: Severity): MessageKey {
  if (severity === 'LOW') {
    return 'badgeLow';
  }
  if (severity === 'MEDIUM') {
    return 'badgeMedium';
  }
  return 'badgeCritical';
}
