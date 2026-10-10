const { SlashCommandBuilder, ActivityType, MessageFlags } = require('discord.js');
const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} = require('@discordjs/voice');
const { Readable } = require('node:stream');
const youtubedl = require('youtube-dl-exec');

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
  state.player.stop();
  return true;
}

function stopPlayback(guildId) {
  const state = getGuildQueue(guildId);
  if (!state) return false;

  state.isPaused = false;
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

  const streamUrl = await youtubedl(videoUrl, {
    getUrl: true,
    format: 'bestaudio/best',
    noWarnings: true,
    noCheckCertificates: true,
    noPlaylist: true,
  });

  const response = await fetch(streamUrl);
  if (!response.ok) {
    throw new Error(`No pude obtener el stream de audio. Código HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'audio/webm';
  const inputType = contentType.includes('webm') ? 'webm/opus' : contentType.includes('mpeg') ? 'audio/mpeg' : 'webm/opus';
  const nodeStream = Readable.fromWeb(response.body);

  return createAudioResource(nodeStream, { inputType });
}

async function playNextTrack(guildId) {
  const state = getGuildQueue(guildId);

  if (!state || !state.player) return;

  if (state.isPaused) return;

  if (state.queue.length === 0) {
    state.current = null;
    state.isPaused = false;
    clearNowPlayingActivity(state.client);
    return;
  }

  const nextTrack = state.queue.shift();

  try {
    const resource = await getAudioResourceForVideo(nextTrack);
    state.current = {
      ...nextTrack,
      url: nextTrack.url || resolveTrackUrl(nextTrack, nextTrack.id),
    };
    state.isPaused = false;
    state.player.play(resource);
    setNowPlayingActivity(state.client, state.current.title);
  } catch (error) {
    console.error('Error reproduciendo la siguiente canción:', error);
    if (state.queue.length > 0) {
      playNextTrack(guildId);
    } else {
      state.current = null;
      clearNowPlayingActivity(state.client);
    }
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
  stopPlayback,
  clearUpcomingQueue,
  setNowPlayingActivity,

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: 'Debes estar en un canal de voz para usar este comando.',
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
        return interaction.editReply('No encontré resultados para esa búsqueda.');
      }

      const resolvedUrl = resolveTrackUrl(video, query);

      if (!resolvedUrl) {
        return interaction.editReply('No pude obtener una URL válida para esta canción.');
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
        });

        player.on(AudioPlayerStatus.Idle, () => {
          const currentState = getGuildQueue(interaction.guild.id);
          if (!currentState || currentState.isPaused) return;
          playNextTrack(interaction.guild.id);
        });

        connection.subscribe(player);

        state = {
          connection,
          player,
          queue: [],
          current: null,
          client: interaction.client,
          isPaused: false,
        };

        guildQueues.set(interaction.guild.id, state);
      }

      const isCurrentlyPlaying = state.current && [
        AudioPlayerStatus.Playing,
        AudioPlayerStatus.Buffering,
        AudioPlayerStatus.AutoPaused,
      ].includes(state.player.state.status);

      if (isCurrentlyPlaying || state.player.state.status === AudioPlayerStatus.Paused) {
        state.queue.push(track);
        const queueSize = state.queue.length;
        return interaction.editReply(`Se agregó a la cola: **${track.title}**. Posición: **${queueSize}**.`);
      }

      state.queue.push(track);

      const firstTrack = state.queue.shift();
      try {
        const resource = await getAudioResourceForVideo(firstTrack);
        state.current = { ...firstTrack, url: firstTrack.url || resolveTrackUrl(firstTrack, firstTrack.id) };
        state.isPaused = false;
        state.player.play(resource);
        setNowPlayingActivity(state.client, state.current.title);

        return interaction.editReply(`Reproduciendo: **${state.current.title}**`);
      } catch (error) {
        console.error('Error al reproducir la primera canción:', error);
        return interaction.editReply('No pude reproducir ese audio. Verifica la URL o intenta con otra búsqueda.');
      }
    } catch (error) {
      console.error(error);
      const isUnknownInteraction = error?.code === 10062 || error?.status === 404 || error?.message === 'Unknown interaction';
      if (isUnknownInteraction) return;

      try {
        if (!interaction.isRepliable()) return;
        await interaction.editReply('No pude reproducir ese audio. Verifica la URL o intenta con otra búsqueda.');
      } catch (replyError) {
        const isUnknownInteractionReply = replyError?.code === 10062 || replyError?.status === 404 || replyError?.message === 'Unknown interaction';
        if (!isUnknownInteractionReply) {
          console.error(replyError);
        }
      }
    }
  },
};
