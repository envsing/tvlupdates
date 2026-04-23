export const config = {
  runtime: "nodejs"
};

const PLACE_IDS = [
  "10561456271",
  "10561483644",
  "10561484691"
];

const LOOKBACK_HOURS = 26;

function fmtDate(dateString) {
  return new Date(dateString).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}

function hoursAgo(dateString) {
  const ms = Date.now() - new Date(dateString).getTime();
  return ms / (1000 * 60 * 60);
}

async function getUniverseId(placeId) {
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  const data = await res.json();
  return data.universeId;
}

async function getGames(universeIds) {
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`
  );
  const data = await res.json();
  return data.data;
}

async function sendDiscordMessage(webhookUrl, games) {
  const embeds = games.map((game) => ({
    title: "TVL Update Tracker",
    description: `**${game.name}** foi atualizado.`,
    url: `https://www.roblox.com/games/${game.rootPlaceId}`,
    color: 0x000000,
    fields: [
      {
        name: "Nome do jogo",
        value: game.name
      },
      {
        name: "Horário da atualização",
        value: fmtDate(game.updated)
      },
      {
        name: "Link do jogo",
        value: `[Abrir jogo](https://www.roblox.com/games/${game.rootPlaceId})`
      }
    ],
    footer: {
      text: "TVL Update Tracker"
    },
    timestamp: new Date(game.updated).toISOString()
  }));

  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ embeds })
  });
}

export default async function handler(req, res) {
  try {
    const webhook = process.env.DISCORD_WEBHOOK_URL;

    const universeIds = await Promise.all(
      PLACE_IDS.map((id) => getUniverseId(id))
    );

    const uniqueIds = [...new Set(universeIds)];

    const games = await getGames(uniqueIds);

    const updated = games.filter((g) => hoursAgo(g.updated) <= LOOKBACK_HOURS);

    if (updated.length > 0) {
      await sendDiscordMessage(webhook, updated);
    }

    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }));
  }
}
