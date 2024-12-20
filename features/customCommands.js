// features/customCommands.js

const { readFileAsync, writeFileAsync } = require('../utils/fileUtils');
const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = './roles.json';
const path_2 = './event.json';

// 檢查 roles.json 是否存在，若不存在則創建
if (!fs.existsSync(path)) {
  fs.writeFileSync(path, JSON.stringify([])); // 如果檔案不存在，創建空的 JSON 檔案
}
if (!fs.existsSync(path_2)) {
  fs.writeFileSync(path_2, JSON.stringify([])); // 如果檔案不存在，創建空的 JSON 檔案
}

function isValidHexColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

const getSavedRoles = () => {
  try {
    const rolesData = fs.readFileSync(path);
    return JSON.parse(rolesData); // 解析 JSON
  } catch (error) {
    console.error('讀取 roles.json 失敗', error);
    return []; // 讀取失敗則返回空陣列
  }
};

// 讀取事件資料
const getSavedEvent = async () => {
  try {
    const eventData = await fs.promises.readFile(path_2, 'utf-8'); // 異步讀取
    return JSON.parse(eventData);
  } catch (error) {
    console.error('讀取 event.json 失敗:', error);
    return [];
  }
};

// 儲存事件至 event.json
const saveEvent = async (event) => {
  try {
    await fs.promises.writeFile(path_2, JSON.stringify(event, null, 2)); // 異步寫入
    console.log('成功儲存 event.json');
  } catch (error) {
    console.error('儲存 event.json 失敗:', error);
  }
};



// 儲存角色資料至 roles.json
const saveRoles = (roles) => {
  try {
    fs.writeFileSync(path, JSON.stringify(roles, null, 2)); // 使用縮排格式保存，便於檢視
  } catch (error) {
    console.error('儲存 roles.json 失敗', error);
  }
};

const cache = {}; // 快取所有伺服器的指令

async function addCommand(guildId, commandName, replyMessage) {
  const commands = await getCommands(guildId);

  const lowercaseCommandName = commandName.toLowerCase();
  if (['add', 'edit', 'remove'].includes(lowercaseCommandName)) {
    return '禁止使用保留關鍵字作為指令名稱。';
  }

  if (!commandName || !replyMessage) {
    return '請使用正確的格式：!add [指令名稱] [回覆內容]';
  }

  commands[lowercaseCommandName] = replyMessage;
  await saveCommands(guildId, commands);

  return `已新增指令「${lowercaseCommandName}」，回覆訊息為：${replyMessage}`;
}

async function editCommand(guildId, commandName, replyMessage) {
  const commands = await getCommands(guildId);

  const lowercaseCommandName = commandName.toLowerCase();
  if (!commands[lowercaseCommandName]) {
    return `找不到指令「${commandName}」，請先使用 !add 新增指令。`;
  }

  if (!replyMessage) {
    return '請設定回覆訊息：!edit [指令名稱] [回覆內容]';
  }

  commands[lowercaseCommandName] = replyMessage;
  await saveCommands(guildId, commands);

  return `已編輯指令「${lowercaseCommandName}」的回覆訊息為：${replyMessage}`;
}

async function removeCommand(guildId, commandName) {
  const commands = await getCommands(guildId);

  const lowercaseCommandName = commandName.toLowerCase();
  if (!commands[lowercaseCommandName]) {
    return `找不到指令「${commandName}」，請先使用 !add 新增指令。`;
  }

  delete commands[lowercaseCommandName];
  await saveCommands(guildId, commands);

  return `已刪除指令「${lowercaseCommandName}」`;
}

async function getCommands(guildId) {
  if (!cache[guildId]) {
    try {
      const filePath = `server/${guildId}.json`;
      const data = await readFileAsync(filePath);
      cache[guildId] = data || {};
    }
    catch (err) {
      console.error(err);
      cache[guildId] = {};
    }
  }

  return cache[guildId];
}

async function saveCommands(guildId, commands) {
  try {
    const filePath = `server/${guildId}.json`;
    await writeFileAsync(filePath, commands);
    cache[guildId] = commands;
  }
  catch (err) {
    console.error(err);
  }
}

