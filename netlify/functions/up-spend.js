exports.handler = async function (event) {
  // Allow CORS for local testing
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const weekKey = event.queryStringParameters?.weekKey;

  if (!authHeader || !weekKey) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing token or weekKey" }) };
  }

  // Ensure token has Bearer prefix
  const token = authHeader.startsWith("Bearer ") ? authHeader : `Bearer ${authHeader}`;

  // Up Bank is Australian — use AEST/AEDT offset (+10 or +11)
  // We add a buffer of ±1 day to catch all transactions regardless of DST
  const start = new Date(weekKey);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1); // 1 day buffer before

  const end = new Date(weekKey);
  end.setDate(end.getDate() + 8); // full week + 1 day buffer after

  let total = 0;
  let pageUrl = `https://api.up.com.au/api/v1/transactions?filter[status]=SETTLED&filter[since]=${start.toISOString()}&filter[until]=${end.toISOString()}&page[size]=100`;

  try {
    // First verify the token works
    const pingRes = await fetch("https://api.up.com.au/api/v1/util/ping", {
      headers: { Authorization: token }
    });
    if (!pingRes.ok) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid Up Bank token — please check in Settings" })
      };
    }

    while (pageUrl) {
      const res = await fetch(pageUrl, { headers: { Authorization: token } });
      if (!res.ok) {
        const body = await res.text();
        return { statusCode: res.status, headers: corsHeaders, body: JSON.stringify({ error: `Up API ${res.status}: ${body}` }) };
      }
      const json = await res.json();

      for (const tx of json.data) {
        const amt = tx.attributes.amount.valueInBaseUnits;
        // Only count debits (negative = money out), exclude transfers between Up accounts
        const category = tx.relationships?.category?.data?.id || "";
        const isTransfer = tx.attributes?.isCategorizable === false;
        if (amt < 0 && !isTransfer) {
          total += Math.abs(amt);
        }
      }

      pageUrl = json.links?.next || null;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ total: total / 100 }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Server error: ${err.message}` })
    };
  }
};
