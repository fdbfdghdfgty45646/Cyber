/**
 * ============================================================================
 *  БОТ CYBERSTAND — index.js
 * ============================================================================
 *  Ниже в этом файле — сам код. Все места, которые можно/нужно менять под
 *  себя, отмечены комментариями "⚙️ НАСТРОЙКА:" — их достаточно найти через
 *  поиск (Ctrl+F / Cmd+F) в редакторе.
 *
 *  Быстрые инструкции (подробности — ниже по тексту, в нужных местах кода):
 *
 *  1) КАК ИЗМЕНИТЬ СПИСОК КАРТ / СОКРАТИТЬ ИХ КОЛИЧЕСТВО
 *     Найдите константу MAPS (поиск: "const MAPS"). Это простой список строк.
 *     Удалите/добавьте/переименуйте элементы — сколько угодно, хоть 2, хоть 20.
 *
 *  2) КАК ИЗМЕНИТЬ ТЕКСТ ЛЮБОГО СООБЩЕНИЯ
 *     Все тексты сообщений собраны в шаблонных строках вида:
 *       `**Текст**\n\n**Ещё текст**`
 *     Просто меняйте текст внутри кавычек ` `` `, символы \n\n — это пустая
 *     строка (перенос), а **текст** — это жирный шрифт в Discord.
 *
 *  3) КАК УБРАТЬ ГОЛОСОВАНИЕ ПО РЕАКЦИЯМ (🔴🟡🟢) И СДЕЛАТЬ ФИКСИРОВАННОЕ ВРЕМЯ
 *     Найдите функцию startTimeVoting (поиск: "async function startTimeVoting").
 *     Инструкция, что именно удалить/заменить, написана прямо над функцией.
 *
 *  4) КАК ДОБАВИТЬ/УБРАТЬ ГОЛОСОВЫЕ КАНАЛЫ, ЗА КОТОРЫМИ СЛЕДИТ БОТ
 *     Найдите constant channelBindings (поиск: "const channelBindings").
 *     Это просто список пар "ID голосового канала" -> "ID текстового канала".
 *
 *  5) КАНАЛ ДЛЯ ВЕТОК-ТИКЕТОВ ("Игрок не создал лобби")
 *     Найдите константу DISPUTE_CHANNEL_ID (поиск: "const DISPUTE_CHANNEL_ID").
 *     Номера тикетов (0001, 0002...) считаются автоматически и хранятся
 *     в файле ticket-counter.json рядом с index.js.
 *
 *  6) SLASH-КОМАНДЫ МОДЕРАЦИИ (/mute, /unmute, /warn, /rename, /setid)
 *     Найдите constant slashCommands (поиск: "const slashCommands").
 *     Доступны только роли MODERATOR_ROLE_ID. Мут — через встроенный
 *     тайм-аут Discord, максимум 28 дней (40320 минут).
 *     После WARNS_BEFORE_MUTE варнов — автомут на AUTO_MUTE_HOURS часов
 *     и сброс счётчика варнов (поиск: "const WARNS_BEFORE_MUTE").
 *
 *  7) КАНАЛ "КАК СОЗДАТЬ ЛОББИ" И ТЕКСТЫ НАСТРОЕК ПО РЕЖИМАМ
 *     Найдите константу LOBBY_SETTINGS_TEXT (поиск: "const LOBBY_SETTINGS_TEXT")
 *     и впишите туда реальные настройки лобби для каждого режима вместо
 *     заглушки — именно этот текст видит игрок при нажатии на кнопку
 *     DUELS/DM/AWM/HSDM в канале LOBBY_GUIDE_CHANNEL_ID.
 *
 *  8) СТАТИСТИКА МАТЧЕЙ (распознавание скриншотов)
 *     Канал с кнопкой "Отправить результаты": const RESULTS_CHANNEL_ID.
 *     Игрок жмёт кнопку -> получает приватную ветку -> присылает туда
 *     скриншот -> бот распознаёт (OCR) кто есть кто по никнеймам из
 *     регистрации -> показывает распознанное для проверки -> модератор/
 *     игрок жмёт "Подтвердить" или "Исправить вручную" (открывается окно
 *     с текстом для правки) -> статистика зачисляется в stats.json,
 *     каждому игроку присылается Embed-карточка со статистикой (не
 *     картинка — без лишних зависимостей на хостинге).
 *     ВАЖНО: OCR не идеален (см. пояснение в чате) — поэтому шаг проверки
 *     обязателен, статистика никогда не зачисляется "втихую".
 *
 *  9) КОМАНДА /профиль — игрок сам смотрит свою статистику
 *     Канал, где разрешена команда: const PROFILE_CHANNEL_ID
 *     (если оставить заглушку — работает в любом канале сервера).
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js'); // распознавание текста со скриншота (OCR)
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent, // нужен, чтобы бот видел вложения (скриншоты) в сообщениях
  ],
});

// ============================================================================
// ⚙️ НАСТРОЙКА: ГОЛОСОВЫЕ КАНАЛЫ, ЗА КОТОРЫМИ СЛЕДИТ БОТ
// ============================================================================
// Каждая строка — это пара "ID голосового канала" -> "ID текстового канала,
// куда бот будет писать сообщения о лобби".
//
// КАК ДОБАВИТЬ ЕЩЁ КАНАЛ: скопируйте одну строку целиком (вместе с { } и ,)
// и вставьте новую, заменив оба ID на нужные.
//
// КАК УБРАТЬ КАНАЛ: удалите соответствующую строку целиком.
//
// Сейчас здесь: 1 канал с реальными ID (уже настроенный) + 8 каналов-заготовок
// с ID-заглушками — впишите в них свои реальные ID.
//
// Поле "mode" — это слово, которое подставляется вместо "DUELS" в сообщениях
// именно для этого голосового канала. Меняйте текст в кавычках на любой свой.
//
// Поле "fixedDuration" — управляет голосованием за время матча (🔴🟡🟢):
//   - если оставить null                 -> голосование ВКЛЮЧЕНО (как обычно)
//   - если вписать число, например 15    -> голосование ОТКЛЮЧЕНО для этого
//                                            канала, время матча сразу = 15 мин
//   Пример: fixedDuration: 20  — матч всегда будет на 20 минут, без вопросов.
//
// Поле "maps" — свой список карт именно для этого голосового канала:
//   - если оставить null              -> используется общий список DEFAULT_MAPS
//   - если вписать список в [ ]       -> для ЭТОГО канала будут показаны
//                                         только эти карты, в этом порядке,
//                                         в этом количестве (хоть 1, хоть 20)
//   Пример: maps: ['Dust2', 'Mirage', 'Inferno']  — только 3 своих карты.
//
// Поле "bannerPath" — свой баннер (картинка) для ПЕРВОГО сообщения лобби
// именно этого канала:
//   - если оставить null              -> используется общий баннер
//                                         DEFAULT_BANNER_IMAGE_PATH
//   - если вписать путь к файлу       -> для этого канала будет использована
//                                         именно эта картинка
//   Файл картинки нужно заранее положить в папку images/ рядом с index.js.
//   Пример: bannerPath: './images/banner-duels.png'
const channelBindings = {
  '1538539446348288064': {
    textChannelId: '1539770979973201990',
    mode: 'DUELS',
    fixedDuration: 10,
    maps: null,
    bannerPath: './images/DUELS.png',
  },
  '1539774335013888030': {
    textChannelId: '1539774413384454235',
    mode: 'DM',
    fixedDuration: null,
    maps: ['Sandstone', 'Rust', 'Province', 'Hanami', 'Prison', 'Breeze'],
    bannerPath: './images/DM.PNG',
  },
  '1541134769516056778': {
    textChannelId: '1541134837065187408',
    mode: 'AWM',
    fixedDuration: null,
    maps: ['Sandstone', 'Rust', 'Province', 'Hanami', 'Prison', 'Breeze'],
    bannerPath: './images/AWM.png',
  },
  '1541135718540124160': {
    textChannelId: '1541135805278331001',
    mode: 'HSDM',
    fixedDuration: null,
    maps: ['Sandstone', 'Rust', 'Province', 'Hanami', 'Prison', 'Breeze'],
    bannerPath: './images/HSDM.PNG',
  },
  '1542536796762804275': {
    textChannelId: '1542536831852220548',
    mode: 'PISTOL',
    fixedDuration: null,
    maps: ['Sandstone', 'Rust', 'Province', 'Hanami', 'Prison', 'Breeze'],
    bannerPath: './images/PISTOL.PNG',
  },
  'ID_ГОЛОСОВОГО_КАНАЛА_6': {
    textChannelId: 'ID_ТЕКСТОВОГО_КАНАЛА_6',
    mode: 'DUELS',
    fixedDuration: null,
    maps: null,
    bannerPath: null,
  },
  'ID_ГОЛОСОВОГО_КАНАЛА_7': {
    textChannelId: 'ID_ТЕКСТОВОГО_КАНАЛА_7',
    mode: 'DUELS',
    fixedDuration: null,
    maps: null,
    bannerPath: null,
  },
  'ID_ГОЛОСОВОГО_КАНАЛА_8': {
    textChannelId: 'ID_ТЕКСТОВОГО_КАНАЛА_8',
    mode: 'DUELS',
    fixedDuration: null,
    maps: null,
    bannerPath: null,
  },
  'ID_ГОЛОСОВОГО_КАНАЛА_9': {
    textChannelId: 'ID_ТЕКСТОВОГО_КАНАЛА_9',
    mode: 'DUELS',
    fixedDuration: null,
    maps: null,
    bannerPath: null,
  },
};

// ⚙️ НАСТРОЙКА: канал, в котором создаются ветки-тикеты по кнопке
// "Игрок не создал лобби"
const DISPUTE_CHANNEL_ID = '1540013002550550579';

// ⚙️ НАСТРОЙКА: роль модерации — упоминается при создании тикета,
// и именно этой роли нужно дать право "Manage Threads" на канале
// DISPUTE_CHANNEL_ID, чтобы модераторы видели приватные ветки-тикеты
// (без этого права модератор не увидит ветку, пока его туда не добавят вручную)
const MODERATOR_ROLE_ID = '1540821278846619738';

const SUPPORT_BANNER_IMAGE_PATH = './images/support-banner.png';

// ⚙️ НАСТРОЙКА: канал с правилами (раздел первый)
const RULES_CHANNEL_ID = '1538552417841319956';
const RULES_SECTION1_BANNER_PATH = './images/rules-section1-banner.png';

// файл со счётчиком номеров тикетов (0001, 0002, 0003, ...)
const TICKET_COUNTER_PATH = path.join(__dirname, 'ticket-counter.json');

function getNextTicketNumber() {
  let count = 0;
  try {
    count = JSON.parse(fs.readFileSync(TICKET_COUNTER_PATH, 'utf8')).count;
  } catch {
    count = 0;
  }
  count += 1;
  fs.writeFileSync(TICKET_COUNTER_PATH, JSON.stringify({ count }, null, 2), 'utf8');
  return String(count).padStart(4, '0'); // 1 -> "0001"
}

// создаёт приватную ветку-тикет (видят только автор + те, у кого есть право
// Manage Threads на канале DISPUTE_CHANNEL_ID — обычно это роль модерации),
// возвращает саму ветку
async function createDisputeThread(disputeChannel, reporterId) {
  const ticketNumber = getNextTicketNumber();

  const thread = await disputeChannel.threads.create({
    name: `🎫${ticketNumber}`,
    type: ChannelType.PrivateThread,
    invitable: false,
    autoArchiveDuration: 1440,
    reason: 'Новый тикет',
  });

  try {
    await thread.members.add(reporterId);
  } catch (err) {
    console.error('Ошибка добавления автора тикета в ветку:', err);
  }

  return thread;
}

function buildCloseButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_thread')
      .setLabel('Закрыть')
      .setStyle(ButtonStyle.Danger)
  );
}

// баннер по умолчанию — используется, если у канала в channelBindings
// не задан свой "bannerPath"
const DEFAULT_BANNER_IMAGE_PATH = './images/lobby-banner.png';
// больше не используется в финальном сообщении — там теперь та же картинка,
// что и в приветственном сообщении лобби (см. sendFinalMessage: session.bannerPath).
// Оставлена на случай, если понадобится снова отдельная картинка для финала.
const MATCH_INFO_IMAGE_PATH = './images/match-info.png';
const WELCOME_BANNER_IMAGE_PATH = './images/welcome-banner.png'; // картинка "Добро пожаловать!" в канале регистрации
const INFO_BANNER_IMAGE_PATH = './images/lobby-banner.png'; // картинка "Хорошей игры!" (тот же файл, что и в первом сообщении лобби)

// ⚙️ НАСТРОЙКА: канал, куда отправляется отдельное информационное Embed-сообщение
// (текст про CyberStand + картинка "Хорошей игры!")
const INFO_CHANNEL_ID = 'ID_ИНФО_КАНАЛА';

// ============================================================================
// ⚙️ НАСТРОЙКА: СПИСОК КАРТ
// ============================================================================
// Просто список названий. Можно добавлять/удалять/переименовывать строки —
// хоть 1 карту оставить, хоть 20 добавить. Порядок в списке = порядок в
// выпадающем меню у игрока.
// Этот список используется, только если у конкретного голосового канала
// в channelBindings НЕ задано своё поле "maps" (см. выше). Если хотите
// одинаковый список карт для всех каналов — меняйте только этот список.
const DEFAULT_MAPS = ['Block', 'Yard', 'Pool', 'Bridge', 'Cableway', 'Pipeline', 'Temple'];

// ============================================================================
// ⚙️ НАСТРОЙКА: ГОЛОСОВАНИЕ ЗА ВРЕМЯ МАТЧА
// ============================================================================
const VOTE_DURATION_MS = 10 * 1000; // сколько ждать голосование, сейчас 30 секунд
const KICK_DELAY_MS = 15 * 1000; // через сколько после финального сообщения кикать всех, сейчас 1 минута
const TIME_OPTIONS = {
  '🔴': 10, // эмодзи -> сколько минут match'а это означает
  '🟡': 15,
  '🟢': 30,
};

// ============================================================================
// ⚙️ НАСТРОЙКА: РЕГИСТРАЦИЯ
// ============================================================================
const REGISTRATION_CHANNEL_ID = '1539305884302442517';
const UNVERIFIED_ROLE_ID = '1539304276654825553';
const REGISTERED_ROLE_ID = '1539306711905476639';

const DB_PATH = path.join(__dirname, 'registrations.json');

function loadRegistrations() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveRegistrations(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================================
// ⚙️ НАСТРОЙКА: ВАРНЫ
// ============================================================================
// После скольких варнов выдаётся автоматический мут:
const WARNS_BEFORE_MUTE = 3;
// на сколько часов мьютит при достижении лимита варнов:
const AUTO_MUTE_HOURS = 4;

// ⚙️ НАСТРОЙКА: канал, куда бот выкладывает Embed с информацией о каждом
// выданном наказании (мут)
const PUNISHMENT_LOG_CHANNEL_ID = '1541076909851541614';

// ⚙️ НАСТРОЙКА: канал "Как создать лобби" — кнопка в финальном сообщении
// ведёт сюда, здесь же лежат 2 информационных сообщения с инструкцией
const LOBBY_GUIDE_CHANNEL_ID = '1541566352605585428';

// ⚙️ НАСТРОЙКА: текст настроек лобби для каждого режима — показывается
// приватно (видит только нажавший) при клике на кнопку DUELS/DM/AWM/HSDM
// во втором сообщении канала LOBBY_GUIDE_CHANNEL_ID.
// Впишите сюда реальные настройки для каждого режима вместо заглушки.
const LOBBY_SETTINGS_TEXT = {
  DUELS: '⚙️ **Для создания лобби для режима DUELS вам нужно:**\n \n• Зайти в игру, выбрать режим и убрать ползунок **публичная игра**, далее в настройках лобби выставить следующие значения:\n \n**Режим Лобби: Дуэли.\n \nКарта: выбранная при создании лобби на проекте.\n \nОстальные настройки: не менять!**',
  DM: '⚙️ **Для создания лобби для режима DM вам нужно:**\n \n• Зайти в игру, выбрать режим и убрать ползунок **публичная игра**, далее в настройках лобби выставить следующие значения:\n \n**Режим Лобби: Против всех.\n \nКарта: выбранная при создании лобби на проекте.\n \nДлительность матча: выбранное при создании лобби на проекте.\n \nДоступный арсенал: всё кроме «Тяжелое»\n \nОстальные настройки: не менять!**',
  AWM: '⚙️ **Для создания лобби для режима AWM вам нужно:**\n \n• Зайти в игру, выбрать режим и убрать ползунок **публичная игра**, далее в настройках лобби выставить следующие значения:\n \n**Режим Лобби: Против всех.\n \nКарта: выбранная при создании лобби на проекте.\n \nДлительность матча: выбранное при создании лобби на проекте.\n \nДоступный арсенал: AWM + DEAGLE\n \nОстальные настройки: не менять!**',
  HSDM: '⚙️ **Для создания лобби для режима HSDM вам нужно:**\n \n• Зайти в игру, выбрать режим и убрать ползунок **публичная игра**, далее в настройках лобби выставить следующие значения:\n \n**Режим Лобби: Против всех.\n \nКарта: выбранная при создании лобби на проекте.\n \nДлительность матча: выбранное при создании лобби на проекте.\n \nДоступный арсенал: всё кроме «Тяжелое»\n \nУрон только в голову: Включить!\n \nОстальные настройки: не менять!**',
  PISTOL: '⚙️ **Для создания лобби для режима PISTOL вам нужно:**\n \n• Зайти в игру, выбрать режим и убрать ползунок **публичная игра**, далее в настройках лобби выставить следующие значения:\n \n**Режим Лобби: Против всех. \n \nКарта: выбранная при создании лобби на проекте.\n \nДоступный арсенал:Только пистолеты \n \nОстальные настройки: не менять!**',
};

// ============================================================================
// ⚙️ НАСТРОЙКА: СТАТИСТИКА МАТЧЕЙ (распознавание скриншотов)
// ============================================================================
// Канал, где висит сообщение с кнопкой "Отправить результаты"
const RESULTS_CHANNEL_ID = 'ID_КАНАЛА_РЕЗУЛЬТАТОВ';

// ⚙️ НАСТРОЙКА: канал, где разрешена команда /профиль
// (если оставить null — команда будет работать в любом канале сервера)
const PROFILE_CHANNEL_ID = 'ID_КАНАЛА_ПРОФИЛЯ';

// файл-хранилище общей статистики: { userId: { kills, deaths } }
const STATS_PATH = path.join(__dirname, 'stats.json');

function loadStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveStats(data) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// threadId -> userId, кто должен прислать скриншот в эту ветку
// (нужно, чтобы бот не реагировал на случайные картинки в других ветках)
const pendingScreenshotThreads = new Map();

// последние "сырые" догадки OCR по каждой ветке — нужно, чтобы предзаполнить
// окно ручной проверки текстом для правки
const pendingGuesses = new Map(); // threadId -> [{nickname, kills, deaths}, ...]

// отправляет Embed-запись о наказании в PUNISHMENT_LOG_CHANNEL_ID
async function logPunishment({ violatorId, punishmentType, level, durationText, unmuteDate, moderatorId, comment }) {
  try {
    const channel = await client.channels.fetch(PUNISHMENT_LOG_CHANNEL_ID);
    const registrations = loadRegistrations();
    const violatorNickname = registrations[violatorId]?.nickname || 'не указан';

    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setTitle('Выдача наказания')
      .setThumbnail(client.users.cache.get(violatorId)?.displayAvatarURL() || null)
      .addFields(
        { name: 'Наказание', value: punishmentType, inline: false },
        ...(level ? [{ name: 'Уровень', value: level, inline: false }] : []),
        { name: 'Длительность', value: durationText, inline: false },
        { name: 'Размьют', value: unmuteDate, inline: false },
        { name: 'Нарушитель', value: `<@${violatorId}> | ${violatorNickname}`, inline: false },
        { name: 'Модератор', value: `<@${moderatorId}>`, inline: false },
        { name: 'Комментарий', value: comment || '—', inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Ошибка отправки лога наказания:', err);
  }
}

const WARNINGS_PATH = path.join(__dirname, 'warnings.json');

function loadWarnings() {
  try {
    return JSON.parse(fs.readFileSync(WARNINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveWarnings(data) {
  fs.writeFileSync(WARNINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================================
// АКТИВНЫЕ СЕССИИ ЛОББИ (это не настройка — трогать не нужно)
// ============================================================================
// hostId -> { voiceChannelId, textChannelId, messageIds: [] }
const lobbySessions = new Map();
const notifiedChannels = new Set();

// ============================================================================
// ГОТОВНОСТЬ БОТА
// ============================================================================
client.once('ready', async () => {
  console.log(`Бот запущен как ${client.user.tag}`);
  await ensureRegistrationMessage();
  await ensureInfoMessage();
  await ensureTicketChannelMessage();
  await ensureRulesMessage();
  await ensureLobbyGuideMessages();
  await ensureResultsMessage();
  await registerSlashCommands();
});

// ============================================================================
// ⚙️ НАСТРОЙКА: SLASH-КОМАНДЫ МОДЕРАЦИИ (/mute, /unmute)
// ============================================================================
// Пользоваться этими командами могут только участники с ролью MODERATOR_ROLE_ID.
// Мут реализован через встроенный в Discord тайм-аут — отдельная роль
// "замьюченный" не нужна, всё работает через штатный механизм Discord.
//
// КАК ДОБАВИТЬ ЕЩЁ КОМАНДУ: скопируйте один SlashCommandBuilder ниже,
// поменяйте .setName/.setDescription/.addXOption под себя, добавьте
// обработку в interactionCreate (поиск: "isChatInputCommand").
const slashCommands = [
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Замьютить игрока (тайм-аут)')
    .addUserOption((opt) => opt.setName('игрок').setDescription('Кого замьютить').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('минуты').setDescription('На сколько минут (максимум 40320 = 28 дней)').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('причина').setDescription('Причина мута').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Снять мут с игрока')
    .addUserOption((opt) => opt.setName('игрок').setDescription('С кого снять мут').setRequired(true)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription(`Выдать предупреждение игроку (после ${WARNS_BEFORE_MUTE} варнов — автомут на ${AUTO_MUTE_HOURS}ч)`)
    .addUserOption((opt) => opt.setName('игрок').setDescription('Кому выдать варн').setRequired(true))
    .addStringOption((opt) => opt.setName('причина').setDescription('Причина варна').setRequired(false)),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Изменить никнейм игрока на сервере')
    .addUserOption((opt) => opt.setName('игрок').setDescription('Кому меняем ник').setRequired(true))
    .addStringOption((opt) => opt.setName('никнейм').setDescription('Новый никнейм').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setid')
    .setDescription('Изменить привязанный игровой ID игрока')
    .addUserOption((opt) => opt.setName('игрок').setDescription('Кому меняем ID').setRequired(true))
    .addStringOption((opt) => opt.setName('id').setDescription('Новый игровой ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('профиль')
    .setDescription('Посмотреть свою статистику матчей (убийства, смерти, K/D)'),
];

async function registerSlashCommands() {
  try {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(slashCommands);
    }
  } catch (err) {
    console.error('Ошибка регистрации slash-команд:', err);
  }
}

async function ensureRegistrationMessage() {
  try {
    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === 'cyberstand-registration'
    );
    if (alreadyPosted) return;

    const attachment = new AttachmentBuilder(WELCOME_BANNER_IMAGE_PATH, { name: 'welcome-banner.png' });

    // ⚙️ НАСТРОЙКА: текст сообщения регистрации
    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**Вы зашли на проект CyberStand!**\n\n` +
        `**Доступ к созданию и входу в матчи будет доступен после окончания регистрации.**`
      )
      .setImage('attachment://welcome-banner.png')
      .setFooter({ text: 'cyberstand-registration' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_registration')
        .setLabel('Регистрация')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], files: [attachment], components: [row] });
  } catch (err) {
    console.error('Ошибка при отправке сообщения регистрации:', err);
  }
}

// отдельное информационное сообщение (текст про CyberStand + картинка "Хорошей игры!")
async function ensureInfoMessage() {
  try {
    const channel = await client.channels.fetch(INFO_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === 'cyberstand-info'
    );
    if (alreadyPosted) return;

    const attachment = new AttachmentBuilder(INFO_BANNER_IMAGE_PATH, { name: 'info-banner.png' });

    // ⚙️ НАСТРОЙКА: текст информационного сообщения
    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**CyberStand** - проект созданной для игроков в мобильной игре **Standoff 2**\n\n` +
        `На нашем проекте представлены множество режимов для тренировки своего **скилла**.\n\n` +
        `Проходи регистрацию и присоединяйся к нам, становясь лучше!\n\n` +
        `**CyberStand - спортзал для киберспортсмена**`
      )
      .setImage('attachment://info-banner.png')
      .setFooter({ text: 'cyberstand-info' });

    await channel.send({ embeds: [embed], files: [attachment] });
  } catch (err) {
    console.error('Ошибка при отправке информационного сообщения:', err);
  }
}

// сообщение в канале поддержки/тикетов с кнопкой "Создать тикет"
async function ensureTicketChannelMessage() {
  try {
    const channel = await client.channels.fetch(DISPUTE_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === 'cyberstand-support'
    );
    if (alreadyPosted) return;

    const attachment = new AttachmentBuilder(SUPPORT_BANNER_IMAGE_PATH, { name: 'support-banner.png' });

    // ⚙️ НАСТРОЙКА: текст сообщения в канале создания тикетов
    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**Вас приветствует поддержка проекта CyberStand**,\n\n` +
        `здесь вы можете пожаловаться на игрока за неправильное создание лобби/использование стороннего П/О,\n\n` +
        `**а также задать вопрос администратору касаемо проекта.**`
      )
      .setImage('attachment://support-banner.png')
      .setFooter({ text: 'cyberstand-support' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket_general')
        .setLabel('Создать тикет')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], files: [attachment], components: [row] });
  } catch (err) {
    console.error('Ошибка при отправке сообщения канала поддержки:', err);
  }
}

// правила — картинка сверху отдельным Embed, текст правил снизу вторым Embed
async function ensureRulesMessage() {
  try {
    const channel = await client.channels.fetch(RULES_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds.some((e) => e.footer?.text === 'cyberstand-rules-1')
    );
    if (alreadyPosted) return;

    const attachment = new AttachmentBuilder(RULES_SECTION1_BANNER_PATH, { name: 'rules-section1-banner.png' });

    const imageEmbed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setImage('attachment://rules-section1-banner.png');

    // ⚙️ НАСТРОЙКА: текст правил (раздел первый)
    const textEmbed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**1.0 Никнейм в игре**\n` +
        `Никнейм в игре должен совпадать с никнеймом на сервере.\n\n` +
        `> ⚠️ Наказание: Мут\n` +
        `> 🕐 Длительность: 24 часа\n\n` +
        `**1.1 Цензура никнейма**\n` +
        `Запрещены никнеймы с оскорблениями, запрещённой символикой и неприемлемыми темами. Ник меняют на rename и выдают мут.\n\n` +
        `> ⚠️ Наказание: Rename + мут\n` +
        `> 🕐 Длительность: 24 часа\n\n` +
        `**1.2 Цензура аватарки**\n` +
        `Запрещено использовать оскорбляющие изображения, изображения с запрещённой символикой или непристойным/вводящим в заблуждение содержанием.\n\n` +
        `> ⚠️ Наказание: Предупреждение + all warn\n\n` +
        `**1.3 Игровое айди**\n` +
        `Игровой айди, привязанный к профилю на сервере, должен совпадать с айди Вашего игрового аккаунта.\n\n` +
        `> ⚠️ Наказание: Сначала предупреждение, при повторении — мут\n` +
        `> 🕐 Длительность: 1 час`
      )
      .setFooter({ text: 'cyberstand-rules-1' });

    await channel.send({ embeds: [imageEmbed, textEmbed], files: [attachment] });
  } catch (err) {
    console.error('Ошибка при отправке сообщения с правилами:', err);
  }
}

// два информационных сообщения в канале "Как создать лобби"
async function ensureLobbyGuideMessages() {
  try {
    const channel = await client.channels.fetch(LOBBY_GUIDE_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds.some((e) => e.footer?.text === 'cyberstand-guide')
    );
    if (alreadyPosted) return;

    // ⚙️ НАСТРОЙКА: первое сообщение — "как играть"
    const embed1 = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**Что нужно для игры на CyberStand?**\n\n` +
        `• Для начала зайдите в список каналлов, найдите свободный и зайдите в него.\n\n` +
        `• Затем выберите карту и время игры.\n\n` +
        `• После выбора карты нажмите на **СКОПИРОВАТЬ ID**.\n\n` +
        `• Далее зайдите в игру и отправьте точку игроку чье ID вы скопировали\n\n` +
        `Все! Дождитесь начала матча и вступайте в бой\n\n` +
        `**Продуктивных тренировок!**`
      )
      .setFooter({ text: 'cyberstand-guide' });

    await channel.send({ embeds: [embed1] });

    // ⚙️ НАСТРОЙКА: второе сообщение — "как создать лобби" + кнопки режимов
    const embed2 = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**Что нужно для правильного создания лобби на CyberStand?**\n\n` +
        `• После выбора карты и времени игры зайдите в игру и дождитесь сообщений от игроков.\n\n` +
        `• После того как придут сообщения добавьте игроков в лобби и сделайте его **закрытым**\n\n` +
        `• Далее зайдите в настройки лобби и выставите значения показанные ниже для каждого из режимов.\n\n` +
        `• После захода всех игроков и настройки лобби нажмите кнопку играть и начинайте матч!\n\n` +
        `**Важно! Настройки лобби должны с точностью те которые вылезут по нажатию одной из кнопок ниже.\n` +
        `А ТАКЖЕ В НАСТРОЙКАХ ПРИВАТНОСТИ УКАЖИТЕ ЗНАЧЕНИЯ ТАК, ЧТОБЫ ИГРОКИ ОТПРАВЛЯЛИ ВАМ СООБЩЕНИЯ!**`
      );

    const row = new ActionRowBuilder().addComponents(
      Object.keys(LOBBY_SETTINGS_TEXT).map((modeName) =>
        new ButtonBuilder()
          .setCustomId(`lobby_settings:${modeName}`)
          .setLabel(modeName)
          .setStyle(ButtonStyle.Primary)
      )
    );

    await channel.send({ embeds: [embed2], components: [row] });
  } catch (err) {
    console.error('Ошибка при отправке сообщений канала "Как создать лобби":', err);
  }
}

// сообщение с кнопкой "Отправить результаты" в канале статистики
async function ensureResultsMessage() {
  try {
    const channel = await client.channels.fetch(RESULTS_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === 'cyberstand-results'
    );
    if (alreadyPosted) return;

    // ⚙️ НАСТРОЙКА: текст сообщения в канале результатов
    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**Сюда вы можете отправить результаты своего матча.**\n\n` +
        `Нажмите кнопку ниже, вам откроется приватная ветка, куда нужно ` +
        `прикрепить скриншот итоговой статистики матча.`
      )
      .setFooter({ text: 'cyberstand-results' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('submit_results')
        .setLabel('Отправить результаты')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('Ошибка при отправке сообщения канала результатов:', err);
  }
}

// ============================================================================
// РАСПОЗНАВАНИЕ СКРИНШОТА СТАТИСТИКИ (OCR)
// ============================================================================
// Скачивает картинку, прогоняет через Tesseract OCR, и для каждого
// ЗАРЕГИСТРИРОВАННОГО игрока пытается найти его никнейм в распознанном
// тексте и выцепить 3 числа сразу после него (это колонки У / П / С —
// убийства / помощь / смерти, именно в таком порядке в игре).
// Из-за того, что на скриншоте две таблицы рядом (CT и T), результат может
// быть неточным — поэтому дальше идёт шаг ручной проверки/правки.
async function recognizeScreenshot(imageUrl) {
  const response = await fetch(imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const { data } = await Tesseract.recognize(buffer, 'eng');
  const rawText = data.text.replace(/\n/g, ' ');

  const registrations = loadRegistrations();
  const guesses = [];

  for (const [userId, info] of Object.entries(registrations)) {
    const nickname = info.nickname;
    if (!nickname) continue;

    const idx = rawText.toLowerCase().indexOf(nickname.toLowerCase());
    if (idx === -1) continue;

    const after = rawText.slice(idx + nickname.length);
    const numbers = after.match(/\d{1,3}/g);
    if (!numbers || numbers.length < 3) continue;

    // порядок колонок в игре: У (убийства), П (помощь), С (смерти)
    const kills = parseInt(numbers[0], 10);
    const deaths = parseInt(numbers[2], 10);

    guesses.push({ userId, nickname, kills, deaths });
  }

  return guesses;
}

function guessesToText(guesses) {
  return guesses.map((g) => `${g.nickname} ${g.kills} ${g.deaths}`).join('\n');
}

// парсит текст вида "ник убийства смерти" (по одной строке на игрока)
function parseStatsText(text) {
  const registrations = loadRegistrations();
  const nicknameToUserId = {};
  for (const [userId, info] of Object.entries(registrations)) {
    if (info.nickname) nicknameToUserId[info.nickname.toLowerCase()] = userId;
  }

  const result = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const deaths = parseInt(parts[parts.length - 1], 10);
    const kills = parseInt(parts[parts.length - 2], 10);
    const nickname = parts.slice(0, parts.length - 2).join(' ');
    const userId = nicknameToUserId[nickname.toLowerCase()];

    if (!userId || isNaN(kills) || isNaN(deaths)) continue;

    result.push({ userId, nickname, kills, deaths });
  }

  return result;
}

// сохраняет результаты в stats.json (суммирует с уже имеющейся статистикой)
function commitStats(entries) {
  const stats = loadStats();
  for (const { userId, kills, deaths } of entries) {
    const current = stats[userId] || { kills: 0, deaths: 0 };
    stats[userId] = {
      kills: current.kills + kills,
      deaths: current.deaths + deaths,
    };
  }
  saveStats(stats);
}

// ============================================================================
// КАРТОЧКА СО СТАТИСТИКОЙ (Embed, без генерации картинки)
// ============================================================================
function buildStatsEmbed({ avatarURL, nickname, matchKills, matchDeaths, totalKills, totalDeaths }) {
  const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2);

  return new EmbedBuilder()
    .setColor(0xFF7A00)
    .setAuthor({ name: nickname, iconURL: avatarURL })
    .setThumbnail(avatarURL)
    .addFields(
      { name: 'За этот матч', value: `Убийств: **${matchKills}**\nСмертей: **${matchDeaths}**`, inline: true },
      { name: 'Всего', value: `Убийств: **${totalKills}**\nСмертей: **${totalDeaths}**`, inline: true },
      { name: 'K/D', value: `**${kd}**`, inline: false }
    );
}

// ============================================================================
// НОВЫЙ УЧАСТНИК СЕРВЕРА
// ============================================================================
// ============================================================================
// ПРИЁМ СКРИНШОТА СТАТИСТИКИ В ВЕТКЕ
// ============================================================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!pendingScreenshotThreads.has(message.channel.id)) return;
  if (pendingScreenshotThreads.get(message.channel.id) !== message.author.id) return;

  const imageAttachment = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (!imageAttachment) return;

  const processingMsg = await message.reply('Распознаю скриншот, подождите...');

  try {
    const guesses = await recognizeScreenshot(imageAttachment.url);

    if (guesses.length === 0) {
      await processingMsg.edit(
        'Не удалось автоматически распознать ни одного зарегистрированного игрока на скриншоте. ' +
        'Нажмите кнопку ниже, чтобы ввести статистику вручную.'
      );
      pendingGuesses.set(message.channel.id, []);
    } else {
      pendingGuesses.set(message.channel.id, guesses);

      const preview = guesses
        .map((g) => `**${g.nickname}** — Убийств: ${g.kills}, Смертей: ${g.deaths}`)
        .join('\n');

      await processingMsg.edit(
        `Распознано (проверьте перед подтверждением, OCR иногда ошибается):\n\n${preview}`
      );
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_stats').setLabel('✅ Подтвердить').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('edit_stats').setLabel('✏️ Исправить вручную').setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ components: [row] });
  } catch (err) {
    console.error('Ошибка распознавания скриншота:', err);
    await processingMsg.edit('Не удалось обработать скриншот. Попробуйте ещё раз или введите статистику вручную.');
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    await member.roles.add(UNVERIFIED_ROLE_ID);
  } catch (err) {
    console.error('Ошибка выдачи роли "Не зарегистрирован":', err);
  }
});

// ============================================================================
// ЗАПОЛНЕНИЕ ГОЛОСОВОГО КАНАЛА -> ЗАПУСК ВСЕЙ ЦЕПОЧКИ ЛОББИ
// ============================================================================
client.on('voiceStateUpdate', async (oldState, newState) => {
  const channel = newState.channel || oldState.channel;
  if (!channel) return;

  const binding = channelBindings[channel.id];
  if (!binding) return;

  const isFull = channel.userLimit > 0 && channel.members.size >= channel.userLimit;

  if (isFull && !notifiedChannels.has(channel.id)) {
    notifiedChannels.add(channel.id);

    const members = [...channel.members.values()];
    const chosen = members[Math.floor(Math.random() * members.length)];

    try {
      const textChannel = await client.channels.fetch(binding.textChannelId);

      lobbySessions.set(chosen.id, {
        voiceChannelId: channel.id,
        textChannelId: binding.textChannelId,
        mode: binding.mode || 'DUELS',
        fixedDuration: binding.fixedDuration ?? null,
        bannerPath: binding.bannerPath || DEFAULT_BANNER_IMAGE_PATH,
        memberIds: members.map((m) => m.id), // все игроки, которые были в лобби
        messageIds: [],
      });

      const lobbyMsg = await sendLobbyMessage(
        textChannel,
        chosen,
        binding.mode || 'DUELS',
        binding.bannerPath || DEFAULT_BANNER_IMAGE_PATH
      );
      lobbySessions.get(chosen.id).messageIds.push(lobbyMsg.id);

      const mapMsg = await sendMapSelection(textChannel, chosen, binding.maps || DEFAULT_MAPS);
      lobbySessions.get(chosen.id).messageIds.push(mapMsg.id);
    } catch (err) {
      console.error('Ошибка отправки сообщения о лобби:', err);
    }
  }

  if (!isFull) {
    notifiedChannels.delete(channel.id);
  }
});

// строит красную кнопку "Игрок не создал лобби"
// (по нажатию создаёт ветку-тикет в канале DISPUTE_CHANNEL_ID)
function buildReportButton(hostId) {
  return new ButtonBuilder()
    .setCustomId(`player_not_created:${hostId}`)
    .setLabel('Игрок не создал лобби')
    .setStyle(ButtonStyle.Danger);
}

async function sendLobbyMessage(textChannel, hostMember, mode, bannerPath) {
  const attachment = new AttachmentBuilder(bannerPath, { name: 'lobby-banner.png' });

  // ⚙️ НАСТРОЙКА: текст первого сообщения лобби
  const embed = new EmbedBuilder()
    .setColor(0xFF7A00)
    .setDescription(
      `**Вы создали лобби на CyberStand!**\n\n` +
      `**Хост лобби:** <@${hostMember.id}>\n\n` +
      `**Режим лобби:** ${mode}`
    )
    .setImage('attachment://lobby-banner.png');

  // кнопки "Получить ID" / "Игрок не создал лобби" убраны с этого сообщения —
  // они остались только на финальном сообщении (sendFinalMessage)
  return textChannel.send({
    embeds: [embed],
    files: [attachment],
  });
}

// ============================================================================
// ВЫБОР КАРТЫ — выпадающее меню (как в присланном видео), а не кнопки
// ============================================================================
async function sendMapSelection(textChannel, hostMember, maps) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`map_select:${hostMember.id}`)
    .setPlaceholder('Выберите карту для матча')
    .addOptions(
      maps.map((mapName) => ({
        label: mapName,
        value: mapName,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return textChannel.send({
    content: `<@${hostMember.id}>, выберите карту для матча:`,
    components: [row],
  });
}

// ============================================================================
// ГОЛОСОВАНИЕ ЗА ВРЕМЯ МАТЧА (реакции 🔴🟡🟢)
// ============================================================================
// ЧТОБЫ УБРАТЬ ЭТО ГОЛОСОВАНИЕ И СДЕЛАТЬ ФИКСИРОВАННОЕ ВРЕМЯ МАТЧА:
//   1) Ниже в этой функции удалите всё содержимое (весь код внутри фигурных
//      скобок функции startTimeVoting).
//   2) Замените его на одну строку:
//        await sendFinalMessage(textChannel, hostMember, mapName, 15);
//      (вместо 15 впишите нужное фиксированное количество минут).
//   Готово — голосование по реакциям больше не будет запускаться.
async function startTimeVoting(textChannel, hostMember, mapName, mode) {
  // сообщение голосования оформлено в том же стиле (Embed), что и финальное
  const embed = new EmbedBuilder()
    .setColor(0xFF7A00)
    .setDescription(
      `**Выберите желаемое время матча:**\n\n` +
      `🔴 — 10 минут\n` +
      `🟡 — 15 минут\n` +
      `🟢 — 30 минут`
    );

  const voteMsg = await textChannel.send({ embeds: [embed] });

  const session = lobbySessions.get(hostMember.id);
  if (session) session.messageIds.push(voteMsg.id);

  for (const emoji of Object.keys(TIME_OPTIONS)) {
    try {
      await voteMsg.react(emoji);
    } catch (err) {
      console.error('Ошибка добавления реакции:', err);
    }
  }

  setTimeout(async () => {
    try {
      const freshMsg = await voteMsg.fetch();

      let winningEmoji = '🔴';
      let maxVotes = -1;
      for (const emoji of Object.keys(TIME_OPTIONS)) {
        const reaction = freshMsg.reactions.cache.get(emoji);
        const count = reaction ? Math.max(reaction.count - 1, 0) : 0; // -1 убирает реакцию бота
        if (count > maxVotes) {
          maxVotes = count;
          winningEmoji = emoji;
        }
      }

      const duration = TIME_OPTIONS[winningEmoji];
      await sendFinalMessage(textChannel, hostMember, mapName, duration, mode);
    } catch (err) {
      console.error('Ошибка подсчёта голосования:', err);
    }
  }, VOTE_DURATION_MS);
}

// ============================================================================
// ФИНАЛЬНОЕ СООБЩЕНИЕ
// ============================================================================
async function sendFinalMessage(textChannel, hostMember, mapName, duration, mode) {
  // картинка та же, что и в приветственном сообщении лобби (свой баннер канала)
  const session = lobbySessions.get(hostMember.id);
  const bannerPath = session?.bannerPath || DEFAULT_BANNER_IMAGE_PATH;
  const attachment = new AttachmentBuilder(bannerPath, { name: 'match-info.png' });

  // все игроки, которые были в лобби — упоминаются перед финальным сообщением
  const memberIds = session ? session.memberIds : [];
  const mentions = memberIds.map((id) => `<@${id}>`).join(' ');

  // ⚙️ НАСТРОЙКА: текст финального сообщения
  const embed = new EmbedBuilder()
    .setColor(0xFF7A00)
    .setDescription(
      `**Режим лобби:** ${mode}\n\n` +
      `**Карта:** ${mapName}\n\n` +
      `**Время матча:** ${duration} мин`
    )
    .setImage('attachment://match-info.png');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`get_id:${hostMember.id}`)
      .setLabel('Получить ID')
      .setStyle(ButtonStyle.Success),
    buildReportButton(hostMember.id),
    new ButtonBuilder()
      .setLabel('Как создать лобби')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${textChannel.guild.id}/${LOBBY_GUIDE_CHANNEL_ID}`)
  );

  await textChannel.send({
    content: mentions || undefined,
    embeds: [embed],
    files: [attachment],
    components: [row],
  });

  setTimeout(() => cleanupLobby(hostMember.id), KICK_DELAY_MS);
}

async function cleanupLobby(hostId) {
  const session = lobbySessions.get(hostId);
  if (!session) return;

  try {
    const voiceChannel = await client.channels.fetch(session.voiceChannelId);
    const members = [...voiceChannel.members.values()];
    for (const member of members) {
      try {
        await member.voice.disconnect();
      } catch (err) {
        console.error('Ошибка кика участника:', err);
      }
    }
  } catch (err) {
    console.error('Ошибка получения голосового канала для кика:', err);
  }

  try {
    const textChannel = await client.channels.fetch(session.textChannelId);
    for (const msgId of session.messageIds) {
      try {
        const msg = await textChannel.messages.fetch(msgId);
        await msg.delete();
      } catch (err) {
        // сообщение уже могло быть удалено — пропускаем
      }
    }
  } catch (err) {
    console.error('Ошибка удаления сообщений лобби:', err);
  }

  lobbySessions.delete(hostId);
}

// ============================================================================
// ОБРАБОТКА ВСЕХ ВЗАИМОДЕЙСТВИЙ (кнопки, меню, модальные окна)
// ============================================================================
client.on('interactionCreate', async (interaction) => {
  // --- slash-команды модерации ---
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'mute' || interaction.commandName === 'unmute') {
      if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
        await interaction.reply({
          content: 'У вас нет прав использовать эту команду.',
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser('игрок');
      try {
        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        if (interaction.commandName === 'mute') {
          const minutes = interaction.options.getInteger('минуты');
          const reason = interaction.options.getString('причина') || 'Без причины';
          await targetMember.timeout(minutes * 60 * 1000, reason);

          const unmuteDate = new Date(Date.now() + minutes * 60 * 1000);
          await logPunishment({
            violatorId: targetUser.id,
            punishmentType: 'Мут',
            level: null,
            durationText: `${minutes} мин`,
            unmuteDate: unmuteDate.toLocaleString('ru-RU'),
            moderatorId: interaction.user.id,
            comment: reason,
          });

          await interaction.reply({
            content: `<@${targetUser.id}> замьючен на ${minutes} мин. Причина: ${reason}`,
            ephemeral: true,
          });
        } else {
          await targetMember.timeout(null);
          await interaction.reply({
            content: `С <@${targetUser.id}> снят мут.`,
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('Ошибка выполнения команды мута:', err);
        await interaction.reply({
          content: 'Не удалось выполнить команду. Проверьте права бота (Timeout Members) и что роль бота выше роли игрока.',
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.commandName === 'warn') {
      if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
        await interaction.reply({ content: 'У вас нет прав использовать эту команду.', ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser('игрок');
      const reason = interaction.options.getString('причина') || 'Без причины';

      const warnings = loadWarnings();
      const currentCount = (warnings[targetUser.id] || 0) + 1;

      try {
        if (currentCount >= WARNS_BEFORE_MUTE) {
          // лимит варнов достигнут — автомут и сброс счётчика
          const targetMember = await interaction.guild.members.fetch(targetUser.id);
          await targetMember.timeout(AUTO_MUTE_HOURS * 60 * 60 * 1000, `Автомут: ${WARNS_BEFORE_MUTE} варна`);
          warnings[targetUser.id] = 0;
          saveWarnings(warnings);

          const unmuteDate = new Date(Date.now() + AUTO_MUTE_HOURS * 60 * 60 * 1000);
          await logPunishment({
            violatorId: targetUser.id,
            punishmentType: 'Мут (автовыдача за варны)',
            level: `${WARNS_BEFORE_MUTE}/${WARNS_BEFORE_MUTE}`,
            durationText: `${AUTO_MUTE_HOURS} ч`,
            unmuteDate: unmuteDate.toLocaleString('ru-RU'),
            moderatorId: interaction.user.id,
            comment: reason,
          });

          await interaction.reply({
            content:
              `<@${targetUser.id}> получил ${WARNS_BEFORE_MUTE}-й варн (причина: ${reason}) и автоматически ` +
              `замьючен на ${AUTO_MUTE_HOURS}ч. Счётчик варнов сброшен.`,
            ephemeral: true,
          });
        } else {
          warnings[targetUser.id] = currentCount;
          saveWarnings(warnings);

          await interaction.reply({
            content: `<@${targetUser.id}> получил варн (${currentCount}/${WARNS_BEFORE_MUTE}). Причина: ${reason}`,
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('Ошибка выполнения команды /warn:', err);
        await interaction.reply({
          content: 'Не удалось выполнить команду. Проверьте права бота.',
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.commandName === 'rename') {
      if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
        await interaction.reply({ content: 'У вас нет прав использовать эту команду.', ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser('игрок');
      const newNickname = interaction.options.getString('никнейм');

      try {
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        await targetMember.setNickname(newNickname);
        await interaction.reply({
          content: `Никнейм <@${targetUser.id}> изменён на **${newNickname}**.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error('Ошибка выполнения команды /rename:', err);
        await interaction.reply({
          content: 'Не удалось сменить никнейм. Проверьте, что роль бота выше роли игрока.',
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.commandName === 'setid') {
      if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
        await interaction.reply({ content: 'У вас нет прав использовать эту команду.', ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser('игрок');
      const newGameId = interaction.options.getString('id');

      const registrations = loadRegistrations();

      const duplicate = Object.entries(registrations).find(
        ([userId, data]) => userId !== targetUser.id && data.gameId === newGameId
      );
      if (duplicate) {
        await interaction.reply({
          content: 'Этот игровой ID уже привязан к другому игроку.',
          ephemeral: true,
        });
        return;
      }

      registrations[targetUser.id] = {
        nickname: registrations[targetUser.id]?.nickname || targetUser.username,
        gameId: newGameId,
      };
      saveRegistrations(registrations);

      await interaction.reply({
        content: `Игровой ID <@${targetUser.id}> изменён на **${newGameId}**.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === 'профиль') {
      if (PROFILE_CHANNEL_ID && PROFILE_CHANNEL_ID !== 'ID_КАНАЛА_ПРОФИЛЯ' && interaction.channel.id !== PROFILE_CHANNEL_ID) {
        await interaction.reply({
          content: `Эту команду можно использовать только в канале <#${PROFILE_CHANNEL_ID}>.`,
          ephemeral: true,
        });
        return;
      }

      const registrations = loadRegistrations();
      const myInfo = registrations[interaction.user.id];
      const nickname = myInfo?.nickname || interaction.user.username;

      const stats = loadStats();
      const myStats = stats[interaction.user.id] || { kills: 0, deaths: 0 };
      const kd = myStats.deaths > 0 ? (myStats.kills / myStats.deaths).toFixed(2) : myStats.kills.toFixed(2);

      const embed = new EmbedBuilder()
        .setColor(0xFF7A00)
        .setAuthor({ name: nickname, iconURL: interaction.user.displayAvatarURL() })
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: 'Убийств', value: `**${myStats.kills}**`, inline: true },
          { name: 'Смертей', value: `**${myStats.deaths}**`, inline: true },
          { name: 'K/D', value: `**${kd}**`, inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  }

  // --- кнопка "Регистрация" -> открыть модальное окно ---
  if (interaction.isButton() && interaction.customId === 'open_registration') {
    const modal = new ModalBuilder()
      .setCustomId('registration_modal')
      .setTitle('Регистрация профиля CyberStand');

    const nicknameInput = new TextInputBuilder()
      .setCustomId('reg_nickname')
      .setLabel('Игровой никнейм')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const gameIdInput = new TextInputBuilder()
      .setCustomId('reg_gameid')
      .setLabel('Игровой ID')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nicknameInput),
      new ActionRowBuilder().addComponents(gameIdInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // --- отправка модального окна регистрации ---
  if (interaction.isModalSubmit() && interaction.customId === 'registration_modal') {
    const nickname = interaction.fields.getTextInputValue('reg_nickname');
    const gameId = interaction.fields.getTextInputValue('reg_gameid');

    const registrations = loadRegistrations();

    // проверка: этот игровой ID уже зарегистрирован другим человеком?
    const duplicate = Object.entries(registrations).find(
      ([userId, data]) => userId !== interaction.user.id && data.gameId === gameId
    );

    if (duplicate) {
      await interaction.reply({
        content: `Этот игровой ID уже зарегистрирован другим игроком. Проверьте правильность ввода.`,
        ephemeral: true,
      });
      return;
    }

    registrations[interaction.user.id] = { nickname, gameId };
    saveRegistrations(registrations);

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.remove(UNVERIFIED_ROLE_ID);
      await member.roles.add(REGISTERED_ROLE_ID);

      // никнейм на сервере = игровой никнейм из регистрации
      // (может не сработать для владельца сервера — так работает сам Discord API,
      // и если роль бота стоит НИЖЕ роли этого игрока — тогда тоже не сработает)
      try {
        await member.setNickname(nickname);
      } catch (nickErr) {
        console.error('Не удалось установить никнейм (обычно из-за роли/прав):', nickErr);
      }
    } catch (err) {
      console.error('Ошибка смены роли после регистрации:', err);
    }

    await interaction.reply({
      content: `Регистрация завершена! Никнейм: **${nickname}**, ID: **${gameId}**. Добро пожаловать на CyberStand 🎉`,
      ephemeral: true,
    });
    return;
  }

  // --- выбор карты хостом (выпадающее меню) ---
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('map_select:')) {
    const hostId = interaction.customId.split(':')[1];
    const mapName = interaction.values[0];

    if (interaction.user.id !== hostId) {
      await interaction.reply({
        content: 'Эта кнопка не для вас — карту выбирает только хост лобби.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.update({
        content: `Карта выбрана: **${mapName}**`,
        components: [],
      });
    } catch (err) {
      console.error('Ошибка обновления сообщения выбора карты:', err);
    }

    const textChannel = interaction.channel;
    const hostMember = interaction.member;
    const session = lobbySessions.get(hostId);
    const mode = session ? session.mode : 'DUELS';
    const fixedDuration = session ? session.fixedDuration : null;

    if (fixedDuration) {
      // голосование отключено для этого канала — сразу финальное сообщение
      await sendFinalMessage(textChannel, hostMember, mapName, fixedDuration, mode);
    } else {
      await startTimeVoting(textChannel, hostMember, mapName, mode);
    }
    return;
  }

  // --- кнопка "Отправить результаты" -> создаём приватную ветку для скриншота ---
  if (interaction.isButton() && interaction.customId === 'submit_results') {
    try {
      const resultsChannel = await client.channels.fetch(RESULTS_CHANNEL_ID);
      const thread = await createDisputeThread(resultsChannel, interaction.user.id);

      pendingScreenshotThreads.set(thread.id, interaction.user.id);

      await thread.send({
        content:
          `<@${interaction.user.id}>, прикрепите скриншот итоговой статистики матча ` +
          `**одним сообщением** сюда — бот распознает его автоматически.`,
      });

      await interaction.reply({
        content: `Ветка создана: <#${thread.id}>`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('Ошибка создания ветки для результатов:', err);
      await interaction.reply({
        content: 'Не удалось создать ветку. Сообщите об этом администратору.',
        ephemeral: true,
      });
    }
    return;
  }

  // --- кнопка "✅ Подтвердить" после распознавания скриншота ---
  if (interaction.isButton() && interaction.customId === 'confirm_stats') {
    const guesses = pendingGuesses.get(interaction.channel.id);
    if (!guesses || guesses.length === 0) {
      await interaction.reply({ content: 'Нечего подтверждать — данные устарели.', ephemeral: true });
      return;
    }

    commitStats(guesses);
    pendingGuesses.delete(interaction.channel.id);
    pendingScreenshotThreads.delete(interaction.channel.id);

    await interaction.reply({ content: 'Статистика зачислена!', ephemeral: false });

    const stats = loadStats();
    for (const g of guesses) {
      try {
        const user = await client.users.fetch(g.userId);
        const total = stats[g.userId] || { kills: g.kills, deaths: g.deaths };
        const embed = buildStatsEmbed({
          avatarURL: user.displayAvatarURL({ extension: 'png', size: 128 }),
          nickname: g.nickname,
          matchKills: g.kills,
          matchDeaths: g.deaths,
          totalKills: total.kills,
          totalDeaths: total.deaths,
        });
        await interaction.channel.send({ content: `<@${g.userId}>`, embeds: [embed] });
      } catch (err) {
        console.error('Ошибка построения карточки статистики:', err);
      }
    }
    return;
  }

  // --- кнопка "✏️ Исправить вручную" после распознавания скриншота ---
  if (interaction.isButton() && interaction.customId === 'edit_stats') {
    const guesses = pendingGuesses.get(interaction.channel.id) || [];

    const modal = new ModalBuilder()
      .setCustomId('edit_stats_modal')
      .setTitle('Проверьте и поправьте статистику');

    const input = new TextInputBuilder()
      .setCustomId('stats_text')
      .setLabel('Ник Убийства Смерти (по одному игроку на строку)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(guessesToText(guesses) || '')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  // --- отправка исправленной статистики из модального окна ---
  if (interaction.isModalSubmit() && interaction.customId === 'edit_stats_modal') {
    const text = interaction.fields.getTextInputValue('stats_text');
    const entries = parseStatsText(text);

    if (entries.length === 0) {
      await interaction.reply({
        content: 'Не удалось распознать ни одной строки. Формат: Ник Убийства Смерти, каждый игрок с новой строки.',
        ephemeral: true,
      });
      return;
    }

    commitStats(entries);
    pendingGuesses.delete(interaction.channel.id);
    pendingScreenshotThreads.delete(interaction.channel.id);

    await interaction.reply({ content: 'Статистика зачислена!', ephemeral: false });

    const stats = loadStats();
    for (const e of entries) {
      try {
        const user = await client.users.fetch(e.userId);
        const total = stats[e.userId] || { kills: e.kills, deaths: e.deaths };
        const embed = buildStatsEmbed({
          avatarURL: user.displayAvatarURL({ extension: 'png', size: 128 }),
          nickname: e.nickname,
          matchKills: e.kills,
          matchDeaths: e.deaths,
          totalKills: total.kills,
          totalDeaths: total.deaths,
        });
        await interaction.channel.send({ content: `<@${e.userId}>`, embeds: [embed] });
      } catch (err) {
        console.error('Ошибка построения карточки статистики:', err);
      }
    }
    return;
  }

  // --- кнопка "Игрок не создал лобби" -> создаём приватную ветку-тикет ---
  if (interaction.isButton() && interaction.customId.startsWith('player_not_created:')) {
    const hostId = interaction.customId.split(':')[1];
    const registrations = loadRegistrations();
    const hostGameId = registrations[hostId]?.gameId || 'не указан';

    try {
      const disputeChannel = await client.channels.fetch(DISPUTE_CHANNEL_ID);
      const thread = await createDisputeThread(disputeChannel, interaction.user.id);

      // ⚙️ НАСТРОЙКА: текст сообщения в ветке-тикете (жалоба на игрока)
      const embed = new EmbedBuilder()
        .setColor(0xFF7A00)
        .setTitle('ИГРОК НЕ ЗАШЁЛ В ИГРУ')
        .setThumbnail(client.user.displayAvatarURL())
        .setDescription(
          `**Нарушитель:** <@${hostId}> | ${hostGameId}\n\n` +
          `<@${interaction.user.id}>, предоставьте скриншот, подтверждающий нарушение, ` +
          `что игрок не зашёл в течение 5 минут в игровое лобби.`
        )
        .setTimestamp();

      await thread.send({
        content: `<@&${MODERATOR_ROLE_ID}>`,
        embeds: [embed],
        components: [buildCloseButtonRow()],
      });

      await interaction.reply({
        content: `Тикет создан: <#${thread.id}>`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('Ошибка создания ветки-тикета:', err);
      await interaction.reply({
        content: 'Не удалось создать тикет. Сообщите об этом администратору.',
        ephemeral: true,
      });
    }
    return;
  }

  // --- кнопка "Создать тикет" (общий тикет из канала поддержки) ---
  if (interaction.isButton() && interaction.customId === 'create_ticket_general') {
    try {
      const disputeChannel = await client.channels.fetch(DISPUTE_CHANNEL_ID);
      const thread = await createDisputeThread(disputeChannel, interaction.user.id);

      // ⚙️ НАСТРОЙКА: текст сообщения в ветке-тикете (общее обращение)
      const embed = new EmbedBuilder()
        .setColor(0xFF7A00)
        .setTitle('НОВЫЙ ТИКЕТ')
        .setThumbnail(client.user.displayAvatarURL())
        .setDescription(
          `**Открыл:** <@${interaction.user.id}>\n\n` +
          `Опишите вашу жалобу или вопрос ниже — администратор скоро ответит.`
        )
        .setTimestamp();

      await thread.send({
        content: `<@&${MODERATOR_ROLE_ID}>`,
        embeds: [embed],
        components: [buildCloseButtonRow()],
      });

      await interaction.reply({
        content: `Тикет создан: <#${thread.id}>`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('Ошибка создания ветки-тикета:', err);
      await interaction.reply({
        content: 'Не удалось создать тикет. Сообщите об этом администратору.',
        ephemeral: true,
      });
    }
    return;
  }

  // --- кнопка "Закрыть" внутри ветки-тикета (только для модерации) ---
  if (interaction.isButton() && interaction.customId === 'close_thread') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageThreads)) {
      await interaction.reply({
        content: 'Закрывать тикеты может только модерация.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.reply({ content: 'Тикет закрыт.', ephemeral: true });
      const thread = interaction.channel;
      await thread.setLocked(true);
      await thread.setArchived(true);
    } catch (err) {
      console.error('Ошибка закрытия ветки:', err);
    }
    return;
  }

  // --- кнопки DUELS/DM/AWM/HSDM в канале "Как создать лобби" ---
  if (interaction.isButton() && interaction.customId.startsWith('lobby_settings:')) {
    const modeName = interaction.customId.split(':')[1];
    const text = LOBBY_SETTINGS_TEXT[modeName] || `Настройки для режима ${modeName} не найдены.`;
    await interaction.reply({
      content: text,
      ephemeral: true,
    });
    return;
  }

  // --- кнопка "Получить ID" ---
  if (interaction.isButton() && interaction.customId.startsWith('get_id:')) {
    const hostId = interaction.customId.split(':')[1];
    const registrations = loadRegistrations();
    const hostData = registrations[hostId];

    if (hostData) {
      await interaction.reply({
        content: `${hostData.gameId}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'Хост лобби ещё не завершил регистрацию.',
        ephemeral: true,
      });
    }
    return;
  }
});

client.login(process.env.BOT_TOKEN);