async function eventaddCommand(message, args, guildId) {
  console.log('開始處理 !eventadd 指令');
  try {
    if (args.length < 2) {
      return message.reply('格式錯誤！請使用 `!eventadd <截止日期(年-月-日)> <事件內容>`');
    }

    const deadline = args.shift(); // 取出截止日期
    const eventDetails = args.join(' '); // 剩餘參數為事件內容

    const deadlinePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!deadlinePattern.test(deadline)) {
      return message.reply('截止日期格式錯誤！請使用 `YYYY-MM-DD` 格式');
    }

    const savedEvents = await getSavedEvent(); // 確保正確使用異步操作
    
    // 根據當前頻道 ID 找到對應的身份組記錄
    const currentChannelId = message.channel.id;
    const eventEntry = savedEvents.find(event =>
      Object.values(event).includes(currentChannelId)
    );

    if (!eventEntry) {
      return message.reply('此頻道未綁定任何身份組事件記錄，請聯繫管理員設定。');
    }

    // 新增事件到對應的身份組
    const event = { deadline, details: eventDetails };
    if (!eventEntry.event) {
      eventEntry.event = [];
    }
    eventEntry.event.push(event);

    await saveEvent(savedEvents); // 確保更新資料完成

    // 回應使用者新增事件成功
    return message.reply(`已新增事件\n📅 **截止日期：${deadline}**\n📝 **內容：${eventDetails}**`);
  } catch (error) {
    console.error('處理 !eventadd 時發生錯誤：', error);
    return message.reply('處理事件時發生錯誤，請稍後再試。');
  }
}

async function join(message, args) {
  if (args.length < 1) {
    return message.reply('請提供密碼！用法：`!joinrole 密碼`');
  }

  const password = args[0];
  
  // 讀取已存檔的身分組資料
  const savedRoles = await getSavedRoles();
  
  console.log('已存檔的身分組資料:', savedRoles); // Debug: 查看 savedRoles 資料

  // 根據密碼查找對應的角色
  const roleData = savedRoles.find(role => role.password === password);
  
  if (!roleData) {
    return message.reply('找不到對應的身分組或密碼錯誤！');
  }

  try {
    // 根據 roleId 來獲取角色
    const role = await message.guild.roles.fetch(roleData.roleId);

    // 將用戶加入該角色
    await message.member.roles.add(role);
    message.channel.send(`您已成功加入身分組 ！`);

  } catch (error) {
    console.error(error);
    message.reply('無法加入身分組，請聯繫管理員！');
  }

  // 刪除指令訊息
  try {
    await message.delete();
  } catch (error) {
    console.error(`無法刪除訊息：${error}`);
  }
}




// 確保檔案存在
if (!fs.existsSync(path)) {
  fs.writeFileSync(path, JSON.stringify([]));
}

