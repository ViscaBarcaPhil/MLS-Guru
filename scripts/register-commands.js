require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { commands } = require("../src/commands");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env");
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log(`Registered ${commands.length} MLS Guru slash commands.`);
})().catch(error => {
  console.error("Command registration failed:", error);
  process.exitCode = 1;
});
