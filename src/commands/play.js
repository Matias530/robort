const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');
const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} = require('@discordjs/voice');
const { spawn } = require('node:child_process');
const { PassThrough } = require('node:stream');
const youtubedl = require('youtube-dl-exec');
const { createResponseEmbed } = require('../utils/response-embed.js');

const guildQueues = new Map();

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return 'Desconocida';
  const totalSeconds = Number(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function extractYoutubeVideoId(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      return parsed.searchParams.get('v');
    }
  } catch {
    // Ignored.
  }

  const match = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/i) || trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i);
  return match ? match[1] : null;
}

function getGuildQueue(guildId) {
  const state = guildQueues.get(guildId);

  if (!state) return null;

  if (!Array.isArray(state.queue)) {
    state.queue = [];
  }

  if (typeof state.isPaused !== 'boolean') {
    state.isPaused = false;
  }

  if (typeof state.loop !== 'boolean') {
    state.loop = false;
  }

  return state;
}

function setNowPlayingActivity(client, title) {
  if (!client?.user) return;

  client.user.setActivity({
    name: `Reproduciendo ${title}`,
    type: ActivityType.Listening,
  });
}

function clearNowPlayingActivity(client) {
  if (!client?.user) return;
  client.user.setActivity(null);
}

function createControlRow(state, disabled = false) {
  const paused = state.player.state.status === AudioPlayerStatus.Paused;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:toggle')
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('music:skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('music:stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('music:loop')
      .setEmoji('🔁')
      .setStyle(state.loop ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function createNowPlayingEmbeds(track) {
  const duration = formatDuration(track.duration);
  const titleLimit = 255 - duration.length - 3;
  const title = track.title.length > titleLimit
    ? `${track.title.slice(0, titleLimit - 3)}...`
    : track.title;
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🎵 ${title}  ⏱️ ${duration}`)
    .setURL(track.url);

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return [embed];
}

async function updateNowPlayingControls(guildId) {
  const state = getGuildQueue(guildId);
  if (!state?.controlMessage || !state.current) return false;

  try {
    await state.controlMessage.edit({ components: [createControlRow(state)] });
    return true;
  } catch (error) {
    console.error('No pude actualizar los botones de reproducción:', error);
    return false;
  }
}

async function disableNowPlayingControls(state) {
  if (!state?.controlMessage) return;

  state.controlCollector?.stop();

  try {
    await state.controlMessage.edit({ components: [createControlRow(state, true)] });
  } catch (error) {
    console.error('No pude desactivar los botones de reproducción:', error);
  }

  state.controlMessage = null;
  state.controlCollector = null;
}

async function publishNowPlaying(state, track, initialInteraction) {
  const payload = {
    embeds: createNowPlayingEmbeds(track),
    components: [createControlRow(state)],
  };
  const message = initialInteraction
    ? await initialInteraction.editReply(payload)
    : await state.textChannel.send(payload);

  state.controlMessage = message;
  state.controlCollector = message.createMessageComponentCollector({
    filter: component => component.customId.startsWith('music:'),
  });

  state.controlCollector.on('collect', async component => {
    try {
      if (component.member?.voice?.channelId !== state.connection.joinConfig.channelId) {
        return await component.reply({
          embeds: [createResponseEmbed('🔊 Ven a escuchar conmigo', 'Estos controles funcionan cuando estás en el mismo canal de voz que yo.', 'warning')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await component.deferUpdate();

      if (component.customId === 'music:toggle') {
        if (state.player.state.status === AudioPlayerStatus.Paused) {
          resumePlayback(state.guildId);
        } else {
          pausePlayback(state.guildId);
        }
        await updateNowPlayingControls(state.guildId);
      } else if (component.customId === 'music:skip') {
        skipTrack(state.guildId);
      } else if (component.customId === 'music:stop') {
        stopPlayback(state.guildId);
      } else if (component.customId === 'music:loop') {
        toggleLoop(state.guildId);
        await updateNowPlayingControls(state.guildId);
      }
    } catch (error) {
      console.error('Error al ejecutar un botón de reproducción:', error);
    }
  });
}

function pausePlayback(guildId) {
  const state = getGuildQueue(guildId);
  if (!state || !state.player || !state.current) return false;

  if (state.player.state.status === AudioPlayerStatus.Playing) {
    state.isPaused = true;
    state.player.pause();
    return true;
  }

  if (state.player.state.status === AudioPlayerStatus.Paused) {
    state.isPaused = true;
    return true;
  }

  return false;
}

function resumePlayback(guildId) {
  const state = getGuildQueue(guildId);
  if (!state || !state.player || !state.current) return false;

  if (state.player.state.status === AudioPlayerStatus.Paused) {
    state.isPaused = false;
    state.player.unpause();
    return true;
  }

  if (state.player.state.status === AudioPlayerStatus.Playing) {
    state.isPaused = false;
    return true;
  }

  return false;
}

function skipTrack(guildId) {
  const state = getGuildQueue(guildId);
  if (!state || !state.player) return false;
  state.isPaused = false;
  state.loop = false;
  state.skipRequested = true;
  state.player.stop();
  return true;
}

function toggleLoop(guildId) {
  const state = getGuildQueue(guildId);
  if (!state?.current) return null;

  state.loop = !state.loop;
  return state.loop;
}

function stopPlayback(guildId) {
  const state = getGuildQueue(guildId);
  if (!state) return false;

  state.isPaused = false;
  disableNowPlayingControls(state);
  state.player.stop();
  if (state.connection) state.connection.destroy();
  clearNowPlayingActivity(state.client);
  guildQueues.delete(guildId);
  return true;
}

function clearUpcomingQueue(guildId) {
  const state = getGuildQueue(guildId);
  if (!state) return 0;

  const removed = state.queue.length;
  state.queue = [];
  return removed;
}

function resolveTrackUrl(video, fallbackQuery) {
  const candidates = [
    video?.webpage_url,
    video?.url,
    video?.video_url,
    video?.uri,
    video?.link,
    video?.id,
    typeof fallbackQuery === 'string' ? fallbackQuery : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;

    const cleaned = candidate.trim();
    if (!cleaned || cleaned === 'undefined' || cleaned === 'null') continue;

    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    if (/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(cleaned)) return cleaned;
    if (/^[A-Za-z0-9_-]{11}$/.test(cleaned)) return `https://www.youtube.com/watch?v=${cleaned}`;
  }

  return null;
}

async function resolveVideo(query) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) return null;

  const target = extractYoutubeVideoId(trimmedQuery) ? trimmedQuery : `ytsearch1:${trimmedQuery}`;
  const result = await youtubedl(target, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    skipDownload: true,
    noPlaylist: true,
  });

  return result?.entries?.[0] || result || null;
}

