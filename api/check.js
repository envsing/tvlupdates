const PLACE_IDS = [
  "10561456271",
  "10561483644",
  "10561484691"
];

const LOOKBACK_HOURS = 26;
const ROLE_ID = "1496952791351169185";

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
  const res = await fetch(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    {
      headers: {
        accept: "application/json"
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Erro ao buscar universeId do place ${placeId}: ${res.status}`);
  }

  const data = await res.json();

  if (!data?.universeId) {
    throw new Error(`UniverseId não encontrado para place ${placeId}`);
  }

  return String(data.universeId);
}

async function getGames(universeIds) {
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`,
    {
      headers: {
        accept: "application/json"
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Erro ao buscar jogos: ${res.status}`);
  }

  const data = await res.json();

  if (!data?.data || !Array.isArray(data.data)) {
    throw new Error("Resposta inválida da API de jogos");
  }

  return data.data;
}

async function sendDiscordMessage(webhookUrl, games) {
  const embeds = games.map((game) => ({
    title: "TVL Update Tracker",
    description: `**${game.name}** foi atualizado.`,
    url: `https://www.roblox.com/games/${game.rootPlaceId}`,
    color: 0,
    fields: [
      {
        name: "Nome do jogo",
        value: game.name,
        inline: false
      },
      {
        name: "Horário da atualização",
        value: fmtDate(game.updated),
        inline: false
      },
      {
        name: "Link do jogo",
        value: `[Abrir jogo](https://www.roblox.com/games/${game.rootPlaceId})`,
        inline: false
      }
    ],
    footer: {
      text: "TVL Update Tracker"
    },
    timestamp: new Date(game.updated).toISOString()
  }));

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: `<@&${ROLE_ID}>`,
      allowed_mentions: {
        roles: [ROLE_ID]
      },
      embeds
    })
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Erro ao enviar webhook: ${res.status} - ${text}`);
  }
}

export default async function handler(req, res) {
  try {
    const webhook = process.env.DISCORD_WEBHOOK_URL;

    if (!webhook) {
      return res.status(500).json({
        ok: false,
        error: "DISCORD_WEBHOOK_URL não definida"
      });
    }

    const universeIds = await Promise.all(PLACE_IDS.map(getUniverseId));
    const uniqueIds = [...new Set(universeIds)];
    const games = await getGames(uniqueIds);

    // TESTE: sempre envia
    const updatedGames = games;

    if (updatedGames.length > 0) {
      await sendDiscordMessage(webhook, updatedGames);
    }

    return res.status(200).json({
      ok: true,
      mode: "test",
      checked: games.map((game) => ({
        name: game.name,
        rootPlaceId: game.rootPlaceId,
        updated: game.updated
      })),
      updatedDetected: updatedGames.map((game) => ({
        name: game.name,
        rootPlaceId: game.rootPlaceId,
        updated: game.updated
      }))
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Erro interno"
    });
  }
}
