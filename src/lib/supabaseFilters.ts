function quotePostgrestValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function accountTransferFilter(username: string) {
  const quotedUsername = quotePostgrestValue(username);
  return `sender.eq.${quotedUsername},receiver.eq.${quotedUsername}`;
}
