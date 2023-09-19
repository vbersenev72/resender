import { Telegraf } from "telegraf";
import axios from "axios";
import dotenv from 'dotenv';
import pool from "./config/db.js";
import admins from "./config/config.js";

dotenv.config()

const token = process.env.TOKEN
const bot = new Telegraf(token)
let users = {}

bot.use(async (ctx, next) => {
  if (RegExp(/^\/get==/).test(ctx.message.text)) {
    const user = ctx.message.text.split('==')[1]
    const res = await pool.query('INSERT INTO access(telegram_nickname) values($1) RETURNING *', [user])
    console.log(res.rows);
    return ctx.reply(`Пользователю @${user} разрешен доступ`)
  }
  if (RegExp(/^\/delete==/).test(ctx.message.text)) {
    const user = ctx.message.text.split('==')[1]
    const res = await pool.query('DELETE FROM access WHERE telegram_nickname = $1 RETURNING *', [user])
    console.log(res.rows);
    return ctx.reply(`Пользователь @${user} удален из доступа`)
  }
  next()
})


bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  users[userId] = {};
  const user = await pool.query('DELETE FROM users WHERE telegram_id = $1', [userId])
  ctx.reply('Добро пожаловать! Введите API-токен сообщества ВК')

  bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;


    if (users[userId] && !users[userId].vkApiToken) {

      users[userId].vkApiToken = message;
      ctx.reply('Токен VK API сохранен. Теперь отправьте идентификатор группы ВКонтакте:');

    } else if (users[userId] && users[userId].vkApiToken && !users[userId].vkGroupId) {

      let lastPostDate = null;
      users[userId].vkGroupId = message;

      const res = await pool.query('INSERT INTO users(token_vk, group_id_vk, telegram_id, last_post_date) values($1, $2, $3, $4) RETURNING *;', [users[userId].vkApiToken, users[userId].vkGroupId, userId, lastPostDate]);
      ctx.reply('Отлично! Теперь добавьте меня в телеграм-чат, куда будут пересылаться посты.');
      console.log(res.rows);

    } else {

      ctx.reply('Неизвестная команда. Пожалуйста, используйте команду /start для настройки бота.');

    }
  })
})

bot.on('new_chat_members', async (ctx) => {
  console.log(ctx);
  const chatId = ctx.chat.id;
  const userId = ctx.from.id
  const userName = ctx.from.username
  console.log(userId);

  const access = await pool.query('SELECT * FROM access;')
  const accessList = access.rows.map((user) => user.telegram_nickname)

  if (!accessList.includes(userName)) {
    ctx.reply('Бот не оплачен, для оплаты обратитесь к владельцу.\nПокидаю чат...')
    bot.telegram.leaveChat(chatId)
      .then(() => {
        console.log('Бот покинул чат:', chatId);
      })
      .catch((error) => {
        console.error(error);
      });
    return
  }
  ctx.reply('Привет! Я новый бот в этом чате.');
  const chat = await pool.query('UPDATE users SET telegram_chat = $1 WHERE telegram_id = $2;', [chatId, userId]);

});

async function startReposting() {
  try {
    console.log('startreposting');
    let users = await pool.query('SELECT * FROM users;');
    users = users.rows
    console.log(users);

    users.map(async (user) => {
      const vkApiToken = user.token_vk
      const vkGroupId = user.group_id_vk
      const chatId = user.telegram_chat ? user.telegram_chat : 1733782819
      let postText = null
      let lastPostDate = user.last_post_date

      const response = await axios.get(`https://api.vk.com/method/wall.get?access_token=${vkApiToken}&owner_id=-${vkGroupId}&count=1&v=5.131`);
      let postDate = response.data.response.items[0].date

      if (lastPostDate == null) {
        console.log(response.data);
        postText = response.data.response.items[0].text
        const res = await pool.query('UPDATE users SET last_post_date = $1 WHERE telegram_chat = $2', [response.data.response.items[0].date, chatId])

        await bot.telegram.sendMessage(chatId, `New post in VK-community: \n${postText}`)

      } else {
        console.log(parseInt(postDate), parseInt(lastPostDate));

        if (parseInt(postDate) > parseInt(lastPostDate)) {
          postText = response.data.response.items[0].text
          await bot.telegram.sendMessage(chatId, `New post in VK-community: \n${postText}`);

          const res = await pool.query('UPDATE users SET last_post_date = $1 WHERE telegram_chat = $2', [postDate, chatId]);
        }
      }

    });

  } catch (error) {
    console.error(error);
  }

}

async function cycle() {
  await startReposting()
  setInterval(startReposting, 60 * 1000 * 1)  
}

cycle()

bot.catch((err, ctx) => console.log(err))
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);
bot.launch()