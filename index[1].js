const fs = require('fs');
const path = require('path');
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
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// ============ НАСТРОЙКИ ЛОББИ ============
// Настройка: voice-канал -> текстовый канал, куда слать сообщение о лобби
const channelBindings = {
  '1538539446348288064': {
    textChannelId: '1538884563236032602',
  },
  // добавляйте другие пары по аналогии
};

const RED_BUTTON_CODE = '74638'; // код для кнопки "Игрок не создал лобби"
const BANNER_IMAGE_PATH = './images/lobby-banner.png'; // картинка снизу в Embed лобби

// ============ НАСТРОЙКИ РЕГИСТРАЦИИ ============
const REGISTRATION_CHANNEL_ID = '1539305884302442517'; // канал, где висит сообщение регистрации
const UNVERIFIED_ROLE_ID = '1539304276654825553'; // роль, которую снимаем после регистрации
const REGISTERED_ROLE_ID = '1539306711905476639'; // роль, которую выдаём после регистрации

// файл, где хранятся никнеймы и игровые ID зарегистрированных игроков
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

// ============ ГОТОВНОСТЬ БОТА ============
client.once('ready', async () => {
  console.log(`Бот запущен как ${client.user.tag}`);
  await ensureRegistrationMessage();
});

// чтобы не дублировать сообщение регистрации при каждом рестарте бота
async function ensureRegistrationMessage() {
  try {
    const channel = await client.channels.fetch(REGISTRATION_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 20 });
    const alreadyPosted = messages.some(
      (m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === 'cyberstand-registration'
    );
    if (alreadyPosted) return;

    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setDescription(
        `**Вы зашли на проект CyberStand!**\n\n` +
        `**Доступ к созданию и входу в матчи будет доступен после окончания регистрации.**`
      )
      .setFooter({ text: 'cyberstand-registration' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_registration')
        .setLabel('Регистрация')
        .setStyle(ButtonStyle.Success) // зелёная
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('Ошибка при отправке сообщения регистрации:', err);
  }
}

// ============ НОВЫЙ УЧАСТНИК СЕРВЕРА ============
client.on('guildMemberAdd', async (member) => {
  try {
    await member.roles.add(UNVERIFIED_ROLE_ID);
  } catch (err) {
    console.error('Ошибка выдачи роли "Не зарегистрирован":', err);
  }
});

// ============ ЗАПОЛНЕНИЕ ГОЛОСОВОГО КАНАЛА -> СООБЩЕНИЕ О ЛОББИ ============
const notifiedChannels = new Set();

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
      await sendLobbyMessage(textChannel, chosen);
    } catch (err) {
      console.error('Ошибка отправки сообщения о лобби:', err);
    }
  }

  if (!isFull) {
    notifiedChannels.delete(channel.id);
  }
});

async function sendLobbyMessage(textChannel, hostMember) {
  const attachment = new AttachmentBuilder(BANNER_IMAGE_PATH, { name: 'lobby-banner.png' });

  const embed = new EmbedBuilder()
    .setColor(0xFF7A00)
    .setDescription(
      `**Вы создали лобби на CyberStand!**\n\n` +
      `**Хост лобби:** <@${hostMember.id}>\n\n` +
      `**Режим лобби:** DUELS`
    )
    .setImage('attachment://lobby-banner.png');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`get_id:${hostMember.id}`) // ID хоста зашит в кнопку
      .setLabel('Получить ID')
      .setStyle(ButtonStyle.Success), // зелёная
    new ButtonBuilder()
      .setCustomId('player_not_created')
      .setLabel('Игрок не создал лобби')
      .setStyle(ButtonStyle.Danger) // красная
  );

  await textChannel.send({
    embeds: [embed],
    files: [attachment],
    components: [row],
  });
}

// ============ ОБРАБОТКА ВСЕХ ВЗАИМОДЕЙСТВИЙ ============
client.on('interactionCreate', async (interaction) => {
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
    registrations[interaction.user.id] = { nickname, gameId };
    saveRegistrations(registrations);

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.remove(UNVERIFIED_ROLE_ID);
      await member.roles.add(REGISTERED_ROLE_ID);
    } catch (err) {
      console.error('Ошибка снятия роли "Не зарегистрирован":', err);
    }

    await interaction.reply({
      content: `Регистрация завершена! Никнейм: **${nickname}**, ID: **${gameId}**. Добро пожаловать на CyberStand 🎉`,
      ephemeral: true,
    });
    return;
  }

  // --- кнопка "Получить ID" в лобби ---
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

  // --- кнопка "Игрок не создал лобби" ---
  if (interaction.isButton() && interaction.customId === 'player_not_created') {
    await interaction.reply({
      content: `${RED_BUTTON_CODE}`,
      ephemeral: true,
    });
    return;
  }
});

client.login(process.env.BOT_TOKEN);
