require('dotenv').config();
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

const handleClientReady = () => {
  console.log(`Bot conectado como ${client.user.tag}`);
};

client.once('clientReady', handleClientReady);

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No se encontró el comando: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    const isUnknownInteraction = error?.code === 10062 || error?.status === 404 || error?.message === 'Unknown interaction';
    if (isUnknownInteraction) return;

    try {
      if (!interaction.isRepliable()) return;

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'Hubo un error al ejecutar este comando.',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: 'Hubo un error al ejecutar este comando.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      const isUnknownInteractionReply = replyError?.code === 10062 || replyError?.status === 404 || replyError?.message === 'Unknown interaction';
      if (!isUnknownInteractionReply) {
        console.error(replyError);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
