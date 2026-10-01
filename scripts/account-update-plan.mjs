export function accountUpdatePlan(user, profile, changes) {
  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const stored = appMetadata.aurex_metrics ?? {};
  const metrics = {};
  for (const field of ['balance', 'reserve', 'income']) {
    const existing = stored[field] ?? (field === 'balance' ? profile.balance : undefined) ?? metadata[field] ?? 0;
    const value = changes[field] ?? existing;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100) {
      throw new Error(`Invalid ${field}`);
    }
    metrics[field] = Math.round(value * 100) / 100;
  }
  const nextMetadata = { ...metadata, ...metrics };
  for (const field of ['country', 'phone']) {
    if (changes[field] !== undefined) {
      if (typeof changes[field] !== 'string' || !changes[field].trim()) throw new Error(`Invalid ${field}`);
      nextMetadata[field] = changes[field].trim();
    }
  }
  const nextApp = { ...appMetadata, aurex_metrics: { ...stored, ...metrics } };
  return {
    user_metadata: nextMetadata,
    app_metadata: nextApp,
    // profiles.balance is a legacy bigint; protected metrics preserve cents,
    // exactly as the existing Admin updateMetrics route does.
    profileBalance: Math.round(metrics.balance),
    changed: JSON.stringify(metadata) !== JSON.stringify(nextMetadata)
      || JSON.stringify(appMetadata) !== JSON.stringify(nextApp)
      || profile.balance !== Math.round(metrics.balance),
  };
}
