const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { stopPlayback } = require('./play.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Abandona el canal de voz solo si estás en el mismo canal que el bot.'),

  async execute(interaction) {
    const memberChannel = interaction.member?.voice?.channel;
    const connection = getVoiceConnection(interaction.guild.id);

    if (!memberChannel) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎙️ Primero entra a voz', 'Tienes que estar conectado al canal del bot para que me vaya.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!connection || connection.joinConfig.channelId !== memberChannel.id) {
      return interaction.reply({
        embeds: [createResponseEmbed('🔊 Estamos en canales distintos', 'Ven al canal donde estoy y ahí sí me puedo ir.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      stopPlayback(interaction.guild.id);
      connection.destroy();

      return interaction.reply({
        embeds: [createResponseEmbed('👋 Ya me fui', 'La música se detuvo y salí del canal.', 'success')],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error al salir del canal:', error);
      return interaction.reply({
        embeds: [createResponseEmbed('😕 No pude salir', 'Inténtalo de nuevo dentro de un momento.', 'error')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
