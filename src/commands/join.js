const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { VoiceConnectionStatus, entersState, getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Se une al canal de voz en el que estás conectado.'),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: 'Debes estar en un canal de voz para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const existingConnection = getVoiceConnection(interaction.guild.id);
    const currentChannelId = existingConnection?.joinConfig?.channelId;

    if (currentChannelId === voiceChannel.id) {
      return interaction.reply({
        content: 'Ya estoy en tu canal de voz.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      if (existingConnection && existingConnection.joinConfig.channelId !== voiceChannel.id) {
        existingConnection.destroy();
      }

      const connection = existingConnection && existingConnection.joinConfig.channelId === voiceChannel.id
        ? existingConnection
        : joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false,
          });

      connection.on('error', error => {
        console.error('Error de conexión de voz en /join:', error);
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

      return interaction.reply({
        content: `Conectado a **${voiceChannel.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error al unirse al canal:', error);
      return interaction.reply({
        content: 'No pude unirme a tu canal de voz.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
