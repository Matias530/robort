const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { stopPlayback } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Abandona el canal de voz solo si estás en el mismo canal que el bot.'),

  async execute(interaction) {
    const memberChannel = interaction.member?.voice?.channel;
    const connection = getVoiceConnection(interaction.guild.id);

    if (!memberChannel) {
      return interaction.reply({
        content: 'Debes estar en un canal de voz para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!connection || connection.joinConfig.channelId !== memberChannel.id) {
      return interaction.reply({
        content: 'Debes estar en el mismo canal de voz que el bot para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      stopPlayback(interaction.guild.id);
      connection.destroy();

      return interaction.reply({
        content: 'He abandonado el canal de voz.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error al salir del canal:', error);
      return interaction.reply({
        content: 'No pude abandonar el canal de voz.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
