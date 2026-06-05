require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userSessions = {};

const CATEGORIES = [
    { id: 2,  name: 'Electronics' },
    { id: 3,  name: 'Wallets' },
    { id: 4,  name: 'Keys' },
    { id: 5,  name: 'IDs' },
    { id: 6,  name: 'Accessories' },
    { id: 7,  name: 'Bags & Backpacks' },
    { id: 8,  name: 'Clothing' },
    { id: 9,  name: 'Books' },
    { id: 10, name: 'Stationery' },
    { id: 1,  name: 'Others' },
];

// Build inline keyboard — 2 buttons per row
const categoryKeyboard = Markup.inlineKeyboard(
    CATEGORIES.map(c => Markup.button.callback(c.name, `cat_${c.id}`)),
    { columns: 2 }
);

bot.start((ctx) => {
    ctx.reply('Welcome to the Campus Lost & Found Bot! Use the /found command to report an item you have discovered.');
});

bot.command('found', (ctx) => {
    const userId = ctx.from.id;
    userSessions[userId] = { step: 'AWAITING_CATEGORY' };
    ctx.reply('What category best describes the item you found?', categoryKeyboard);
});

bot.command('cancel', (ctx) => {
    const userId = ctx.from.id;
    if (userSessions[userId]) {
        delete userSessions[userId];
        return ctx.reply('Submission cancelled. Your session has been reset.');
    }
    ctx.reply('You don\'t have any active submission to cancel. Type /found if you want to start one!');
});

// Category button handler
bot.action(/^cat_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id;

    if (!userSessions[userId] || userSessions[userId].step !== 'AWAITING_CATEGORY') {
        return ctx.answerCbQuery('Please start a new submission with /found.');
    }

    const categoryId = parseInt(ctx.match[1]);
    const category = CATEGORIES.find(c => c.id === categoryId);

    userSessions[userId] = {
        step: 'AWAITING_PHOTO',
        category_id: categoryId,
        category_name: category.name
    };

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Category selected: ${category.name} ✅`);
    ctx.reply('Got it! Now please upload a photo of the item.\n\nMake sure to include a description in the image caption field.\n\nType /cancel anytime to stop.');
});

bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;

    if (!userSessions[userId] || userSessions[userId].step !== 'AWAITING_PHOTO') {
        return ctx.reply('Please run the /found command first before sending an item photo!');
    }

    const caption = ctx.message.caption || '';
    const photoArray = ctx.message.photo;
    const highestResPhoto = photoArray[photoArray.length - 1];

    try {
        const fileLink = await ctx.telegram.getFileLink(highestResPhoto.file_id);

        ctx.reply('Photo received! Uploading to the campus system... ⏳');

        const payload = {
            image_url: fileLink.href,
            caption: caption,
            telegram_chat_id: userId.toString(),
            category_id: userSessions[userId].category_id
        };

        const response = await fetch(`${process.env.LARAVEL_URL}/api/bot/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Laravel API Error:', data);
            throw new Error('Failed to save to database');
        }

        console.log(`✅ Item #${data.id} saved. Category: ${userSessions[userId].category_name}. Awaiting GPS...`);

        userSessions[userId] = {
            step: 'AWAITING_LOCATION',
            found_item_id: data.id
        };

        ctx.reply('Item logged! ✅\n\nNow please share your current location so we can record where the item was found.\n\nTap the 📎 attachment icon → Location → Send My Current Location.');

    } catch (error) {
        console.error('Submission Failed:', error);
        delete userSessions[userId];
        ctx.reply('Whoops, I had trouble communicating with the campus server. Please try again later.');
    }
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;

    if (!userSessions[userId] || userSessions[userId].step !== 'AWAITING_LOCATION') {
        return ctx.reply('Please start a submission first with /found.');
    }

    const { latitude, longitude } = ctx.message.location;
    const foundItemId = userSessions[userId].found_item_id;

    try {
        const response = await fetch(`${process.env.LARAVEL_URL}/api/bot/update-location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ latitude, longitude, found_item_id: foundItemId })
        });

        if (!response.ok) {
            const data = await response.json();
            console.error('Location API Error:', data);
            throw new Error('Failed to save location');
        }

        console.log(`✅ Location saved for item #${foundItemId}`);
        delete userSessions[userId];

        ctx.reply('Thank you! 🎉 Your found item report is complete. Our AI is now analysing the photo and searching for a match. You will be notified if we find the owner!');

    } catch (error) {
        console.error('Location save failed:', error);
        ctx.reply('Whoops, I had trouble saving the location. Please try again later.');
    }
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (text.startsWith('/')) return;

    if (userSessions[userId]?.step === 'AWAITING_CATEGORY') {
        return ctx.reply('Please select a category by tapping one of the buttons above.');
    }
    if (userSessions[userId]?.step === 'AWAITING_PHOTO') {
        return ctx.reply('I need a photo! Please upload an image with your description in the caption field.');
    }
    if (userSessions[userId]?.step === 'AWAITING_LOCATION') {
        return ctx.reply('I need your location! Please tap the 📎 attachment icon and share your current location.');
    }

    ctx.reply('Type /found to report an item you discovered.');
    console.log(`Loose text from ${ctx.from.first_name}: ${text}`);
});

bot.launch().then(() => {
    console.log('Campus L&F Bot is running with category selection!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
