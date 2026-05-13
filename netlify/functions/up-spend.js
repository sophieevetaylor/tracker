exports.handler = async function (event) {
  const token   = event.headers["authorization"];
  const weekKey = event.queryStringParameters?.weekKey;

  if (!token || !weekKey) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing token or weekKey" }) };
  }

  const start = new Date(weekKey);
  start.setHours(0, 0, 0, 0);
  const end = new Date(weekKey);
  end.setDate(end.getDate() + 7);

  let total = 0;
  let pageUrl = `https://api.up.com.au/api/v1/transactions?filter[status]=SETTLED&filter[since]=${start.toISOString()}&filter[until]=${end.toISOString()}&page[size]=100`;

  try {
    while (pageUrl) {
      const res  = await fetch(pageUrl, { headers: { Authorization: token } });
      if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: `Up API ${res.status}` }) };
      const json = await res.json();
      for (const tx of json.data) {
        const amt = tx.attributes.amount.valueInBaseUnits;
        if (amt < 0) total += Math.abs(amt);
      }
      pageUrl = json.links?.next || null;
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: total / 100 }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
