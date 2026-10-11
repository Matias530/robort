const { SlashCommandBuilder } = require('discord.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Devuelve el tiempo de respuesta del bot.'),

  async execute(interaction) {
    await interaction.deferReply();
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [createResponseEmbed('🏓 ¡Aquí estoy!', `Todo bien por aquí. Tardé **${latency} ms** en responder.`, 'success')],
    });
  },
};
