const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { createResponseEmbed } = require('../utils/response-embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('luck')
    .setDescription('Desea buena suerte a alguien.')
    .addStringOption(option =>
      option
        .setName('miembro')
        .setDescription('Busca a quién quieres desearle suerte')
        .setAutocomplete(true)
        .setRequired(false),
    ),

  async execute(interaction) {
    const memberId = interaction.options.getString('miembro');
    let recipient = interaction.user;

    if (memberId) {
      if (!interaction.inGuild()) {
        return interaction.reply({
          content: 'La búsqueda de miembros está disponible dentro de un servidor.',
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        const member = await interaction.guild.members.fetch(memberId);
        recipient = member.user;
      } catch {
        return interaction.reply({
          content: 'No pude encontrar a esa persona en este servidor. Búscala y elige una sugerencia.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    await interaction.reply({
      content: `<@${recipient.id}>`,
      embeds: [createResponseEmbed('🍀 ¡Mucha suerte!', '¡Tú puedes! Que todo te salga genial ✨', 'success')],
      allowedMentions: { users: [recipient.id] },
    });
  },

  async autocomplete(interaction) {
    const query = interaction.options.getFocused().trim();

    if (!query || !interaction.inGuild()) {
      return interaction.respond([]);
    }

    const members = await interaction.guild.members.search({ query, limit: 25, cache: false });
    const choices = members.map(member => ({
      name: `${member.displayName} (@${member.user.username})`.slice(0, 100),
      value: member.id,
    }));

    await interaction.respond(choices);
  },
};