// 創建新角色指令處理
async function create_role(message, args) {
  if (args.length < 4) {
    return message.reply('格式錯誤! 用法：`!createrole 身分組全名 簡稱 顏色 密碼`');
  }

  const [roleName, shortName, color, password] = args;

  // 讀取已存檔的身分組資料
  const savedRoles = getSavedRoles();

  // 檢查是否已存在相同名稱的身分組
  if (savedRoles.some(role => role.name === roleName)) {
    await message.delete();  // 刪除指令訊息
    return message.reply(`身分組 "${roleName}" 已存在！`);
  }

  // 檢查密碼是否已被使用
  if (savedRoles.some(role => role.password === password)) {
    await message.delete();  // 刪除指令訊息
    return message.reply('密碼已經被使用過，請選擇一個不同的密碼！');
  }

  // 檢查顏色是否有效
  if (!isValidHexColor(color)) {
    await message.delete();  // 刪除指令訊息
    return message.reply('顏色格式錯誤！請使用 HEX 色碼格式（例如：`#123456`）');
  }

  try {
    // 創建角色
    const role = await message.guild.roles.create({
      name: roleName.trim(),
      color: color,
      mentionable: true,
      reason: `由 ${message.author.tag} 使用指令創建`,
    });

    // 頻道名稱列表使用簡稱
    const channelNames = [
      `${shortName.trim()}-公告`, 
      `${shortName.trim()}-聊天`, 
      `${shortName.trim()}-指令區`
    ];

    // 替換非法字符
    const replaceIllegalCharacters = (channelName) => {
      return channelName.replace(/[^\w\s\u4e00-\u9fa5-]/g, '-');
    };

    // 清理頻道名稱
    const cleanedChannelNames = channelNames.map(replaceIllegalCharacters);

    // 創建頻道
    const categoryId = '1306578181314314261'; // 類別ID

    let announcementChannelId = null; // 預設為 null，後面會賦值

    for (const channelName of cleanedChannelNames) {
      const trimmedChannelName = channelName.trim();

      if (!trimmedChannelName || trimmedChannelName === '') {
        console.error(`無效的頻道名稱：${channelName}`);
        continue;
      }

      try {
        const channel = await message.guild.channels.create({
          name: trimmedChannelName, 
          type: 0,  // 設定為文本頻道
          topic: `此頻道為 ${roleName.trim()} 的 ${trimmedChannelName.split('-')[1]} 專屬頻道`,
          parent: categoryId,
          permissionOverwrites: [
            {
              id: message.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: role.id,
              allow: [PermissionsBitField.Flags.ViewChannel],
            },
          ],
        });

        // 如果是公告頻道，保存其 ID
        if (trimmedChannelName.includes('公告')) {
          announcementChannelId = channel.id;
        }
        if (trimmedChannelName.includes('指令區')) {
          commandChannelId = channel.id;
        }
      } catch (error) {
        console.error(`創建頻道 ${trimmedChannelName} 時出現錯誤：`, error);
        continue;
      }
    }

    // 刪除使用者輸入的指令
    try {
      await message.delete();
    } catch (error) {
      console.error(`無法刪除訊息：${error}`);
      message.reply('無法刪除訊息，請確認機器人是否擁有管理訊息的權限。');
    }

    // 將使用者加入新角色
    await message.member.roles.add(role);
    message.channel.send(`已將您新增至身分組 **${roleName}**！`);

    // 私訊密碼
    try {
      await message.author.send(`您創建的身分組 **${roleName}** 密碼是：**${password}**`);
    } catch (error) {
      console.error(`無法私訊使用者：${message.author.tag}`);
      message.reply('無法私訊您，請確認您的私訊設定是否允許機器人發送訊息。');
    }

    // 儲存角色和密碼
    savedRoles.push({ 
      name: roleName, 
      password: password,
      roleId: role.id // 儲存角色 ID
    });
    saveRoles(savedRoles);  // 儲存至 roles.json
    console.log('角色資料已成功儲存到 roles.json');

    // 確保 announcementChannelId 存在才進行儲存
    if (announcementChannelId) {
      const savedEvents = await getSavedEvent(); // 讀取 event.json 資料
      savedEvents.push({ [`${shortName.trim()}-announcement`]: announcementChannelId, [`${shortName.trim()}-command`]: commandChannelId , event:[]});
      await saveEvent(savedEvents);  // 儲存至 event.json
      console.log('事件資料已成功儲存到 event.json');
    }

  } catch (error) {
    console.error(error);
    message.reply('創建身分組或頻道時出現問題，請聯繫管理員！');
  }
}





async function handleCommand(message) {
  const args = message.content.slice(1).trim().split(/ +/);  // 在這裡定義 args
  const command = args.shift().toLowerCase();
  const guildId = message.guild.id;

  // 讀取該伺服器的事件資料
  const savedEvents = getSavedEvent();

  // 檢查是否是 !eventadd 指令
  if (command === 'eventadd') {
    return await eventaddCommand(message, args, guildId);  // 將 eventadd 的邏輯移到 handleEventAdd 函式
  }
  if (command === 'join') {
    return await join(message, args);  // 處理 !joinrole 指令
  }

  if (['add', 'edit', 'remove', 'create'].includes(command)) {
    if (command === 'add') {
      const commandName = args.shift();
      const replyMessage = args.join(' ');
      return await addCommand(guildId, commandName, replyMessage);
    }
    else if (command === 'edit') {
      const commandName = args.shift();
      const replyMessage = args.join(' ');
      return await editCommand(guildId, commandName, replyMessage);
    }
    else if (command === 'remove') {
      const commandName = args.shift();
      return await removeCommand(guildId, commandName);
    }
    else if (command === 'create') {
      return await create_role(message, args);  // 傳遞 message 和 args 給 create_role 函數
    }
  }
  else {
    return await processCustomCommand(guildId, command);
  }
}

module.exports = {
  addCommand,
  editCommand,
  removeCommand,
  handleCommand,
};
