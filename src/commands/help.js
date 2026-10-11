const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra la lista de comandos disponibles.'),

  async execute(interaction) {
    const commands = [
      '🏓 `/ping` · ¿Sigo por aquí?',
      '🎶 `/play` · Pon una canción o busca por nombre.',
      '📋 `/queue` · Mira qué está sonando y qué sigue.',
      '⏸️ `/pause` · Tómate una pausa.',
      '▶️ `/resume` · Sigue escuchando.',
      '⏭️ `/skip` · Pasa a la próxima.',
      '⏹️ `/stop` · Para la música y vacía la cola.',
      '🧹 `/clearqueue` · Quita las canciones pendientes.',
      '🔁 `/loop` · Repite la canción actual.',
      '🔊 `/join` · Entra a tu canal de voz.',
      '👋 `/leave` · Sal del canal de voz.',
      '💡 `/help` · Vuelve a ver esta lista.',
    ];

    await interaction.reply({
      embeds: [createResponseEmbed('🎛️ Música a tu manera', commands.join('\n'), 'info')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
