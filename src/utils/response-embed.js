const { EmbedBuilder } = require('discord.js');

const colors = {
  success: '#57F287',
  info: '#5865F2',
  warning: '#FEE75C',
  error: '#ED4245',
};

function createResponseEmbed(title, description, tone = 'info') {
  return new EmbedBuilder()
    .setColor(colors[tone] || colors.info)
    .setTitle(title)
    .setDescription(description);
}

module.exports = { createResponseEmbed };