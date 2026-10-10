const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra la lista de comandos disponibles.'),

  async execute(interaction) {
    const commands = [
      '/ping - Devuelve el tiempo de respuesta del bot.',
      '/help - Muestra esta ayuda.',
      '/play <url o texto> - Reproduce música de YouTube en tu canal de voz.',
      '/queue - Muestra la lista actual de reproducción.',
      '/skip - Salta la canción actual.',
      '/pause - Pausa la reproducción.',
      '/resume - Reanuda la reproducción.',
      '/stop - Detiene y limpia la cola.',
      '/clearqueue - Limpia la lista próxima sin cortar la canción actual.',
    ];

    await interaction.reply({
      content: `Comandos disponibles:\n${commands.join('\n')}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
