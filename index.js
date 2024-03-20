require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { runGeminiPro, runGeminiVision } = require('./gemini.js');
const path= require ('path');
const fs = require('fs');
const https = require('https');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

client.login(process.env.DISCORD_TOKEN);

const authorisedUsers = ['755033715293290496'];
const authorisedChannels = ['1220021507640786974'];

client.on('ready', () => {
    console.log(`Logged is as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    try {
        // Ignore messages from bots
        if (message.author.bot) return;

        // Reply in DMs
        if (message.channel.type === ChannelType.DM && authorisedUsers.includes(message.author.id)) {
            //message.reply('Hey there, how can I help you');
            const response = await runGeminiPro(message.content);
            const results = splitResponse(response);
            results.forEach((result) => {
                message.reply(result);
            });
            return; // Exit early after replying
        }

        // Reply in authorized guild text channels
        if (message.channel.type === ChannelType.GuildText && authorisedChannels.includes(message.channel.id)) {
            if (!message.mentions.users.has(client.user.id)) return;
            else{
            const userId = message.author.id;
            //message.reply(`Hey there, <@${userId}> `);

            const prompt = message.content;
            let localPath = null;
            let mimeType = null;

            if (message.attachments.size > 0) {
                let attachment = message.attachments.first();
                let url = attachment.url;
                mimeType = attachment.contentType;
                let fileName = attachment.name;

                localPath = path.join(__dirname, 'images', fileName);
                let file = fs.createWriteStream(localPath);
                https.get(url, function (response) {
                    response.pipe(file);
                    file.on('finish', async function () {
                        file.close(async() => {
                            try {
                                const response = await runGeminiVision(prompt, localPath, mimeType);
                                const results = splitResponse(response);
                                results.forEach((result) => {
                                    message.reply(result);
                                });
                            } catch (error) {
                                console.error(error);
                                message.reply("Sorry, I had trouble processing your request");
                            }
                        });
                    });
                });
                return; // Exit early after handling attachment
            }

            // Process message content with runGeminiPro
            const response = await runGeminiPro(message.content);
            const results = splitResponse(response);
            results.forEach((result) => {
                message.reply(result);
            });
            return; // Exit after processing message content
        }
    }
    } catch (error) {
        console.error(error);
    }
});


function splitResponse(response){
    const maxChunkLength= 2000;
    let chunks = [];
    for(let i = 0; i<response.length; i+=maxChunkLength){
        chunks.push(response.substring(i, i+maxChunkLength));
    }
    return chunks;
}