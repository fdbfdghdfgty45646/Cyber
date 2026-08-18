const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// ==== НАСТРОЙКИ ====
// Настройка: voice-канал -> текстовый канал, куда слать сообщение о лобби
const channelBindings = {
  '1538539446348288064': {
    textChannelId: '1538884563236032602',
  },
  // добавляйте другие пары по аналогии
};

// коды, которые бот присылает по нажатию кнопок (видно только нажавшему)
const GREEN_BUTTON_CODE = '17362';
const RED_BUTTON_CODE = '74638';

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

    // выбираем случайного участника голосового канала — он станет хостом
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
    notifiedChannels.delete(channel.id); // сброс, чтобы сработало снова в следующий раз
  }
});

async function sendLobbyMessage(textChannel, hostMember) {
  const embed = new EmbedBuilder()
    .setColor(0xFF7A00) // цвет полоски слева, как на примере
    .setDescription(
      `**Вы создали лобби на CyberStand!**\n\n` +
      `**Хост лобби:** <@${hostMember.id}>\n\n` +
      `**Режим лобби:** DUELS`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('get_id')
      .setLabel('Получить ID')
      .setStyle(ButtonStyle.Success), // зелёная
    new ButtonBuilder()
      .setCustomId('player_not_created')
      .setLabel('Игрок не создал лобби')
      .setStyle(ButtonStyle.Danger) // красная
  );

  await textChannel.send({
    embeds: [embed],
    components: [row],
  });
}

// обработка нажатий на кнопки (видно только тому, кто нажал)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'get_id') {
    await interaction.reply({
      content: `${GREEN_BUTTON_CODE}`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === 'player_not_created') {
    await interaction.reply({
      content: `${RED_BUTTON_CODE}`,
      ephemeral: true,
    });
    return;
  }
});

client.login(process.env.BOT_TOKEN);
