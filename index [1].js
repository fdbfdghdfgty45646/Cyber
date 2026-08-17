const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// ==== НАСТРОЙКИ ====
// Настройка: voice-канал -> { текстовый канал для ОБЩЕГО уведомления, текст сообщения }
const channelBindings = {
  '1538539446348288064': {
    textChannelId: '1538884563236032602',
    message: 'Лобби заполнено! 🎉',
  },
  // добавляйте другие пары по аналогии
};

const CATEGORY_ID = null; // опционально: ID категории для приватных каналов лобби (или null)
const GUIDE_URL = ''; // ссылка на руководство по созданию лобби

const notifiedChannels = new Set(); // чтобы не спамить повторно

client.once('ready', () => {
  console.log(`Бот запущен как ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const channel = newState.channel || oldState.channel;
  if (!channel) return;

  const binding = channelBindings[channel.id];
  if (!binding) return;

  const isFull = channel.userLimit > 0 && channel.members.size >= channel.userLimit;

  if (isFull && !notifiedChannels.has(channel.id)) {
    notifiedChannels.add(channel.id);

    // 1) общее уведомление в текстовый канал, видит вся гильдия/канал
    try {
      const textChannel = await client.channels.fetch(binding.textChannelId);
      await textChannel.send(binding.message);
    } catch (err) {
      console.error('Ошибка отправки общего сообщения:', err);
    }

    // 2) выбираем случайного участника голосового канала и создаём ему приватный канал
    const members = [...channel.members.values()];
    const chosen = members[Math.floor(Math.random() * members.length)];

    try {
      await createPrivateLobbyChannel(channel.guild, chosen);
    } catch (err) {
      console.error('Ошибка создания приватного канала:', err);
    }
  }

  if (!isFull) {
    notifiedChannels.delete(channel.id); // сброс, чтобы сработало снова в следующий раз
  }
});

async function createPrivateLobbyChannel(guild, member) {
  // создаём текстовый канал, видимый только выбранному участнику и боту
  const privateChannel = await guild.channels.create({
    name: `лобби-${member.user.username}`,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID || undefined,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: guild.members.me.id, // бот тоже должен видеть канал
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
      },
    ],
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Руководство по созданию лобби')
      .setStyle(ButtonStyle.Link)
      .setURL(GUIDE_URL),
    new ButtonBuilder()
      .setCustomId('create_lobby')
      .setLabel('Создать')
      .setStyle(ButtonStyle.Primary)
  );

  await privateChannel.send({
    content: `<@${member.id}>, теперь ты создаёшь лобби!`,
    components: [row],
  });
}

// обработка нажатия на кнопку "Создать"
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'create_lobby') return;

  // здесь можно вписать реальную логику создания лобби
  await interaction.reply({
    content: 'Лобби создаётся... 🎮',
    ephemeral: true,
  });
});

client.login(process.env.BOT_TOKEN);
