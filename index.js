const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
require('dotenv').config();

// ============================================================
//  🎭 COLUMBINA — Discord Music Bot
// ============================================================

const BOT_NAME = 'Columbina';
const PREFIX   = '!';
const OWNER_ID = process.env.OWNER_ID;

// Per-guild no-prefix whitelist
const noPrefixUsers = new Map(); // guildId -> Set<userId>

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const queues = new Map(); // guildId -> queue object

// ── Ready ────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ ${BOT_NAME} is online as ${client.user.tag}`);
  client.user.setActivity(`🎵 ${PREFIX}help for commands`);
});

// ── Message handler ──────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const guildId  = message.guild?.id;
  const authorId = message.author.id;
  const isOwner  = authorId === OWNER_ID;

  // Determine if this is a command
  let content;
  if (message.content.startsWith(PREFIX)) {
    content = message.content.slice(PREFIX.length).trim();
  } else if (isOwner || (guildId && noPrefixUsers.get(guildId)?.has(authorId))) {
    content = message.content.trim();
  } else {
    return;
  }

  if (!content) return;
  const args    = content.split(/ +/);
  const command = args.shift().toLowerCase();

  // ── OWNER: grant no-prefix ───────────────────────────────
  if (command === 'grant') {
    if (!isOwner) return message.reply(`🔒 Only **${BOT_NAME}'s owner** can use this command.`);
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Mention a user to grant.\nUsage: `!grant @user`');
    if (!noPrefixUsers.has(guildId)) noPrefixUsers.set(guildId, new Set());
    noPrefixUsers.get(guildId).add(target.id);
    return message.reply(`✅ **${target.username}** can now use ${BOT_NAME} without the \`${PREFIX}\` prefix!`);
  }

  // ── OWNER: revoke no-prefix ──────────────────────────────
  if (command === 'revoke') {
    if (!isOwner) return message.reply(`🔒 Only **${BOT_NAME}'s owner** can use this command.`);
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Mention a user to revoke.\nUsage: `!revoke @user`');
    noPrefixUsers.get(guildId)?.delete(target.id);
    return message.reply(`✅ Removed no-prefix access from **${target.username}**.`);
  }

  // ── OWNER: list no-prefix users ─────────────────────────
  if (command === 'noprefix') {
    if (!isOwner) return message.reply(`🔒 Only **${BOT_NAME}'s owner** can use this command.`);
    const set = noPrefixUsers.get(guildId);
    if (!set || set.size === 0) return message.reply('📭 No users have no-prefix access in this server.');
    const list = [...set].map((id) => `<@${id}>`).join(', ');
    return message.reply(`🎟️ **No-prefix users:** ${list}`);
  }

  // ── PLAY ─────────────────────────────────────────────────
  if (command === 'play' || command === 'p') {
    if (!args.length) return message.reply('❌ Please provide a song name or YouTube URL.');

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('❌ You need to be in a voice channel!');

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak'))
      return message.reply('❌ I need **Connect** and **Speak** permissions!');

    const query = args.join(' ');
    message.channel.send(`🔍 Searching for **${query}**...`);

    try {
      let url, title, duration = '', thumbnail = '';

      if (!query.startsWith('http')) {
        // Search YouTube
        const results = await playdl.search(query, { limit: 1 });
        if (!results.length) return message.reply('❌ No results found!');
        const video = results[0];
        url       = video.url;
        title     = video.title;
        duration  = formatDuration(video.durationInSec);
        thumbnail = video.thumbnails?.[0]?.url ?? '';
      } else {
        // Direct URL
        const info = await playdl.video_info(query);
        url       = query;
        title     = info.video_details.title;
        duration  = formatDuration(info.video_details.durationInSec);
        thumbnail = info.video_details.thumbnails?.[0]?.url ?? '';
      }

      const song = { url, title, duration, thumbnail, requestedBy: message.author.username };

      let queue = queues.get(guildId);
      if (!queue) {
        queue = {
          songs: [],
          player: createAudioPlayer(),
          connection: null,
          textChannel: message.channel,
        };
        queues.set(guildId, queue);

        queue.player.on(AudioPlayerStatus.Idle, () => {
          queue.songs.shift();
          if (queue.songs.length > 0) {
            playSong(guildId, queue.songs[0]);
          } else {
            queue.textChannel.send(`✅ Queue finished! ${BOT_NAME} is leaving the voice channel.`);
            setTimeout(() => { queue.connection?.destroy(); queues.delete(guildId); }, 3000);
          }
        });

        queue.player.on('error', (err) => {
          console.error('Player error:', err);
          queue.textChannel.send(`❌ Audio error: ${err.message}`);
        });
      }

      queue.songs.push(song);
      queue.textChannel = message.channel;

      if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
        queue.connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId,
          adapterCreator: message.guild.voiceAdapterCreator,
        });
        queue.connection.subscribe(queue.player);
      }

      if (queue.songs.length === 1) {
        message.channel.send(`▶️ Now playing: **${title}** \`[${duration}]\` — requested by ${message.author.username}`);
        playSong(guildId, song);
      } else {
        message.channel.send(`➕ Added to queue: **${title}** \`[${duration}]\` (position #${queue.songs.length})`);
      }

    } catch (err) {
      console.error(err);
      message.reply(`❌ Error: ${err.message}`);
    }
  }

  // ── SKIP ─────────────────────────────────────────────────
  else if (command === 'skip' || command === 's') {
    const queue = queues.get(guildId);
    if (!queue?.songs.length) return message.reply('❌ Nothing is playing!');
    queue.player.stop();
    message.channel.send('⏭️ Skipped!');
  }

  // ── STOP ─────────────────────────────────────────────────
  else if (command === 'stop') {
    const queue = queues.get(guildId);
    if (!queue) return message.reply('❌ Nothing is playing!');
    queue.songs = [];
    queue.player.stop();
    queue.connection?.destroy();
    queues.delete(guildId);
    message.channel.send('⏹️ Stopped and cleared the queue.');
  }

  // ── PAUSE ────────────────────────────────────────────────
  else if (command === 'pause') {
    const queue = queues.get(guildId);
    if (!queue) return message.reply('❌ Nothing is playing!');
    queue.player.pause();
    message.channel.send('⏸️ Paused.');
  }

  // ── RESUME ───────────────────────────────────────────────
  else if (command === 'resume' || command === 'r') {
    const queue = queues.get(guildId);
    if (!queue) return message.reply('❌ Nothing is paused!');
    queue.player.unpause();
    message.channel.send('▶️ Resumed.');
  }

  // ── QUEUE ────────────────────────────────────────────────
  else if (command === 'queue' || command === 'q') {
    const queue = queues.get(guildId);
    if (!queue?.songs.length) return message.reply('📭 The queue is empty.');
    const list = queue.songs
      .map((s, i) => `${i === 0 ? '▶️' : `${i}.`} **${s.title}** \`[${s.duration}]\` — ${s.requestedBy}`)
      .join('\n');
    message.channel.send(`🎵 **Queue (${queue.songs.length} songs):**\n${list}`);
  }

  // ── NOW PLAYING ──────────────────────────────────────────
  else if (command === 'np' || command === 'nowplaying') {
    const queue = queues.get(guildId);
    if (!queue?.songs.length) return message.reply('❌ Nothing is playing!');
    const s = queue.songs[0];
    message.channel.send(`🎵 Now playing: **${s.title}** \`[${s.duration}]\` — requested by ${s.requestedBy}`);
  }

  // ── LEAVE ────────────────────────────────────────────────
  else if (command === 'leave' || command === 'disconnect') {
    const queue = queues.get(guildId);
    if (queue) {
      queue.songs = [];
      queue.player.stop();
      queue.connection?.destroy();
      queues.delete(guildId);
    }
    message.channel.send(`👋 ${BOT_NAME} has left the voice channel.`);
  }

  // ── HELP ─────────────────────────────────────────────────
  else if (command === 'help') {
    message.channel.send(`
🎭 **${BOT_NAME} — Commands**

**Music**
\`${PREFIX}play <song/url>\` — Play a song or add to queue
\`${PREFIX}skip\` — Skip current song
\`${PREFIX}stop\` — Stop and clear queue
\`${PREFIX}pause\` / \`${PREFIX}resume\` — Pause or resume
\`${PREFIX}queue\` — Show the queue
\`${PREFIX}np\` — Show now playing
\`${PREFIX}leave\` — Disconnect bot

**Owner Only** 🔒
\`${PREFIX}grant @user\` — Give a user no-prefix access
\`${PREFIX}revoke @user\` — Remove no-prefix access
\`${PREFIX}noprefix\` — List no-prefix users

**Aliases:** \`p\` = play, \`s\` = skip, \`q\` = queue, \`r\` = resume
    `.trim());
  }
});

// ── Helpers ──────────────────────────────────────────────────
async function playSong(guildId, song) {
  const queue = queues.get(guildId);
  if (!queue) return;
  try {
    const source = await playdl.stream(song.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(source.stream, { inputType: source.type });
    queue.player.play(resource);
  } catch (err) {
    console.error('Stream error:', err);
    queue.textChannel.send(`❌ Could not play **${song.title}**: ${err.message}`);
    // Skip to next song
    queue.songs.shift();
    if (queue.songs.length > 0) playSong(guildId, queue.songs[0]);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

client.login(process.env.DISCORD_TOKEN);
