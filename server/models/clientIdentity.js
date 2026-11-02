const crypto = require("node:crypto");

function clientIdentityKey(client) {
  const type = String(client.organizationType || "Other").toLowerCase();
  const isIndividual = type === "individual";
  const basis = isIndividual
    ? (client.email || client.phone || client.name)
    : client.name;
  const identity = `${type}:${String(basis).trim().toLowerCase()}`;
  return crypto.createHash("sha256").update(identity).digest("hex");
}

module.exports = { clientIdentityKey };