async function getAudioResourceForVideo(video) {
  const videoUrl = video?.webpage_url || video?.url || video?.original_url || (video?.id ? `https://www.youtube.com/watch?v=${video.id}` : null);

  if (!videoUrl) {
    throw new Error('No se pudo reconstruir la URL del video.');
  }

  const process = spawn(youtubedl.constants.YOUTUBE_DL_PATH, [
    '--quiet',
    '--no-warnings',
    '--no-progress',
    '--no-playlist',
    '--format',
    'bestaudio[ext=webm][acodec=opus]',
    '--retries',
    '5',
    '--fragment-retries',
    '5',
    '--output',
    '-',
    '--',
    videoUrl,
  ], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const audioStream = new PassThrough();
  let stderr = '';

  process.stderr.setEncoding('utf8');
  process.stderr.on('data', chunk => {
    stderr = `${stderr}${chunk}`.slice(-3000);
  });
  process.stdout.pipe(audioStream);
  process.once('error', error => audioStream.destroy(error));
  process.once('close', code => {
    if (code !== 0) {
      audioStream.destroy(new Error(`yt-dlp terminó con código ${code}: ${stderr.trim()}`));
    }
  });
  audioStream.once('close', () => {
    if (!audioStream.writableFinished && process.exitCode === null && process.signalCode === null) {
      process.kill();
    }
  });

  return createAudioResource(audioStream, { inputType: StreamType.WebmOpus });
}

async function playNextTrack(guildId, initialInteraction = null) {
  const state = getGuildQueue(guildId);

  if (!state || !state.player || state.loadingTrack) return;

  if (state.isPaused) return;

  state.loadingTrack = true;
  await disableNowPlayingControls(state);
  state.current = null;

  try {
    while (state.queue.length > 0) {
      const nextTrack = state.queue.shift();

      try {
        const resource = await getAudioResourceForVideo(nextTrack);
        if (guildQueues.get(guildId) !== state) return;

        state.current = {
          ...nextTrack,
          url: nextTrack.url || resolveTrackUrl(nextTrack, nextTrack.id),
        };
        state.isPaused = false;
        state.player.play(resource);
        setNowPlayingActivity(state.client, state.current.title);

        try {
          await publishNowPlaying(state, state.current, initialInteraction);
        } catch (error) {
          console.error('No pude enviar el panel de reproducción:', error);
          if (initialInteraction) {
            await initialInteraction.editReply({
              embeds: [createResponseEmbed('🎶 Ya está sonando', `**${state.current.title}**`, 'success')],
            });
          }
        }
        return;
      } catch (error) {
        console.error('Error reproduciendo la siguiente canción:', error);
        if (initialInteraction) {
          await initialInteraction.editReply({
            embeds: [createResponseEmbed('😕 Esa no salió', 'Voy a probar con la siguiente canción de la cola.', 'warning')],
          });
          initialInteraction = null;
        }
      }
    }

    state.isPaused = false;
    clearNowPlayingActivity(state.client);
  } catch (error) {
    console.error('Error avanzando la cola:', error);
  } finally {
    state.loadingTrack = false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce música de YouTube en tu canal de voz.')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('URL de YouTube o texto para buscar')
        .setRequired(true),
    ),

  getGuildQueue,
  pausePlayback,
  resumePlayback,
  skipTrack,
  toggleLoop,
  stopPlayback,
  clearUpcomingQueue,
  setNowPlayingActivity,
  updateNowPlayingControls,

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        embeds: [createResponseEmbed('🎙️ Entra a un canal de voz', 'Dime qué quieres escuchar cuando estés conectado y pongo la música.', 'warning')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const query = interaction.options.getString('query', true);

    try {
      if (!interaction.isRepliable()) return;
      await interaction.deferReply();
    } catch (error) {
      const isUnknownInteraction = error?.code === 10062 || error?.status === 404 || error?.message === 'Unknown interaction';
      if (isUnknownInteraction) return;
      throw error;
    }

    try {
      const video = await resolveVideo(query);

      if (!video) {
        return interaction.editReply({
          embeds: [createResponseEmbed('🔎 No encontré esa canción', 'Prueba con otro nombre o pega un enlace de YouTube.', 'warning')],
        });
      }

      const resolvedUrl = resolveTrackUrl(video, query);

      if (!resolvedUrl) {
        return interaction.editReply({
          embeds: [createResponseEmbed('🔗 No pude abrir ese enlace', 'Prueba con un enlace de YouTube o busca la canción por nombre.', 'warning')],
        });
      }

      const videoTitle = video.title || video.video_details?.title || 'Sin título';
      const videoDuration = Number(video.durationInSec ?? video.duration ?? video.video_details?.length_seconds ?? 0);
      const track = {
        id: video.id || video.video_id || extractYoutubeVideoId(resolvedUrl),
        title: videoTitle,
        url: resolvedUrl,
        duration: videoDuration,
        thumbnail: video.thumbnails?.[0]?.url || video.thumbnail?.url || video.video_details?.thumbnail?.[0]?.url || null,
      };

      let state = getGuildQueue(interaction.guild.id);

      if (!state) {
        let connection = getVoiceConnection(interaction.guild.id);

        if (connection && connection.joinConfig.channelId !== voiceChannel.id) {
          connection.destroy();
          connection = null;
        }

        if (!connection) {
          connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false,
          });
        }

        connection.on('error', error => {
          console.error('Error de conexión de voz:', error);
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

        const player = createAudioPlayer({
          behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause,
          },
        });

        player.on('error', error => {
          console.error('Error del reproductor:', error);
          const currentState = getGuildQueue(interaction.guild.id);
          if (!currentState?.current) return;

          const failedTrack = currentState.current;
          const retries = failedTrack.streamRetries || 0;
          if (retries < 1) {
            currentState.queue.unshift({ ...failedTrack, streamRetries: retries + 1 });
            console.warn(`Reintentando la pista después de un error de stream: ${failedTrack.title}`);
          } else {
            console.error(`Se omite la pista tras fallar el reintento: ${failedTrack.title}`);
          }

          currentState.current = null;
          currentState.isPaused = false;
          currentState.player.stop(true);
        });

        player.on(AudioPlayerStatus.Idle, () => {
          const currentState = getGuildQueue(interaction.guild.id);
          if (!currentState || currentState.isPaused) return;

          if (currentState.skipRequested) {
            currentState.skipRequested = false;
          } else if (currentState.loop && currentState.current) {
            currentState.queue.unshift({ ...currentState.current, streamRetries: 0 });
          }

          playNextTrack(interaction.guild.id);
        });

        player.on('stateChange', () => {
          updateNowPlayingControls(interaction.guild.id);
        });

        connection.subscribe(player);

        state = {
          connection,
          player,
          queue: [],
          current: null,
          loop: false,
          skipRequested: false,
          client: interaction.client,
          isPaused: false,
          guildId: interaction.guild.id,
          textChannel: interaction.channel,
          controlMessage: null,
          controlCollector: null,
          loadingTrack: false,
        };

        guildQueues.set(interaction.guild.id, state);
      }

      const isCurrentlyPlaying = state.current && [
        AudioPlayerStatus.Playing,
        AudioPlayerStatus.Buffering,
        AudioPlayerStatus.AutoPaused,
      ].includes(state.player.state.status);

      if (isCurrentlyPlaying || state.player.state.status === AudioPlayerStatus.Paused || state.loadingTrack) {
        state.queue.push(track);
        const queueSize = state.queue.length;
        return interaction.editReply({
          embeds: [createResponseEmbed('➕ Va después', `**${track.title}** quedó en el puesto **${queueSize}**.`, 'success')],
        });
      }

      state.queue.push(track);
      await playNextTrack(interaction.guild.id, interaction);
    } catch (error) {
      console.error(error);
      const isUnknownInteraction = error?.code === 10062 || error?.status === 404 || error?.message === 'Unknown interaction';
      if (isUnknownInteraction) return;

      try {
        if (!interaction.isRepliable()) return;
        await interaction.editReply({
          embeds: [createResponseEmbed('😕 No pude poner esa canción', 'Prueba con otra búsqueda o con otro enlace.', 'error')],
        });
      } catch (replyError) {
        const isUnknownInteractionReply = replyError?.code === 10062 || replyError?.status === 404 || replyError?.message === 'Unknown interaction';
        if (!isUnknownInteractionReply) {
          console.error(replyError);
        }
      }
    }
  },
};
