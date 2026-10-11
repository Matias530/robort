const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { VoiceConnectionStatus, entersState, getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Se une al canal de voz en el que estás conectado.'),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎙️ Entra a un canal de voz', 'Cuando estés conectado, me uno contigo.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const existingConnection = getVoiceConnection(interaction.guild.id);
    const currentChannelId = existingConnection?.joinConfig?.channelId;

    if (currentChannelId === voiceChannel.id) {
      return interaction.reply({
        embeds: [createResponseEmbed('🔊 Ya estoy aquí', 'Ya compartimos canal, ¡ponemos música cuando quieras!', 'success')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

      return interaction.editReply({
        embeds: [createResponseEmbed('🔊 ¡Ya llegué!', `Estoy contigo en **${voiceChannel.name}**.`, 'success')],
      });
    } catch (error) {
      console.error('Error al unirse al canal:', error);
      return interaction.editReply({
        embeds: [createResponseEmbed('😕 No pude entrar', 'Prueba otra vez en un momento.', 'error')],
      });
    }
  },
};
