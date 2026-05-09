/**
 * Strip secret query values from strings before logging or returning error text.
 * Matches common API key parameter names (Tomorrow.io, OWM, etc.).
 */
function sanitizeForLogs(input) {
  if (input == null) {
    return "";
  }

  let s = typeof input === "string" ? input : String(input);

  const paramPattern =
    /([?&])(apikey|api_key|appid|key|token|access_token|secret|password)=([^&\s#]+)/gi;

  s = s.replace(paramPattern, "$1$2=***");

  return s;
}

module.exports = { sanitizeForLogs };
