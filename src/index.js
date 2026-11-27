require("dotenv").config();
const {
  Client, GatewayIntentBits, EmbedBuilder, Events, PermissionFlagsBits
} = require("discord.js");
const { statements, ensureUser, transactions } = require("./db");

const { DISCORD_TOKEN, ADMIN_USER_IDS = "" } = process.env;
if (!DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN in .env");

const configuredAdmins = new Set(ADMIN_USER_IDS.split(",").map(id => id.trim()).filter(Boolean));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const palette = {
  bronze: 0x9b6a43, silver: 0x9aa7b2, gold: 0xf0b429,
  special: 0x7b4ce0, promo: 0x13a8a8
};
const packNames = { normal: "NORMAL PACK", rare: "RARE PACK", special: "SPECIAL PACK", promo: "PROMO PACK" };
const prices = { normal: 100, rare: 300, special: 750, promo: 1500 };

function isAdmin(interaction) {
  return configuredAdmins.has(interaction.user.id) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
}
function cardEmbed(player, cardId, packType) {
  const color = palette[player.rarity] || palette.bronze;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("⚽ MLS GURU  •  " + (player.rarity || "bronze").toUpperCase() + " CARD")
    .setDescription(`**${player.name}**\n${player.club} • ${player.position}\n\n`)
    .addFields(
      { name: "OVR", value: `**${player.rating}**`, inline: true },
      { name: "CARD ID", value: `#${cardId}`, inline: true },
      { name: "PACK", value: packNames[packType], inline: true }
    )
    .setFooter({ text: "MLS GURU • Collect the league" })
    .setTimestamp();
}
function adminDenied(interaction) {
  return interaction.reply({ content: "❌ You don't have permission to use this admin command.", ephemeral: true });
}

client.once(Events.ClientReady, readyClient => {
  console.log(`MLS Guru is online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const now = Math.floor(Date.now() / 1000);
  try {
    const command = interaction.commandName;
    if (command === "consent") {
      statements.consent.run(interaction.user.id, interaction.user.globalName || interaction.user.username, now);
      return interaction.reply({ content: "✅ You're opted in! An MLS Guru admin can now add your player card. Use /withdraw any time to remove it.", ephemeral: true });
    }
    if (command === "withdraw") {
      const hadConsent = statements.getConsent.get(interaction.user.id);
      if (!hadConsent) return interaction.reply({ content: "You haven't opted in to MLS Guru cards.", ephemeral: true });
      const player = statements.players.all().find(p => p.discord_user_id === interaction.user.id);
      if (player) statements.removePlayer.run(player.id);
      const removeConsent = require("./db").db.prepare("DELETE FROM consents WHERE user_id = ?");
      removeConsent.run(interaction.user.id);
      return interaction.reply({ content: "Your consent has been withdrawn. Your player card and every copy in collections have been removed.", ephemeral: true });
    }
    if (command === "daily") {
      const result = transactions.claimDaily(interaction.user.id, now);
      if (!result.ok) return interaction.reply({ content: `⏳ You already claimed today's reward. Come back in **${formatTime(result.remaining)}**.`, ephemeral: true });
      return interaction.reply(`🎁 Daily reward claimed! **+200 coins** and **+1 free Normal pack credit**. Balance: **${result.user.coins} coins**.`);
    }
    if (command === "work") {
      const amount = 50 + Math.floor(Math.random() * 101);
      const result = transactions.earnWork(interaction.user.id, now, amount);
      if (!result.ok) return interaction.reply({ content: `⏳ You're on cooldown. Try again in **${formatTime(result.remaining)}**.`, ephemeral: true });
      return interaction.reply(`💼 You completed an MLS league task and earned **${amount} coins**! Balance: **${result.user.coins} coins**.`);
    }
    if (command === "pack") {
      const type = interaction.options.getString("type", true);
      const result = transactions.openPack(interaction.user.id, type, now);
      if (!result.ok && result.reason === "empty") return interaction.reply({ content: "There aren't any eligible opted-in players in this pack pool yet. Ask players to use /consent, then an admin can add their cards.", ephemeral: true });
      if (!result.ok && result.reason === "coins") return interaction.reply({ content: `You need **${result.cost} coins** for this pack, but you only have **${result.balance}**. Use /daily or /work.`, ephemeral: true });
      const prefix = result.usedFree ? "🎟️ Your free daily pack!" : `🪙 You spent ${prices[type]} coins.`;
      return interaction.reply({ content: prefix, embeds: [cardEmbed(result.player, result.cardId, type)] });
    }
    if (command === "collection") {
      const user = ensureUser(interaction.user.id);
      const cards = statements.collection.all(interaction.user.id);
      if (!cards.length) return interaction.reply({ content: `Your collection is empty. Open a /pack to get started.\nCoins: **${user.coins}** • Free Normal packs: **${user.free_packs}**`, ephemeral: true });
      const lines = cards.slice(0, 20).map(c => `**#${c.card_id}** • ${c.name} — ${c.rating} OVR • ${c.club} (${c.rarity})`);
      const embed = new EmbedBuilder().setColor(0x171c2e).setTitle(`⚽ ${interaction.user.globalName || interaction.user.username}'s MLS Guru Collection`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `${cards.length} cards • ${user.coins} coins • ${user.free_packs} free packs` });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (command === "sell") {
      const result = transactions.sellCard(interaction.user.id, interaction.options.getInteger("card_id", true));
      if (!result.ok) return interaction.reply({ content: "I couldn't find that card in your collection. Check its ID with /collection.", ephemeral: true });
      const user = ensureUser(interaction.user.id);
      return interaction.reply(`💰 Card sold for **${result.payout} coins**. Your balance is now **${user.coins} coins**.`);
    }
    if (command === "leaderboard") {
      const rows = statements.leaderboard.all();
      if (!rows.length) return interaction.reply("No collectors yet. Be the first to use /daily!");
      const lines = rows.map((row, i) => `**${i + 1}.** <@${row.user_id}> — ${row.card_count} cards • best OVR ${row.best_rating} • ${row.coins} coins`);
      const embed = new EmbedBuilder().setColor(0x171c2e).setTitle("🏆 MLS GURU COLLECTORS").setDescription(lines.join("\n"));
      return interaction.reply({ embeds: [embed] });
    }
    if (["addplayer", "editplayer", "removeplayer"].includes(command) && !isAdmin(interaction)) return adminDenied(interaction);

    if (command === "addplayer") {
      const member = interaction.options.getUser("user", true);
      const consent = statements.getConsent.get(member.id);
      if (!consent) return interaction.reply({ content: "That member has not opted in. They must use /consent first.", ephemeral: true });
      const existing = statements.players.all().find(p => p.discord_user_id === member.id);
      if (existing) return interaction.reply({ content: `That member already has a player card (ID #${existing.id}). Use /editplayer.`, ephemeral: true });
      const name = interaction.options.getString("name", true);
      const club = interaction.options.getString("club", true);
      const position = interaction.options.getString("position", true);
      const rating = interaction.options.getInteger("rating", true);
      const rarity = interaction.options.getString("rarity", true);
      const result = statements.addPlayer.run(member.id, name, club, position, rating, rarity, now);
      return interaction.reply(`✅ Added **${name}** — ${club} • ${position} • **${rating} OVR** (${rarity}). Player ID: **#${result.lastInsertRowid}**.`);
    }
    if (command === "editplayer") {
      const id = interaction.options.getInteger("player_id", true);
      if (!statements.getPlayer.get(id)) return interaction.reply({ content: "Player not found.", ephemeral: true });
      const result = statements.updatePlayer.run(
        interaction.options.getInteger("rating"),
        interaction.options.getString("rarity"),
        interaction.options.getString("club"),
        interaction.options.getString("position"),
        id
      );
      return interaction.reply(result.changes ? `✅ Updated player **#${id}**.` : "No changes were made.");
    }
    if (command === "removeplayer") {
      const id = interaction.options.getInteger("player_id", true);
      const player = statements.getPlayer.get(id);
      if (!player) return interaction.reply({ content: "Player not found.", ephemeral: true });
      statements.removePlayer.run(id);
      return interaction.reply(`🗑️ Removed **${player.name}** and all copies of that card from collections.`);
    }
  } catch (error) {
    console.error("Command error:", error);
    const message = { content: "Something went wrong while running that command. Please try again.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(message).catch(() => {});
    else await interaction.reply(message).catch(() => {});
  }
});

client.login(DISCORD_TOKEN);
