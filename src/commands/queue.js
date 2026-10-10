const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildQueue } = require('./play.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la lista de reproducción actual.'),

  async execute(interaction) {
    const queue = getGuildQueue(interaction.guild.id);
    const hasQueueEntries = Boolean(queue && (queue.current || queue.queue.length > 0));

    if (!hasQueueEntries) {
      return interaction.reply({
        content: 'No hay ninguna canción en la cola en este servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const items = [];

    if (queue.current) {
      items.push(
        `🎵 Reproduciendo ahora: **${queue.current.title}** • ${formatDuration(queue.current.duration)}`,
      );
    }

    if (queue.queue.length > 0) {
      queue.queue.forEach((track, index) => {
        const duration = track.duration ? ` • ${formatDuration(track.duration)}` : '';
        items.push(`${index + 1}. **${track.title}**${duration}`);
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📋 Cola de reproducción')
      .setDescription(items.join('\n\n'))
      .setTimestamp();

    const thumbnail = queue.current?.thumbnail || queue.queue[0]?.thumbnail;
    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return 'Desconocida';
  const totalSeconds = Number(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
