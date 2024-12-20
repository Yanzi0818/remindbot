const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token, originalVoiceChannelId } = require('./config.json');
const { handleCommand } = require('./features/customCommands');
const { scheduleEventNotifications, checkAndNotifyEvents } = require('./features/eventNotifier');

// 建立新的 Discord 客戶端
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates, // 需要的語音狀態意圖
  ],
});

// 儲存動態創建的語音頻道 ID
const dynamicVoiceChannels = new Set();

// 當客戶端準備就緒時執行此程式碼
client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`)
  // 啟動時立即檢查事件
  checkAndNotifyEvents(client);

  // 排程每日事件檢查
  scheduleEventNotifications(client);;
});



client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith('!')) {
    try {
      const replyMessage = await handleCommand(message);
      if (replyMessage) {
        message.reply(`${replyMessage}`);
      }
    }
    catch (err) {
      console.error(err);
      message.reply('發生錯誤,指令處理失敗。');
    }
  }
});

// 語音狀態更新事件處理
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // 檢查是否進入指定的語音頻道
  if (newState.channelId === originalVoiceChannelId && oldState.channelId !== originalVoiceChannelId) {
    const member = newState.member;
    const guild = newState.guild;
    const category = newState.channel.parent;

    // 獲取原始語音頻道所屬分類的權限設定
    const categoryPermissions = category.permissionOverwrites.cache;

    // 設定新的語音頻道權限
    const newChannelPermissions = categoryPermissions.map((permission) => ({
      id: permission.id,
      allow: permission.allow,
      deny: permission.deny,
    }));

    // 創建新的語音頻道
    const newChannel = await guild.channels.create({
      name: `${member.user.username}'s Channel`,
      type: 2, // 2 代表語音頻道
      parent: category,
      permissionOverwrites: newChannelPermissions,
    });

    // 移動用戶到新的語音頻道
    await member.voice.setChannel(newChannel);

    // 儲存新頻道的 ID
    dynamicVoiceChannels.add(newChannel.id);
  }

  // 檢查用戶是否從動態創建的語音頻道切換
  if (dynamicVoiceChannels.has(oldState.channelId) && newState.channelId !== oldState.channelId) {
    const channel = oldState.channel;
    if (channel.members.size === 0) {
      // 若該頻道已無人，刪除該頻道
      try {
        await channel.delete();
        dynamicVoiceChannels.delete(channel.id);
      }
      catch (error) {
        console.error('刪除頻道時發生錯誤:', error);
      }
    }
  }
});

// 登入到 Discord
client.login(token);


