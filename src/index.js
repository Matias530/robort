require('dotenv').config();
const { ActivityType, Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('node:fs');
const path = require('node:path');
const { createResponseEmbed } = require('./utils/response-embed.js');
const { getGuildQueue, stopPlayback } = require('./commands/play.js');

const emptyVoiceTimeoutMs = 5 * 60 * 1000;
const emptyVoiceTimers = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

const handleClientReady = () => {
  client.user.setActivity('Geometry Dash 2.3', { type: ActivityType.Playing });
  console.log(`Bot conectado como ${client.user.tag}`);
};

client.once('clientReady', handleClientReady);

function clearEmptyVoiceTimer(guildId) {
  const timer = emptyVoiceTimers.get(guildId);
  if (!timer) return;

  clearTimeout(timer.timeout);
  emptyVoiceTimers.delete(guildId);
}

client.on('voiceStateUpdate', (oldState, newState) => {
  const guild = newState.guild;
  const connection = getVoiceConnection(guild.id);

  if (!connection) {
    clearEmptyVoiceTimer(guild.id);
    return;
  }

  const channelId = connection.joinConfig.channelId;
  if (oldState.channelId !== channelId && newState.channelId !== channelId) return;

  const voiceChannel = guild.channels.cache.get(channelId);
  const hasListeners = voiceChannel?.members.some(member => !member.user.bot) ?? false;

  if (hasListeners) {
    clearEmptyVoiceTimer(guild.id);
    return;
  }

  const currentTimer = emptyVoiceTimers.get(guild.id);
  if (currentTimer?.channelId === channelId) return;
  clearEmptyVoiceTimer(guild.id);

  const timeout = setTimeout(async () => {
    emptyVoiceTimers.delete(guild.id);

    const activeConnection = getVoiceConnection(guild.id);
    if (!activeConnection || activeConnection.joinConfig.channelId !== channelId) return;

    const activeChannel = guild.channels.cache.get(channelId);
    const hasReturnedListeners = activeChannel?.members.some(member => !member.user.bot) ?? false;
    if (hasReturnedListeners) return;

    const playback = getGuildQueue(guild.id);
    if (playback) {
      playback.queue.length = 0;
      playback.loop = false;
      playback.current = null;
      await stopPlayback(guild.id);
    } else {
      activeConnection.destroy();
    }

    console.log(`Canal de voz vacío durante 5 minutos en ${guild.name}; bot desconectado.`);
  }, emptyVoiceTimeoutMs);

  emptyVoiceTimers.set(guild.id, { channelId, timeout });
});

client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    try {
      if (command?.autocomplete) {
        await command.autocomplete(interaction);
      } else {
        await interaction.respond([]);
      }
    } catch (error) {
      console.error(`Error buscando opciones para /${interaction.commandName}:`, error);
      if (!interaction.responded) {
        await interaction.respond([]).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No se encontró el comando: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    const isUnknownInteraction = error?.code === 10062 || error?.status === 404 || error?.message === 'Unknown interaction';
    if (isUnknownInteraction) return;

    try {
      if (!interaction.isRepliable()) return;

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [createResponseEmbed('😕 Algo no salió bien', 'Prueba otra vez en un momento.', 'error')],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [createResponseEmbed('😕 Algo no salió bien', 'Prueba otra vez en un momento.', 'error')],
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      const isUnknownInteractionReply = replyError?.code === 10062 || replyError?.status === 404 || replyError?.message === 'Unknown interaction';
      if (!isUnknownInteractionReply) {
        console.error(replyError);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
