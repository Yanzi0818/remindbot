const fs = require('fs').promises; // 使用異步操作
const cron = require('node-cron');

// 儲存事件的檔案路徑
const eventFilePath = './event.json';

async function getSavedEvent() {
  try {
    const eventData = await fs.readFile(eventFilePath, 'utf-8');
    return JSON.parse(eventData);
  } catch (error) {
    console.error('讀取 event.json 失敗:', error);
    return [];
  }
}

async function checkAndNotifyEvents(client) {
  const now = new Date();
  
  // 計算不同天數之前的日期
  const reminderTimes = [
    { daysAgo: 14, tag: '14天前', roleId: '1306576896112463924' },
    { daysAgo: 7, tag: '7天前', roleId: '1306576355428929598' },
    { daysAgo: 5, tag: '5天前', roleId: '1306576682504814683' },
    { daysAgo: 3, tag: '3天前', roleId: '1306576759889723422' },
    { daysAgo: 1, tag: '1天前', roleId: '1306576820979892224' },
  ];

  const savedEvents = await getSavedEvent();

  for (const eventEntry of savedEvents) {
    for (const [key, value] of Object.entries(eventEntry)) {
      if (key.endsWith('-announcement')) {
        const announcementChannelId = value;
        const events = eventEntry.event || [];

        // 日誌輸出: 確認頻道 ID
        console.log(`檢查頻道 ID: ${announcementChannelId}`);

        // 測試頻道是否正確
        try {
          const announcementChannel = await client.channels.fetch(announcementChannelId);

          if (!announcementChannel) {
            console.error(`無法找到頻道 ${announcementChannelId}`);
            continue;
          }

          // 日誌輸出: 頻道名稱和類型
          console.log(
            `找到頻道: 名稱=${announcementChannel.name}, 類型=${announcementChannel.type}, ID=${announcementChannelId}`
          );

          // 檢查權限
          if (!announcementChannel.permissionsFor(client.user).has('VIEW_CHANNEL')) {
            console.error(`機器人無法查看頻道 ${announcementChannelId}`);
            continue;
          }

          if (!announcementChannel.permissionsFor(client.user).has('SEND_MESSAGES')) {
            console.error(`機器人無法在頻道 ${announcementChannelId} 發送訊息`);
            continue;
          }

          // 過濾即將到期的事件
          const upcomingEvents = events.filter(event => {
            const eventDate = new Date(event.deadline);
            return eventDate >= now;
          });

          // 處理 7天前、5天前、3天前、1天前的提醒
          for (const reminder of reminderTimes) {
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + reminder.daysAgo);
            
            // 過濾出指定天數前的事件
            const specificEvents = upcomingEvents.filter(event => {
              const eventDate = new Date(event.deadline);
              return eventDate.getDate() === targetDate.getDate() &&
                     eventDate.getMonth() === targetDate.getMonth() &&
                     eventDate.getFullYear() === targetDate.getFullYear();
            });

            if (specificEvents.length > 0) {
              const reminders = specificEvents
                .map(e => `📅 **事件:** ${e.details}\n⏳ **截止:** ${e.deadline}`)
                .join('\n\n');

              await announcementChannel.send(`<@&${reminder.roleId}> 🔔 提醒: 以下事件即將到期！（${reminder.tag}）\n\n${reminders}`);
              console.log(`成功發送 ${reminder.tag} 的通知到頻道 ${announcementChannelId}`);
            }
          }
        } catch (err) {
          console.error(`無法處理頻道 ${announcementChannelId} 的操作:`, err);
        }
      }
    }
  }
}
// 設定每日定時檢查
function scheduleEventNotifications(client) {
  // 每日 0:00 執行檢查
  cron.schedule('0 0 * * *', () => {
    console.log('開始每日事件檢查');
    checkAndNotifyEvents(client);
  });

  console.log('已排程每日事件通知檢查');
}

module.exports = {
  scheduleEventNotifications,
  checkAndNotifyEvents,
};
