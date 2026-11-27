require("dotenv").config();
const { REST, Routes, ApplicationCommandOptionType } = require("discord.js");
const { commands } = require("../src/commands");
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) throw new Error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env");
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  const registered = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
  const addPlayer = registered.find(command => command.name === "addplayer");
  const imageOption = addPlayer?.options?.find(option => option.name === "image" && option.type === ApplicationCommandOptionType.Attachment);
  if (!imageOption) throw new Error("Discord did not return the required /addplayer image attachment option. Check CLIENT_ID and GUILD_ID.");
  if (!registered.some(command => command.name === "addcoins")) throw new Error("Discord did not return /addcoins.");
  console.log(`Registered and verified ${registered.length} MLS Guru slash commands.`);
  console.log("Verified /addplayer image attachment and /addcoins.");
})().catch(error => { console.error("Command registration failed:", error); process.exitCode = 1; });
