const { SlashCommandBuilder } = require("discord.js");

const rarityChoices = [
  { name: "Bronze", value: "bronze" }, { name: "Silver", value: "silver" },
  { name: "Gold", value: "gold" }, { name: "Special", value: "special" }, { name: "Promo", value: "promo" }
];
function addStats(command) {
  return command
    .addIntegerOption(o => o.setName("pac").setDescription("Pace (PAC)").setMinValue(0).setMaxValue(99))
    .addIntegerOption(o => o.setName("sho").setDescription("Shooting (SHO)").setMinValue(0).setMaxValue(99))
    .addIntegerOption(o => o.setName("pas").setDescription("Passing (PAS)").setMinValue(0).setMaxValue(99))
    .addIntegerOption(o => o.setName("dri").setDescription("Dribbling (DRI)").setMinValue(0).setMaxValue(99))
    .addIntegerOption(o => o.setName("def").setDescription("Defending (DEF)").setMinValue(0).setMaxValue(99))
    .addIntegerOption(o => o.setName("phy").setDescription("Physicality (PHY)").setMinValue(0).setMaxValue(99));
}
const addPlayer = addStats(new SlashCommandBuilder().setName("addplayer").setDescription("Admin: add a consenting player card with photo and stats.")
  .addUserOption(o => o.setName("user").setDescription("Discord member who used /consent").setRequired(true))
  .addStringOption(o => o.setName("name").setDescription("Player display name").setRequired(true).setMaxLength(40))
  .addStringOption(o => o.setName("club").setDescription("MLS league club").setRequired(true).setMaxLength(40))
  .addStringOption(o => o.setName("position").setDescription("Player position").setRequired(true).setMaxLength(20))
  .addIntegerOption(o => o.setName("rating").setDescription("Overall rating (60–99)").setRequired(true).setMinValue(60).setMaxValue(99))
  .addAttachmentOption(o => o.setName("image").setDescription("Upload the player photo for their custom card").setRequired(true))
  .addStringOption(o => o.setName("rarity").setDescription("Card rarity").setRequired(true).addChoices(...rarityChoices)));
const editPlayer = addStats(new SlashCommandBuilder().setName("editplayer").setDescription("Admin: edit a player's card and stats.")
  .addIntegerOption(o => o.setName("player_id").setDescription("Player ID").setRequired(true).setMinValue(1))
  .addIntegerOption(o => o.setName("rating").setDescription("New rating (60–99)").setMinValue(60).setMaxValue(99))
  .addStringOption(o => o.setName("rarity").setDescription("New rarity").addChoices(...rarityChoices))
  .addStringOption(o => o.setName("club").setDescription("New club").setMaxLength(40))
  .addStringOption(o => o.setName("position").setDescription("New position").setMaxLength(20)));
const commands = [
  new SlashCommandBuilder().setName("consent").setDescription("Opt in to having your own MLS Guru player card."),
  new SlashCommandBuilder().setName("withdraw").setDescription("Withdraw consent and remove your player card and copies."),
  new SlashCommandBuilder().setName("daily").setDescription("Claim 200 coins and one free Normal pack credit."),
  new SlashCommandBuilder().setName("work").setDescription("Earn 50–150 coins (1-hour cooldown)."),
  new SlashCommandBuilder().setName("pack").setDescription("Open an MLS player pack.")
    .addStringOption(o => o.setName("type").setDescription("Choose your pack").setRequired(true)
      .addChoices(
        { name: "Normal — 100 coins / free daily credit", value: "normal" },
        { name: "Rare — 300 coins", value: "rare" },
        { name: "Special — 750 coins", value: "special" },
        { name: "Promo — 1,500 coins", value: "promo" }
      )),
  new SlashCommandBuilder().setName("collection").setDescription("View your MLS Guru card collection."),
  new SlashCommandBuilder().setName("sell").setDescription("Sell one card from your collection.")
    .addIntegerOption(o => o.setName("card_id").setDescription("The card ID shown in /collection").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName("leaderboard").setDescription("See the top MLS Guru collectors."),
  new SlashCommandBuilder().setName("addcoins").setDescription("Admin: give coins to a member.")
    .addUserOption(o => o.setName("user").setDescription("Member receiving coins").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Number of coins to add").setRequired(true).setMinValue(1).setMaxValue(1000000)),
  addPlayer, editPlayer,
  new SlashCommandBuilder().setName("removeplayer").setDescription("Admin: remove a player and all copies of their card.")
    .addIntegerOption(o => o.setName("player_id").setDescription("Player ID").setRequired(true).setMinValue(1))
].map(command => command.toJSON());
module.exports = { commands };
